import type { Kernel } from './kernel.js'
import type Process from './Process.js'
import type { ProcessMonitor } from './Process.js'
import { createGeneratedTypeRegistry, monitor_flag } from './kernelApi.js'
import {
  CodecRegistry,
  LocalCircularBuffer,
  FlatLocalCircularBufferWriter,
  TypeKind,
  deserializeValueByType,
  registerDynamicCodecs,
  serializeValueByType,
  type JsonValue,
  type TypeRegistry,
} from '@daemonarium/rpc'
import { MonitorSocketBackpressure } from './MonitorSocketBackpressure.js'
import { hasMonitorFlag } from './monitorFlags.js'

const LENGTH_SIZE = 4

export interface MonitorCodecCache {
  registry: TypeRegistry
  codecs: CodecRegistry
}

/**
 * Builds length-prefixed monitor frames matching FlatSocketMessageChannel /
 * flat_materialized_codec:
 * [u32 LE msgLen][type u32 LE][encoded_size_0][root…][writeRest…][u32 0][payload?]
 */
export class ProcessMonitorEmitter {
  private codecCache?: MonitorCodecCache

  constructor(
    private readonly kernel: Kernel,
    private readonly backpressure: MonitorSocketBackpressure
  ) {}

  getCodecs(): MonitorCodecCache {
    if (!this.codecCache) {
      const { registry } = createGeneratedTypeRegistry()
      const codecs = new CodecRegistry()
      registerMonitorMessageCodecs(codecs, registry)
      this.codecCache = { registry, codecs }
    }
    return this.codecCache
  }

  computeFrameSize(
    typeName: string,
    header: object,
    trailingPayloadSize: number = 0
  ): number {
    const frame = this.buildFrame(typeName, header, trailingPayloadSize > 0
      ? new Uint8Array(trailingPayloadSize)
      : undefined)
    return frame.length
  }

  buildFrame(
    typeName: string,
    header: object,
    trailingPayload?: Uint8Array
  ): Uint8Array {
    const { codecs } = this.getCodecs()
    const wireIndex = codecs.messages.getIndexOrThrow(typeName)
    const trailingSize = trailingPayload?.length ?? 0
    const tempBuffer = new LocalCircularBuffer(Math.max(256, trailingSize + 128))
    const writer = new FlatLocalCircularBufferWriter(tempBuffer, codecs as any, LENGTH_SIZE)

    writer.writeU32(wireIndex)

    const sizePlaceholder = writer.getOffset()
    writer.writeU32(0)
    const frameStart = writer.getOffset()

    const codec = codecs.messages.getByIndex(wireIndex)
    codec.serialize(writer as any, header)

    const realSize = writer.getOffset() - frameStart
    writer.pokeU32(sizePlaceholder, realSize + 1)

    writer.writeRest()
    writer.writeU32(0) // sentinel

    if (trailingPayload && trailingSize > 0) {
      // Poke trailing at writer.offset — do not use write(), which advances
      // write_offset from 0 and would overwrite the poked header.
      tempBuffer.poke(writer.offset, trailingPayload, trailingSize)
    }

    const payloadLen = writer.offset - LENGTH_SIZE + trailingSize
    const lengthBytes = new Uint8Array(LENGTH_SIZE)
    new DataView(lengthBytes.buffer).setUint32(0, payloadLen, true)
    tempBuffer.poke(0, lengthBytes, LENGTH_SIZE)
    tempBuffer.commitWrite(writer.offset + trailingSize)

    const readable = tempBuffer.readableBytes()
    const out = new Uint8Array(readable)
    tempBuffer.read(out, readable)
    return out
  }

  deliverFrame(monitor: ProcessMonitor, frame: Uint8Array): void {
    const socket = monitor.process.getSocket(monitor.socket)
    if (!socket) {
      throw new Error(`Monitor socket ${monitor.socket} not found in process ${monitor.process.id}`)
    }
    if (socket.inputBuffer.writableBytes() < frame.length) {
      throw new Error(`Monitor socket ${monitor.socket} has insufficient space for frame`)
    }
    // write() already advances the write offset (same as C++ circular_buffer_write).
    // Do not call commitWrite afterward — that would double the readable size with zeros.
    const written = socket.inputBuffer.write(frame, frame.length)
    if (written !== frame.length) {
      throw new Error(`Failed to write full monitor frame (${written}/${frame.length} bytes)`)
    }
    this.scheduleMonitorHandleData(monitor.process, monitor.socket)
  }

  deliverEvent(
    monitor: ProcessMonitor,
    typeName: string,
    header: object,
    trailingPayload?: Uint8Array
  ): void {
    const frame = this.buildFrame(typeName, header, trailingPayload)
    this.deliverFrame(monitor, frame)
  }

  async awaitDeliverEvent(
    monitor: ProcessMonitor,
    typeName: string,
    header: object,
    trailingPayload?: Uint8Array
  ): Promise<void> {
    const frame = this.buildFrame(typeName, header, trailingPayload)
    await this.backpressure.awaitSpace(monitor, frame.length)
    this.deliverFrame(monitor, frame)
  }

  emitToMonitors(
    target: Process,
    flag: monitor_flag,
    typeName: string,
    buildHeader: (monitor: ProcessMonitor) => object,
    trailingPayload?: Uint8Array | ((monitor: ProcessMonitor) => Uint8Array | undefined)
  ): void {
    for (const monitor of target.monitors) {
      if (!hasMonitorFlag(monitor.config.flags, flag)) {
        continue
      }
      const trailing = typeof trailingPayload === 'function'
        ? trailingPayload(monitor)
        : trailingPayload
      this.deliverEvent(
        monitor,
        typeName,
        buildHeader(monitor),
        trailing
      )
    }
  }

  async awaitEmitToMonitors(
    target: Process,
    flag: monitor_flag,
    typeName: string,
    buildHeader: (monitor: ProcessMonitor) => object,
    trailingPayload?: Uint8Array | ((monitor: ProcessMonitor) => Uint8Array | undefined)
  ): Promise<void> {
    const deliveries: Promise<void>[] = []
    for (const monitor of target.monitors) {
      if (!hasMonitorFlag(monitor.config.flags, flag)) {
        continue
      }
      const trailing = typeof trailingPayload === 'function'
        ? trailingPayload(monitor)
        : trailingPayload
      deliveries.push(this.awaitDeliverEvent(
        monitor,
        typeName,
        buildHeader(monitor),
        trailing
      ))
    }
    await Promise.all(deliveries)
  }

  emitLifecycleEvent(
    target: Process,
    typeName: 'process_killed_event' | 'process_error_event',
    header: object
  ): void {
    const flag = typeName === 'process_error_event'
      ? monitor_flag.ERROR
      : monitor_flag.KILLED
    for (const monitor of target.monitors) {
      if (!hasMonitorFlag(monitor.config.flags, flag)) {
        continue
      }
      const frame = this.buildFrame(typeName, header)
      if (!this.backpressure.canFit(monitor, frame.length)) {
        console.error(
          `Monitor ${monitor.process.id} socket ${monitor.socket} full; dropping ${typeName}`
        )
        continue
      }
      this.deliverFrame(monitor, frame)
    }
  }

  scheduleMonitorHandleData(process: Process, socketId: number): void {
    queueMicrotask(() => {
      try {
        process.handleData(socketId)
      } catch (error) {
        process.handleError(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }
}

function registerMonitorMessageCodecs(codecs: CodecRegistry, registry: TypeRegistry): void {
  registerDynamicCodecs(codecs as any, registry as any)
  for (const type of registry.getTypes()) {
    if (type.kind === TypeKind.Message) {
      codecs.messages.register({
        name: type.name,
        serialize: (writer, value) => serializeValueByType(writer as any, registry as any, type, value as JsonValue),
        deserialize: (reader, output) => deserializeValueByType(reader as any, registry as any, type, output),
      })
    }
  }
}

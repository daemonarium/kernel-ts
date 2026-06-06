import type Process from './Process.js'
import type { ProcessMonitor } from './Process.js'
import type { ProcessMonitorEmitter } from './ProcessMonitorEmitter.js'
import type { MonitorSocketBackpressure } from './MonitorSocketBackpressure.js'
import { direction, monitor_flag } from './kernelApi.js'
import { hasMonitorFlag } from './monitorFlags.js'
import { requestData, requestDrain } from './ProcessSocketPending.js'
import type { BufferStateEntry } from './ProcessRuntimeState.js'

export interface PlannedMonitorDelivery {
  monitor: ProcessMonitor
  typeName: string
  header: object
  trailingPayload?: Uint8Array
}

function bufferStateKey(socket: number, dir: direction): string {
  return `${socket}:${dir}`
}

function readBufferState(
  process: Process,
  socketIndex: number,
  dir: direction
): BufferStateEntry | null {
  const socket = process.getSocket(socketIndex)
  if (!socket) {
    return null
  }
  const buffer = dir === direction.OUT ? socket.outputBuffer : socket.inputBuffer
  return {
    buffer_size: buffer.capacity(),
    read_offset: buffer.getReadOffset(),
    write_offset: buffer.getWriteOffset(),
  }
}

function bufferStateChanged(
  process: Process,
  socketIndex: number,
  dir: direction,
  state: BufferStateEntry
): boolean {
  const key = bufferStateKey(socketIndex, dir)
  const cached = process.runtime.bufferStateCache.get(key)
  if (!cached) {
    return true
  }
  return cached.buffer_size !== state.buffer_size
    || cached.read_offset !== state.read_offset
    || cached.write_offset !== state.write_offset
}

function updateBufferStateCache(
  process: Process,
  socketIndex: number,
  dir: direction,
  state: BufferStateEntry
): void {
  process.runtime.bufferStateCache.set(bufferStateKey(socketIndex, dir), { ...state })
}

function planCopyMessages(
  producer: Process,
  producerSocket: number,
  consumer: Process,
  consumerSocket: number,
  amount: number,
  payload?: Uint8Array
): PlannedMonitorDelivery[] {
  const deliveries: PlannedMonitorDelivery[] = []
  for (const monitor of producer.monitors) {
    if (hasMonitorFlag(monitor.config.flags, monitor_flag.COPY)
      || hasMonitorFlag(monitor.config.flags, monitor_flag.COPY_PAYLOAD)) {
      const includePayload = hasMonitorFlag(monitor.config.flags, monitor_flag.COPY_PAYLOAD)
      deliveries.push({
        monitor,
        typeName: 'process_copy_event',
        header: {
          _type: 'process_copy_event',
          process: producer.id,
          socket: producerSocket,
          direction: direction.OUT,
          amount,
        },
        trailingPayload: includePayload ? payload : undefined,
      })
    }
  }
  for (const monitor of consumer.monitors) {
    if (hasMonitorFlag(monitor.config.flags, monitor_flag.COPY)
      || hasMonitorFlag(monitor.config.flags, monitor_flag.COPY_PAYLOAD)) {
      const includePayload = hasMonitorFlag(monitor.config.flags, monitor_flag.COPY_PAYLOAD)
      deliveries.push({
        monitor,
        typeName: 'process_copy_event',
        header: {
          _type: 'process_copy_event',
          process: consumer.id,
          socket: consumerSocket,
          direction: direction.IN,
          amount,
        },
        trailingPayload: includePayload ? payload : undefined,
      })
    }
  }
  return deliveries
}

function planDataMessages(
  consumer: Process,
  consumerSocket: number
): PlannedMonitorDelivery[] {
  const deliveries: PlannedMonitorDelivery[] = []
  for (const monitor of consumer.monitors) {
    if (hasMonitorFlag(monitor.config.flags, monitor_flag.DATA)) {
      deliveries.push({
        monitor,
        typeName: 'process_data_event',
        header: {
          _type: 'process_data_event',
          process: consumer.id,
          socket: consumerSocket,
          direction: direction.IN,
        },
      })
    }
  }
  return deliveries
}

function planSocketStateMessages(
  target: Process,
  socketIndex: number,
  dir: direction,
  flag: monitor_flag
): PlannedMonitorDelivery[] {
  const state = readBufferState(target, socketIndex, dir)
  if (!state || !bufferStateChanged(target, socketIndex, dir, state)) {
    return []
  }
  const deliveries: PlannedMonitorDelivery[] = []
  for (const monitor of target.monitors) {
    if (!hasMonitorFlag(monitor.config.flags, flag)) {
      continue
    }
    deliveries.push({
      monitor,
      typeName: 'process_socket_state_event',
      header: {
        _type: 'process_socket_state_event',
        process: target.id,
        socket: socketIndex,
        direction: dir,
        buffer_size: state.buffer_size,
        read_offset: state.read_offset,
        write_offset: state.write_offset,
      },
    })
  }
  return deliveries
}

function allDeliveriesFit(
  emitter: ProcessMonitorEmitter,
  backpressure: MonitorSocketBackpressure,
  deliveries: PlannedMonitorDelivery[]
): boolean {
  for (const delivery of deliveries) {
    const frameSize = emitter.computeFrameSize(
      delivery.typeName,
      delivery.header,
      delivery.trailingPayload?.length ?? 0
    )
    if (!backpressure.canFit(delivery.monitor, frameSize)) {
      return false
    }
  }
  return true
}

function emitPlanned(
  emitter: ProcessMonitorEmitter,
  deliveries: PlannedMonitorDelivery[]
): void {
  for (const delivery of deliveries) {
    emitter.deliverEvent(
      delivery.monitor,
      delivery.typeName,
      delivery.header,
      delivery.trailingPayload
    )
  }
}

function peekOutputBytes(producerSocket: NonNullable<ReturnType<Process['getSocket']>>, amount: number): Uint8Array {
  const buffer = producerSocket.outputBuffer
  const out = new Uint8Array(amount)
  buffer.peek(0, out, amount)
  return out
}

export function computePumpAmount(
  producer: Process,
  producerSocketIndex: number,
  consumer: Process,
  consumerSocketIndex: number,
  emitter: ProcessMonitorEmitter,
  backpressure: MonitorSocketBackpressure
): number {
  if (producer.runtime.isPumpPaused() || consumer.runtime.isPumpPaused()) {
    return 0
  }
  const producerSocket = producer.getSocket(producerSocketIndex)
  const consumerSocket = consumer.getSocket(consumerSocketIndex)
  if (!producerSocket || !consumerSocket) {
    return 0
  }
  const physicalMax = Math.min(
    producerSocket.outputBuffer.readableBytes(),
    consumerSocket.inputBuffer.writableBytes()
  )
  for (let amount = physicalMax; amount > 0; amount--) {
    const payload = amount > 0 && needsCopyPayload(producer, consumer)
      ? peekOutputBytes(producerSocket, amount)
      : undefined
    const preMessages = [
      ...planCopyMessages(producer, producerSocketIndex, consumer, consumerSocketIndex, amount, payload),
      ...planPostCopyProducerState(producer, producerSocketIndex, amount),
      ...planPostDataConsumerState(consumer, consumerSocketIndex, amount),
    ]
    if (allDeliveriesFit(emitter, backpressure, preMessages)) {
      return amount
    }
  }
  return 0
}

function needsCopyPayload(producer: Process, consumer: Process): boolean {
  for (const monitor of producer.monitors) {
    if (hasMonitorFlag(monitor.config.flags, monitor_flag.COPY_PAYLOAD)) {
      return true
    }
  }
  for (const monitor of consumer.monitors) {
    if (hasMonitorFlag(monitor.config.flags, monitor_flag.COPY_PAYLOAD)) {
      return true
    }
  }
  return false
}

function planPostCopyProducerState(
  producer: Process,
  producerSocketIndex: number,
  _amount: number
): PlannedMonitorDelivery[] {
  const state = readBufferState(producer, producerSocketIndex, direction.OUT)
  if (!state) {
    return []
  }
  const deliveries: PlannedMonitorDelivery[] = []
  for (const monitor of producer.monitors) {
    if (!hasMonitorFlag(monitor.config.flags, monitor_flag.BUFFER_STATE)
      && !hasMonitorFlag(monitor.config.flags, monitor_flag.BUFFER_DATA)) {
      continue
    }
    const postCopyState = { ...state }
    postCopyState.read_offset = (postCopyState.read_offset + _amount) % (postCopyState.buffer_size || 1)
    if (!bufferStateChanged(producer, producerSocketIndex, direction.OUT, postCopyState)) {
      continue
    }
    deliveries.push({
      monitor,
      typeName: 'process_socket_state_event',
      header: {
        _type: 'process_socket_state_event',
        process: producer.id,
        socket: producerSocketIndex,
        direction: direction.OUT,
        buffer_size: postCopyState.buffer_size,
        read_offset: postCopyState.read_offset,
        write_offset: postCopyState.write_offset,
      },
    })
  }
  return deliveries
}

function planPostDataConsumerState(
  consumer: Process,
  consumerSocketIndex: number,
  amount: number
): PlannedMonitorDelivery[] {
  const state = readBufferState(consumer, consumerSocketIndex, direction.IN)
  if (!state) {
    return []
  }
  const postCopyState = { ...state }
  postCopyState.write_offset = (postCopyState.write_offset + amount) % (postCopyState.buffer_size || 1)
  const deliveries: PlannedMonitorDelivery[] = []
  for (const monitor of consumer.monitors) {
    if (hasMonitorFlag(monitor.config.flags, monitor_flag.BUFFER_STATE)) {
      deliveries.push({
        monitor,
        typeName: 'process_socket_state_event',
        header: {
          _type: 'process_socket_state_event',
          process: consumer.id,
          socket: consumerSocketIndex,
          direction: direction.IN,
          buffer_size: postCopyState.buffer_size,
          read_offset: postCopyState.read_offset,
          write_offset: postCopyState.write_offset,
        },
      })
    }
    if (hasMonitorFlag(monitor.config.flags, monitor_flag.BUFFER_DATA) && amount > 0) {
      deliveries.push({
        monitor,
        typeName: 'process_socket_state_event',
        header: {
          _type: 'process_socket_state_event',
          process: consumer.id,
          socket: consumerSocketIndex,
          direction: direction.IN,
          buffer_size: postCopyState.buffer_size,
          read_offset: postCopyState.read_offset,
          write_offset: postCopyState.write_offset,
        },
        trailingPayload: new Uint8Array(amount),
      })
    }
  }
  return deliveries
}

export function pumpTransfer(
  producer: Process,
  producerSocketIndex: number,
  consumer: Process,
  consumerSocketIndex: number,
  emitter: ProcessMonitorEmitter,
  backpressure: MonitorSocketBackpressure
): number {
  const amount = computePumpAmount(
    producer,
    producerSocketIndex,
    consumer,
    consumerSocketIndex,
    emitter,
    backpressure
  )
  if (amount <= 0) {
    return 0
  }

  const producerSocket = producer.getSocket(producerSocketIndex)!
  const consumerSocket = consumer.getSocket(consumerSocketIndex)!
  const payload = needsCopyPayload(producer, consumer)
    ? peekOutputBytes(producerSocket, amount)
    : undefined

  const preMessages = [
    ...planCopyMessages(producer, producerSocketIndex, consumer, consumerSocketIndex, amount, payload),
    ...planDataMessages(consumer, consumerSocketIndex),
  ]
  emitPlanned(emitter, preMessages)

  const copied = producerSocket.outputBuffer.copyTo(consumerSocket.inputBuffer)
  if (copied <= 0) {
    return 0
  }

  const producerState = readBufferState(producer, producerSocketIndex, direction.OUT)
  if (producerState) {
    emitPlanned(emitter, planSocketStateMessages(
      producer,
      producerSocketIndex,
      direction.OUT,
      monitor_flag.BUFFER_STATE
    ))
    updateBufferStateCache(producer, producerSocketIndex, direction.OUT, producerState)
  }

  requestData(consumer, consumerSocketIndex)

  queueMicrotask(() => {
    const consumerInState = readBufferState(consumer, consumerSocketIndex, direction.IN)
    if (consumerInState) {
      emitPlanned(emitter, planSocketStateMessages(
        consumer,
        consumerSocketIndex,
        direction.IN,
        monitor_flag.BUFFER_STATE
      ))
      updateBufferStateCache(consumer, consumerSocketIndex, direction.IN, consumerInState)
    }

    maybeRequestDrain(producer, producerSocketIndex, emitter, backpressure)
  })

  return copied
}

function maybeRequestDrain(
  producer: Process,
  producerSocketIndex: number,
  emitter: ProcessMonitorEmitter,
  backpressure: MonitorSocketBackpressure
): void {
  const producerSocket = producer.getSocket(producerSocketIndex)
  if (!producerSocket) {
    return
  }
  const readable = producerSocket.outputBuffer.readableBytes()
  const threshold = (producerSocket as unknown as { getOptions?: () => { drainEventThreshold: number } }).getOptions?.().drainEventThreshold ?? 0
  if (readable > threshold) {
    return
  }

  const drainMessages: PlannedMonitorDelivery[] = []
  for (const monitor of producer.monitors) {
    if (hasMonitorFlag(monitor.config.flags, monitor_flag.DRAIN)) {
      drainMessages.push({
        monitor,
        typeName: 'process_drain_event',
        header: {
          _type: 'process_drain_event',
          process: producer.id,
          socket: producerSocketIndex,
          direction: direction.OUT,
        },
      })
    }
  }
  const postDrainState = planSocketStateMessages(
    producer,
    producerSocketIndex,
    direction.OUT,
    monitor_flag.BUFFER_STATE
  )
  const allDrain = [...drainMessages, ...postDrainState]
  if (!allDeliveriesFit(emitter, backpressure, allDrain)) {
    return
  }
  emitPlanned(emitter, drainMessages)
  requestDrain(producer, producerSocketIndex)
  queueMicrotask(() => {
    const state = readBufferState(producer, producerSocketIndex, direction.OUT)
    if (state) {
      emitPlanned(emitter, planSocketStateMessages(
        producer,
        producerSocketIndex,
        direction.OUT,
        monitor_flag.BUFFER_STATE
      ))
      updateBufferStateCache(producer, producerSocketIndex, direction.OUT, state)
    }
  })
}

export function pumpInputDrain(
  process: Process,
  socketIndex: number,
  emitter: ProcessMonitorEmitter,
  backpressure: MonitorSocketBackpressure
): number {
  if (process.runtime.isPumpPaused()) {
    return 0
  }
  const connection = process.socketConnections[socketIndex]
  const fromConn = connection?.connectedFrom
  if (!fromConn) {
    return 0
  }
  return pumpTransfer(
    fromConn.process,
    fromConn.socketIndex,
    process,
    socketIndex,
    emitter,
    backpressure
  )
}

export function pumpFlush(
  process: Process,
  socketIndex: number,
  emitter: ProcessMonitorEmitter,
  backpressure: MonitorSocketBackpressure
): number {
  if (process.runtime.isPumpPaused()) {
    return 0
  }
  const connection = process.socketConnections[socketIndex]
  const toConn = connection?.connectedTo
  if (!toConn) {
    return 0
  }
  return pumpTransfer(
    process,
    socketIndex,
    toConn.process,
    toConn.socketIndex,
    emitter,
    backpressure
  )
}

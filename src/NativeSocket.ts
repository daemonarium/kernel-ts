import type { Socket } from '@daemonarium/rpc'
import type { NativeProcessAddon, NativeProcessHandle } from './NativeProcessAddon.js'
import { NativeCircularBuffer } from './NativeCircularBuffer.js'

export const SOCKET_FLAG_OPEN = 0x01
export const SOCKET_FLAG_READABLE = 0x02
export const SOCKET_FLAG_WRITABLE = 0x04
export const SOCKET_FLAG_ERROR = 0x08

export interface NativeSocketOptions {
  inputBufferSize: number
  outputBufferSize: number
  flushThreshold?: number
  dataEventThreshold?: number
  drainEventThreshold?: number
  flags?: number
  dataEventCallback?: (dataSize: number) => void
  drainEventCallback?: (dataSize: number) => void
  flushCallback?: (socket: number) => void
  drainCallback?: (socket: number) => void
}

/**
 * Process-centric Socket over a native_process circular_buffer pair.
 */
export class NativeSocket implements Socket {
  public readonly inputBuffer: NativeCircularBuffer
  public readonly outputBuffer: NativeCircularBuffer

  private flags: number
  private flushThreshold: number
  private dataEventThreshold: number
  private drainEventThreshold: number
  private dataEventCallback?: (dataSize: number) => void
  private drainEventCallback?: (dataSize: number) => void
  private flushCallback?: (socket: number) => void
  private drainCallback?: (socket: number) => void
  private addon: NativeProcessAddon
  private handle: NativeProcessHandle

  constructor(
    public readonly index: number,
    addon: NativeProcessAddon,
    handle: NativeProcessHandle,
    options: NativeSocketOptions
  ) {
    this.addon = addon
    this.handle = handle
    this.flags = (options.flags ?? 0) | SOCKET_FLAG_OPEN | SOCKET_FLAG_READABLE | SOCKET_FLAG_WRITABLE
    this.flushThreshold = options.flushThreshold ?? 64
    this.dataEventThreshold = options.dataEventThreshold ?? 0
    this.drainEventThreshold = options.drainEventThreshold ?? 4
    this.dataEventCallback = options.dataEventCallback
    this.drainEventCallback = options.drainEventCallback
    this.flushCallback = options.flushCallback
    this.drainCallback = options.drainCallback

    this.inputBuffer = new NativeCircularBuffer(addon, handle, index, 'input')
    this.outputBuffer = new NativeCircularBuffer(addon, handle, index, 'output')
  }

  isOpen(): boolean {
    return (this.flags & SOCKET_FLAG_OPEN) !== 0 && this.addon.isSocketOpen(this.handle, this.index)
  }

  getFlags(): number {
    return this.flags
  }

  setFlags(flags: number): void {
    this.flags = flags
  }

  isReadable(): boolean {
    return (this.flags & SOCKET_FLAG_READABLE) !== 0
  }

  isWritable(): boolean {
    return (this.flags & SOCKET_FLAG_WRITABLE) !== 0
  }

  hasError(): boolean {
    return (this.flags & SOCKET_FLAG_ERROR) !== 0
  }

  readableBytes(): number {
    return this.inputBuffer.readableBytes()
  }

  writableBytes(): number {
    return this.outputBuffer.writableBytes()
  }

  read(destination: Uint8Array, bytes: number): number {
    return this.inputBuffer.read(destination, bytes)
  }

  write(source: Uint8Array | ArrayBufferView, bytes: number): number {
    const written = this.outputBuffer.write(source, bytes)
    if (written > 0 && this.outputBuffer.readableBytes() >= this.flushThreshold) {
      this.flush()
    }
    return written
  }

  peek(offset: number, destination: Uint8Array, bytes: number): number {
    return this.inputBuffer.peek(offset, destination, bytes)
  }

  poke(offset: number, source: Uint8Array, bytes: number): number {
    return this.outputBuffer.poke(offset, source, bytes)
  }

  skipRead(bytes: number): number {
    return this.inputBuffer.skipRead(bytes)
  }

  commitWrite(bytes: number): number {
    const committed = this.outputBuffer.commitWrite(bytes)
    if (committed > 0 && this.outputBuffer.readableBytes() >= this.flushThreshold) {
      this.flush()
    }
    return committed
  }

  readUVarInt(): { value: number | bigint, bytesRead: number } {
    return this.inputBuffer.readUVarInt()
  }

  writeUVarInt(value: number | bigint): number {
    const written = this.outputBuffer.writeUVarInt(value)
    if (written > 0 && this.outputBuffer.readableBytes() >= this.flushThreshold) {
      this.flush()
    }
    return written
  }

  readSVarInt(): { value: number | bigint, bytesRead: number } {
    return this.inputBuffer.readSVarInt()
  }

  writeSVarInt(value: number | bigint): number {
    const written = this.outputBuffer.writeSVarInt(value)
    if (written > 0 && this.outputBuffer.readableBytes() >= this.flushThreshold) {
      this.flush()
    }
    return written
  }

  flush(): void {
    if (this.flushCallback) {
      this.flushCallback(this.index)
    } else {
      this.addon.flush(this.handle, this.index)
    }
  }

  drain(): void {
    if (this.drainCallback) {
      this.drainCallback(this.index)
    } else {
      this.addon.drain(this.handle, this.index)
    }
  }

  handleData(): void {
    const dataSize = this.inputBuffer.readableBytes()
    if (this.dataEventCallback && dataSize >= this.dataEventThreshold) {
      this.dataEventCallback(dataSize)
    }
  }

  handleDrain(): void {
    const dataSize = this.outputBuffer.readableBytes()
    if (this.drainEventCallback && dataSize <= this.drainEventThreshold) {
      this.drainEventCallback(dataSize)
    }
  }

  getOptions(): { drainEventThreshold: number, flushThreshold: number } {
    return {
      drainEventThreshold: this.drainEventThreshold,
      flushThreshold: this.flushThreshold,
    }
  }

  markClosed(): void {
    this.flags = this.flags & ~SOCKET_FLAG_OPEN
  }
}

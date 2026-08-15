/**
 * Contract implemented by every native-host N-API addon (.node).
 * M addons × N service types × many instances.
 */

export type NativeProcessHandle = object

export type BufferDirection = 'input' | 'output'

export interface BufferRef {
  /** External view over C circular_buffer_data (may be invalidated after grow/close). */
  externalArrayBuffer: ArrayBuffer
  byteOffset: number
  size: number
}

export interface NativeProcessAddon {
  createNativeProcess(
    serviceType: string,
    id: number,
    socketCount: number,
    opts?: { dataDir?: string, bufSize?: number }
  ): NativeProcessHandle

  openSocket(handle: NativeProcessHandle, index: number, bufSize: number): void
  closeSocket(handle: NativeProcessHandle, index: number): void
  isSocketOpen(handle: NativeProcessHandle, index: number): boolean

  handleData(handle: NativeProcessHandle, index: number): void
  handleDrain(handle: NativeProcessHandle, index: number): void
  flush(handle: NativeProcessHandle, index: number): void
  drain(handle: NativeProcessHandle, index: number): void

  setFlushCallback(
    handle: NativeProcessHandle,
    callback: (socket: number) => void
  ): void
  setDrainCallback(
    handle: NativeProcessHandle,
    callback: (socket: number) => void
  ): void

  registerSocketHandler(
    handle: NativeProcessHandle,
    index: number,
    dataFn: (socket: number) => void,
    drainFn?: (socket: number) => void
  ): void

  kill(handle: NativeProcessHandle): void
  isAlive(handle: NativeProcessHandle): boolean
  id(handle: NativeProcessHandle): number
  socketCount(handle: NativeProcessHandle): number

  inputBufferRef(handle: NativeProcessHandle, index: number): BufferRef
  outputBufferRef(handle: NativeProcessHandle, index: number): BufferRef

  bufferReadableBytes(
    handle: NativeProcessHandle,
    index: number,
    direction: BufferDirection
  ): number
  bufferWritableBytes(
    handle: NativeProcessHandle,
    index: number,
    direction: BufferDirection
  ): number
  bufferCapacity(
    handle: NativeProcessHandle,
    index: number,
    direction: BufferDirection
  ): number
  bufferGetSize(
    handle: NativeProcessHandle,
    index: number,
    direction: BufferDirection
  ): number
  bufferGetReadOffset(
    handle: NativeProcessHandle,
    index: number,
    direction: BufferDirection
  ): number
  bufferSetReadOffset(
    handle: NativeProcessHandle,
    index: number,
    direction: BufferDirection,
    offset: number
  ): void
  bufferGetWriteOffset(
    handle: NativeProcessHandle,
    index: number,
    direction: BufferDirection
  ): number
  bufferSetWriteOffset(
    handle: NativeProcessHandle,
    index: number,
    direction: BufferDirection,
    offset: number
  ): void

  bufferWrite(
    handle: NativeProcessHandle,
    index: number,
    direction: BufferDirection,
    source: Uint8Array | ArrayBufferView,
    bytes: number
  ): number
  bufferRead(
    handle: NativeProcessHandle,
    index: number,
    direction: BufferDirection,
    destination: Uint8Array,
    bytes: number
  ): number
  bufferPeek(
    handle: NativeProcessHandle,
    index: number,
    direction: BufferDirection,
    offset: number,
    destination: Uint8Array,
    bytes: number
  ): number
  bufferPoke(
    handle: NativeProcessHandle,
    index: number,
    direction: BufferDirection,
    offset: number,
    source: Uint8Array | ArrayBufferView,
    bytes: number
  ): number
  bufferSkipRead(
    handle: NativeProcessHandle,
    index: number,
    direction: BufferDirection,
    bytes: number
  ): number
  bufferCommitWrite(
    handle: NativeProcessHandle,
    index: number,
    direction: BufferDirection,
    bytes: number
  ): number
  bufferClear(
    handle: NativeProcessHandle,
    index: number,
    direction: BufferDirection
  ): void

  /** Readable segments as external Uint8Array views (no copy). */
  bufferReadableViews(
    handle: NativeProcessHandle,
    index: number,
    direction: BufferDirection,
    maxBytes: number
  ): Uint8Array[]

  copyToNative(
    destHandle: NativeProcessHandle,
    destSocket: number,
    destDirection: BufferDirection,
    srcHandle: NativeProcessHandle,
    srcSocket: number,
    srcDirection: BufferDirection
  ): number

  listServices(): string[]
}

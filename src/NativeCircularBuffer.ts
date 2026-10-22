import type { CircularBuffer } from '@daemonarium/rpc'
import type {
  BufferDirection,
  NativeProcessAddon,
  NativeProcessHandle,
} from './NativeProcessAddon.js'

/**
 * CircularBuffer backed by a C circular_buffer inside a native_process.
 * All ring ops go through the addon (correct on 64-bit where C HEADER_SIZE
 * logic differs from physical size_t header layout).
 *
 * copyTo is one-hop:
 * - native→native: addon.copyToNative (C→C)
 * - native→JS: readable external views + dest.write (one memcpy)
 * - JS→native: LocalCircularBuffer.copyTo calls this.write (one memcpy into C)
 */
export class NativeCircularBuffer implements CircularBuffer {
  readonly addon: NativeProcessAddon
  readonly handle: NativeProcessHandle
  readonly socketIndex: number
  readonly direction: BufferDirection

  constructor(
    addon: NativeProcessAddon,
    handle: NativeProcessHandle,
    socketIndex: number,
    direction: BufferDirection
  ) {
    this.addon = addon
    this.handle = handle
    this.socketIndex = socketIndex
    this.direction = direction
  }

  getSize(): number {
    return this.addon.bufferGetSize(this.handle, this.socketIndex, this.direction)
  }

  getReadOffset(): number {
    return this.addon.bufferGetReadOffset(this.handle, this.socketIndex, this.direction)
  }

  setReadOffset(offset: number): void {
    this.addon.bufferSetReadOffset(this.handle, this.socketIndex, this.direction, offset)
  }

  getWriteOffset(): number {
    return this.addon.bufferGetWriteOffset(this.handle, this.socketIndex, this.direction)
  }

  setWriteOffset(offset: number): void {
    this.addon.bufferSetWriteOffset(this.handle, this.socketIndex, this.direction, offset)
  }

  readableBytes(): number {
    return this.addon.bufferReadableBytes(this.handle, this.socketIndex, this.direction)
  }

  writableBytes(): number {
    return this.addon.bufferWritableBytes(this.handle, this.socketIndex, this.direction)
  }

  capacity(): number {
    return this.addon.bufferCapacity(this.handle, this.socketIndex, this.direction)
  }

  write(source: Uint8Array | ArrayBufferView, bytes: number): number {
    return this.addon.bufferWrite(
      this.handle, this.socketIndex, this.direction, source, bytes
    )
  }

  read(destination: Uint8Array, bytes: number): number {
    return this.addon.bufferRead(
      this.handle, this.socketIndex, this.direction, destination, bytes
    )
  }

  peek(offset: number, destination: Uint8Array, bytes: number): number {
    return this.addon.bufferPeek(
      this.handle, this.socketIndex, this.direction, offset, destination, bytes
    )
  }

  poke(offset: number, source: Uint8Array | ArrayBufferView, bytes: number): number {
    return this.addon.bufferPoke(
      this.handle, this.socketIndex, this.direction, offset, source, bytes
    )
  }

  skipRead(bytes: number): number {
    return this.addon.bufferSkipRead(
      this.handle, this.socketIndex, this.direction, bytes
    )
  }

  commitWrite(bytes: number): number {
    return this.addon.bufferCommitWrite(
      this.handle, this.socketIndex, this.direction, bytes
    )
  }

  clear(): void {
    this.addon.bufferClear(this.handle, this.socketIndex, this.direction)
  }

  copyTo(destination: CircularBuffer): number {
    if (destination instanceof NativeCircularBuffer) {
      return this.addon.copyToNative(
        destination.handle,
        destination.socketIndex,
        destination.direction,
        this.handle,
        this.socketIndex,
        this.direction
      )
    }

    const copyBytes = Math.min(this.readableBytes(), destination.writableBytes())
    if (copyBytes <= 0) {
      return 0
    }

    const views = this.addon.bufferReadableViews(
      this.handle, this.socketIndex, this.direction, copyBytes
    )
    let written = 0
    for (const view of views) {
      written += destination.write(view, view.byteLength)
    }
    if (written > 0) {
      this.skipRead(written)
    }
    return written
  }

  // --- varints (same encoding as LocalCircularBuffer; use peek/poke) ---

  readUVarInt(): { value: number | bigint, bytesRead: number } {
    const result = this.peekUVarInt(0)
    if (result.bytesRead > 0) {
      this.skipRead(result.bytesRead)
    }
    return result
  }

  peekUVarInt(offset: number): { value: number | bigint, bytesRead: number } {
    const number = new Uint8Array(9)
    const firstRead = this.peek(offset, number, 1)
    if (firstRead === 0) return { value: 0, bytesRead: 0 }

    const first = number[0]
    if ((first & 0x80) === 0) {
      return { value: first, bytesRead: 1 }
    }
    if ((first & 0x40) === 0) {
      if (this.peek(offset + 1, number.subarray(1), 1) === 0) return { value: 0, bytesRead: 0 }
      return { value: ((first & 0x3F) << 8) | number[1], bytesRead: 2 }
    }
    if ((first & 0x20) === 0) {
      if (this.peek(offset + 1, number.subarray(1), 2) === 0) return { value: 0, bytesRead: 0 }
      return { value: ((first & 0x1F) << 16) | (number[1] << 8) | number[2], bytesRead: 3 }
    }
    if ((first & 0x10) === 0) {
      if (this.peek(offset + 1, number.subarray(1), 3) === 0) return { value: 0, bytesRead: 0 }
      return {
        value: ((first & 0x0F) << 24) | (number[1] << 16) | (number[2] << 8) | number[3],
        bytesRead: 4
      }
    }
    if ((first & 0x08) === 0) {
      if (this.peek(offset + 1, number.subarray(1), 4) === 0) return { value: 0, bytesRead: 0 }
      const valueBig = (BigInt(first & 0x07) << 32n)
        | (BigInt(number[1]) << 24n)
        | (BigInt(number[2]) << 16n)
        | (BigInt(number[3]) << 8n)
        | BigInt(number[4])
      return {
        value: valueBig <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(valueBig) : valueBig,
        bytesRead: 5
      }
    }
    if ((first & 0x04) === 0) {
      if (this.peek(offset + 1, number.subarray(1), 5) === 0) return { value: 0, bytesRead: 0 }
      const valueBig = (BigInt(first & 0x03) << 40n)
        | (BigInt(number[1]) << 32n)
        | (BigInt(number[2]) << 24n)
        | (BigInt(number[3]) << 16n)
        | (BigInt(number[4]) << 8n)
        | BigInt(number[5])
      return {
        value: valueBig <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(valueBig) : valueBig,
        bytesRead: 6
      }
    }
    if ((first & 0x02) === 0) {
      if (this.peek(offset + 1, number.subarray(1), 6) === 0) return { value: 0, bytesRead: 0 }
      const valueBig = (BigInt(first & 0x01) << 48n)
        | (BigInt(number[1]) << 40n)
        | (BigInt(number[2]) << 32n)
        | (BigInt(number[3]) << 24n)
        | (BigInt(number[4]) << 16n)
        | (BigInt(number[5]) << 8n)
        | BigInt(number[6])
      return {
        value: valueBig <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(valueBig) : valueBig,
        bytesRead: 7
      }
    }
    if ((first & 0x01) === 0) {
      if (this.peek(offset + 1, number.subarray(1), 7) === 0) return { value: 0, bytesRead: 0 }
      const valueBig = (BigInt(number[1]) << 48n)
        | (BigInt(number[2]) << 40n)
        | (BigInt(number[3]) << 32n)
        | (BigInt(number[4]) << 24n)
        | (BigInt(number[5]) << 16n)
        | (BigInt(number[6]) << 8n)
        | BigInt(number[7])
      return {
        value: valueBig <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(valueBig) : valueBig,
        bytesRead: 8
      }
    }
    if (this.peek(offset + 1, number.subarray(1), 8) === 0) return { value: 0, bytesRead: 0 }
    const valueBig = (BigInt(number[1]) << 56n)
      | (BigInt(number[2]) << 48n)
      | (BigInt(number[3]) << 40n)
      | (BigInt(number[4]) << 32n)
      | (BigInt(number[5]) << 24n)
      | (BigInt(number[6]) << 16n)
      | (BigInt(number[7]) << 8n)
      | BigInt(number[8])
    return {
      value: valueBig <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(valueBig) : valueBig,
      bytesRead: 9
    }
  }

  writeUVarInt(value: number | bigint): number {
    return this._writeUVarInt(value)
  }

  private _writeUVarInt(value: number | bigint): number {
    const bytes = this.pokeUVarInt(0, value)
    if (bytes > 0) {
      this.commitWrite(bytes)
    }
    return bytes
  }

  pokeUVarInt(offset: number, value: number | bigint): number {
    const v = typeof value === 'bigint' ? value : BigInt(value)
    const buf = new Uint8Array(9)
    let len = 0
    if (v < 0x80n) {
      buf[0] = Number(v)
      len = 1
    } else if (v < 0x4000n) {
      buf[0] = Number((v >> 8n) | 0x80n)
      buf[1] = Number(v & 0xffn)
      len = 2
    } else if (v < 0x200000n) {
      buf[0] = Number((v >> 16n) | 0xc0n)
      buf[1] = Number((v >> 8n) & 0xffn)
      buf[2] = Number(v & 0xffn)
      len = 3
    } else if (v < 0x10000000n) {
      buf[0] = Number((v >> 24n) | 0xe0n)
      buf[1] = Number((v >> 16n) & 0xffn)
      buf[2] = Number((v >> 8n) & 0xffn)
      buf[3] = Number(v & 0xffn)
      len = 4
    } else if (v < 0x800000000n) {
      buf[0] = Number((v >> 32n) | 0xf0n)
      buf[1] = Number((v >> 24n) & 0xffn)
      buf[2] = Number((v >> 16n) & 0xffn)
      buf[3] = Number((v >> 8n) & 0xffn)
      buf[4] = Number(v & 0xffn)
      len = 5
    } else if (v < 0x40000000000n) {
      buf[0] = Number((v >> 40n) | 0xf8n)
      buf[1] = Number((v >> 32n) & 0xffn)
      buf[2] = Number((v >> 24n) & 0xffn)
      buf[3] = Number((v >> 16n) & 0xffn)
      buf[4] = Number((v >> 8n) & 0xffn)
      buf[5] = Number(v & 0xffn)
      len = 6
    } else if (v < 0x2000000000000n) {
      buf[0] = Number((v >> 48n) | 0xfcn)
      buf[1] = Number((v >> 40n) & 0xffn)
      buf[2] = Number((v >> 32n) & 0xffn)
      buf[3] = Number((v >> 24n) & 0xffn)
      buf[4] = Number((v >> 16n) & 0xffn)
      buf[5] = Number((v >> 8n) & 0xffn)
      buf[6] = Number(v & 0xffn)
      len = 7
    } else if (v < 0x100000000000000n) {
      buf[0] = 0xfe
      buf[1] = Number((v >> 48n) & 0xffn)
      buf[2] = Number((v >> 40n) & 0xffn)
      buf[3] = Number((v >> 32n) & 0xffn)
      buf[4] = Number((v >> 24n) & 0xffn)
      buf[5] = Number((v >> 16n) & 0xffn)
      buf[6] = Number((v >> 8n) & 0xffn)
      buf[7] = Number(v & 0xffn)
      len = 8
    } else {
      buf[0] = 0xff
      buf[1] = Number((v >> 56n) & 0xffn)
      buf[2] = Number((v >> 48n) & 0xffn)
      buf[3] = Number((v >> 40n) & 0xffn)
      buf[4] = Number((v >> 32n) & 0xffn)
      buf[5] = Number((v >> 24n) & 0xffn)
      buf[6] = Number((v >> 16n) & 0xffn)
      buf[7] = Number((v >> 8n) & 0xffn)
      buf[8] = Number(v & 0xffn)
      len = 9
    }
    return this.poke(offset, buf, len) === len ? len : 0
  }

  readSVarInt(): { value: number | bigint, bytesRead: number } {
    const result = this.peekSVarInt(0)
    if (result.bytesRead > 0) {
      this.skipRead(result.bytesRead)
    }
    return result
  }

  peekSVarInt(offset: number): { value: number | bigint, bytesRead: number } {
    const u = this.peekUVarInt(offset)
    if (u.bytesRead === 0) return u
    const uv = typeof u.value === 'bigint' ? u.value : BigInt(u.value)
    const signed = (uv & 1n) === 0n ? (uv >> 1n) : -((uv >> 1n) + 1n)
    return {
      value: signed <= BigInt(Number.MAX_SAFE_INTEGER) && signed >= BigInt(Number.MIN_SAFE_INTEGER)
        ? Number(signed)
        : signed,
      bytesRead: u.bytesRead
    }
  }

  writeSVarInt(value: number | bigint): number {
    const v = typeof value === 'bigint' ? value : BigInt(value)
    const zigzag = v < 0n ? ((-v) << 1n) - 1n : (v << 1n)
    return this._writeUVarInt(zigzag)
  }

  pokeSVarInt(offset: number, value: number | bigint): number {
    const v = typeof value === 'bigint' ? value : BigInt(value)
    const zigzag = v < 0n ? ((-v) << 1n) - 1n : (v << 1n)
    return this.pokeUVarInt(offset, zigzag)
  }

  peekUVarInt32(offset: number): { value: number, bytesRead: number } {
    const r = this.peekUVarInt(offset)
    return { value: Number(r.value), bytesRead: r.bytesRead }
  }

  pokeUVarInt32(offset: number, value: number): number {
    return this.pokeUVarInt(offset, value >>> 0)
  }

  peekSVarInt32(offset: number): { value: number, bytesRead: number } {
    const r = this.peekSVarInt(offset)
    return { value: Number(r.value), bytesRead: r.bytesRead }
  }

  pokeSVarInt32(offset: number, value: number): number {
    return this.pokeSVarInt(offset, value | 0)
  }

  peekUVarInt16(offset: number): { value: number, bytesRead: number } {
    return this.peekUVarInt32(offset)
  }

  pokeUVarInt16(offset: number, value: number): number {
    return this.pokeUVarInt32(offset, value & 0xffff)
  }

  peekSVarInt16(offset: number): { value: number, bytesRead: number } {
    return this.peekSVarInt32(offset)
  }

  pokeSVarInt16(offset: number, value: number): number {
    return this.pokeSVarInt32(offset, value)
  }
}

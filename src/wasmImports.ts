import type Process from './Process.js'
import { pumpFlush, pumpInputDrain } from './pump.js'

export interface WasiProcessHost {
  id: number
  memory?: WebAssembly.Memory
  stdout: string
  stderr: string
}

export function wasiImports(process: WasiProcessHost) {
  const decoder = new TextDecoder()

  function readIovs(iovsPtr: number, iovsLen: number): string {
    const mem = new DataView(process.memory!.buffer)
    const bytes = new Uint8Array(process.memory!.buffer)
    let totalStr = ''
    for (let i = 0; i < iovsLen; i++) {
      const base = iovsPtr + i * 8
      const buf = mem.getUint32(base, true)
      const bufLen = mem.getUint32(base + 4, true)
      totalStr += decoder.decode(bytes.slice(buf, buf + bufLen))
    }
    return totalStr
  }

  return {
    fd_write(fd: number, iovsPtr: number, iovsLen: number, nwrittenPtr: number): number {
      const str = readIovs(iovsPtr, iovsLen)
      const mem = new DataView(process.memory!.buffer)
      const byteLength = new TextEncoder().encode(str).length
      mem.setUint32(nwrittenPtr, byteLength, true)
      if (fd === 1) {
        process.stdout += str
        if (str.includes('\n')) {
          const lines = process.stdout.split('\n')
          for (let i = 0; i < lines.length - 1; i++) {
            console.log(`[${process.id}] ${lines[i]}`)
          }
          process.stdout = lines[lines.length - 1]
        }
      } else if (fd === 2) {
        process.stderr += str
        if (str.includes('\n')) {
          const lines = process.stderr.split('\n')
          for (let i = 0; i < lines.length - 1; i++) {
            console.error(`[${process.id}] ${lines[i]}`)
          }
          process.stderr = lines[lines.length - 1]
        }
      }
      return 0
    },
    fd_read(_fd: number, _iovsPtr: number, _iovsLen: number, nreadPtr: number): number {
      const mem = new DataView(process.memory!.buffer)
      mem.setUint32(nreadPtr, 0, true)
      return 0
    },
    fd_seek(_fd: number, _offsetLow: number, _offsetHigh: number, _whence: number, newoffsetPtr: number): number {
      const mem = new DataView(process.memory!.buffer)
      mem.setUint32(newoffsetPtr, 0, true)
      mem.setUint32(newoffsetPtr + 4, 0, true)
      return 0
    },
    fd_close(_fd: number): number {
      return 0
    },
    environ_sizes_get(countPtr: number, bufSizePtr: number): number {
      const mem = new DataView(process.memory!.buffer)
      mem.setUint32(countPtr, 0, true)
      mem.setUint32(bufSizePtr, 0, true)
      return 0
    },
    environ_get(_environPtr: number, _environBufPtr: number): number {
      return 0
    },
    clock_time_get(_clockId: number, _precision: bigint | number, timePtr: number): number {
      const mem = new DataView(process.memory!.buffer)
      const ns = BigInt(Math.round(performance.now() * 1e6))
      mem.setBigUint64(timePtr, ns, true)
      return 0
    },
  }
}

export function wasmImports(process: Process) {
  const emitter = process.kernel.monitorEmitter
  const backpressure = process.kernel.monitorBackpressure
  return {
    waos_socket_flush(socket: number) {
      try {
        pumpFlush(process, socket, emitter, backpressure)
      } catch (error) {
        process.handleError(error instanceof Error ? error : new Error(String(error)))
      }
    },
    waos_socket_input_drain(socket: number) {
      try {
        pumpInputDrain(process, socket, emitter, backpressure)
      } catch (error) {
        console.error(`  [drain] pid=${process.id} socket=${socket} ERROR:`, error)
        process.handleError(error instanceof Error ? error : new Error(String(error)))
      }
    },
    waos_use_mana(mana: number) {
      process.useMana(mana)
    }
  }
}

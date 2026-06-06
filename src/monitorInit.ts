import type Process from './Process.js'
import type { ProcessMonitor } from './Process.js'
import type { ProcessMonitorEmitter } from './ProcessMonitorEmitter.js'
import { direction, monitor_flag } from './kernelApi.js'
import { hasMonitorFlag } from './monitorFlags.js'
import type { LocalProcess } from './LocalProcess.js'
import type { ModuleProcess } from './ModuleProcess.js'

function listOpenSocketIndices(process: Process): number[] {
  if ('localSockets' in process) {
    const local = process as LocalProcess
    return local.localSockets.getOpenSockets().map(s => s.index)
  }
  if ('moduleSockets' in process) {
    const mod = process as ModuleProcess
    if (!mod.moduleSockets) {
      return []
    }
    const indices: number[] = []
    for (let i = 0; i < mod.moduleSockets.getSize(); i++) {
      if (mod.getSocket(i)) {
        indices.push(i)
      }
    }
    return indices
  }
  return []
}

function peekBufferData(
  process: Process,
  socketIndex: number,
  dir: direction,
  maxBytes: number
): Uint8Array | undefined {
  const socket = process.getSocket(socketIndex)
  if (!socket) {
    return undefined
  }
  const buffer = dir === direction.OUT ? socket.outputBuffer : socket.inputBuffer
  const readable = Math.min(buffer.readableBytes(), maxBytes)
  if (readable <= 0) {
    return undefined
  }
  const out = new Uint8Array(readable)
  buffer.peek(0, out, readable)
  return out
}

export function emitInitialBufferStates(
  target: Process,
  monitorEntry: ProcessMonitor,
  emitter: ProcessMonitorEmitter
): void {
  const socketIndices = listOpenSocketIndices(target)
  for (const socketIndex of socketIndices) {
    for (const dir of [direction.IN, direction.OUT]) {
      const socket = target.getSocket(socketIndex)
      if (!socket) {
        continue
      }
      const buffer = dir === direction.OUT ? socket.outputBuffer : socket.inputBuffer
      const stateHeader = {
        _type: 'process_socket_state_event',
        process: target.id,
        socket: socketIndex,
        direction: dir,
        buffer_size: buffer.capacity(),
        read_offset: buffer.getReadOffset(),
        write_offset: buffer.getWriteOffset(),
      }

      if (hasMonitorFlag(monitorEntry.config.flags, monitor_flag.INITIAL_BUFFER_STATE)) {
        emitter.deliverEvent(monitorEntry, 'process_socket_state_event', stateHeader)
      }

      if (hasMonitorFlag(monitorEntry.config.flags, monitor_flag.INITIAL_BUFFER_DATA)) {
        const data = peekBufferData(target, socketIndex, dir, buffer.readableBytes())
        if (data && data.length > 0) {
          emitter.deliverEvent(monitorEntry, 'process_socket_state_event', stateHeader, data)
        }
      }

      target.runtime.bufferStateCache.set(`${socketIndex}:${dir}`, {
        buffer_size: stateHeader.buffer_size,
        read_offset: stateHeader.read_offset,
        write_offset: stateHeader.write_offset,
      })
    }
  }

  if (hasMonitorFlag(monitorEntry.config.flags, monitor_flag.MEMORY)) {
    const memory = target.get_memory()
    emitter.deliverEvent(monitorEntry, 'process_memory_event', {
      _type: 'process_memory_event',
      process: target.id,
      size: memory.byteLength,
    })
  }
}

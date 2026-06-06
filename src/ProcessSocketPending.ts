import type Process from './Process.js'
import type { ProcessRuntimeState } from './ProcessRuntimeState.js'

function getRuntime(process: Process): ProcessRuntimeState {
  return process.runtime
}

export function requestData(process: Process, socket: number): void {
  const runtime = getRuntime(process)
  runtime.pendingData.add(socket)
  scheduleTick(process)
}

export function requestDrain(process: Process, socket: number): void {
  const runtime = getRuntime(process)
  runtime.pendingDrain.add(socket)
  scheduleTick(process)
}

export function scheduleTick(process: Process): void {
  const runtime = getRuntime(process)
  if (runtime.tickScheduled) {
    return
  }
  runtime.tickScheduled = true
  queueMicrotask(() => processPending(process))
}

export function processPending(process: Process): void {
  const runtime = getRuntime(process)
  if (runtime.inFlight) {
    return
  }

  let socket: number | undefined
  if (runtime.pendingData.size > 0) {
    socket = Math.min(...runtime.pendingData)
    runtime.pendingData.delete(socket)
    runtime.inFlight = true
    try {
      process.handleData(socket)
    } finally {
      runtime.inFlight = false
      runtime.tickScheduled = false
      if (runtime.pendingData.size > 0 || runtime.pendingDrain.size > 0) {
        scheduleTick(process)
      }
    }
    return
  }

  if (runtime.pendingDrain.size > 0) {
    socket = Math.min(...runtime.pendingDrain)
    runtime.pendingDrain.delete(socket)
    runtime.inFlight = true
    try {
      process.handleDrain(socket)
    } finally {
      runtime.inFlight = false
      runtime.tickScheduled = false
      if (runtime.pendingData.size > 0 || runtime.pendingDrain.size > 0) {
        scheduleTick(process)
      }
    }
    return
  }

  runtime.tickScheduled = false
}

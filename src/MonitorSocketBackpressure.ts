import type Process from './Process.js'
import type { ProcessMonitor } from './Process.js'

export class MonitorSocketBackpressure {
  private waiters = new Map<string, Array<() => void>>()

  private key(processId: number, socket: number): string {
    return `${processId}:${socket}`
  }

  canFit(monitor: ProcessMonitor, frameSize: number): boolean {
    const socket = monitor.process.getSocket(monitor.socket)
    if (!socket) {
      return false
    }
    return socket.inputBuffer.writableBytes() >= frameSize
  }

  canFitProcess(process: Process, monitorSocket: number, frameSize: number): boolean {
    const socket = process.getSocket(monitorSocket)
    if (!socket) {
      return false
    }
    return socket.inputBuffer.writableBytes() >= frameSize
  }

  awaitSpace(monitor: ProcessMonitor, frameSize: number): Promise<void> {
    if (this.canFit(monitor, frameSize)) {
      return Promise.resolve()
    }
    const k = this.key(monitor.process.id, monitor.socket)
    return new Promise(resolve => {
      const tryResolve = () => {
        if (this.canFit(monitor, frameSize)) {
          resolve()
        } else {
          this.enqueueWaiter(k, tryResolve)
        }
      }
      this.enqueueWaiter(k, tryResolve)
    })
  }

  notifyInputConsumed(processId: number, socket: number): void {
    const k = this.key(processId, socket)
    const pending = this.waiters.get(k)
    if (!pending || pending.length === 0) {
      return
    }
    this.waiters.set(k, [])
    for (const waiter of pending) {
      waiter()
    }
  }

  private enqueueWaiter(key: string, waiter: () => void): void {
    if (!this.waiters.has(key)) {
      this.waiters.set(key, [])
    }
    this.waiters.get(key)!.push(waiter)
  }
}

import type { Kernel } from './kernel.js'
import Process, { SocketConnection, ProcessMonitor } from './Process.js'
import type { process_id, socket_id } from './types.js'
import { Direction } from './types.js'
import type {
  TypeRegistry,
  Socket,
  TypedValue,
} from '@wa-os/ts-rpc'
import type { process_killed_event, process_error_event } from './kernelApi.js'
import { ProcessRuntimeState } from './ProcessRuntimeState.js'
import type { MonitorConfig } from './monitorFlags.js'
import { DEFAULT_MONITOR_FLAGS } from './monitorFlags.js'
import { pumpFlush, pumpInputDrain } from './pump.js'
import type { NativeProcessAddon, NativeProcessHandle } from './NativeProcessAddon.js'
import { NativeSocket, type NativeSocketOptions } from './NativeSocket.js'

/**
 * Process implementation backed by a native_process inside an N-API addon.
 * Constructor takes (addon, serviceType) so M addons × N service types work.
 */
export class NativeProcess implements Process {
  kernel: Kernel
  id: process_id
  isAlive: boolean = true
  runtime = new ProcessRuntimeState()

  socketConnections: Array<SocketConnection> = []
  monitors: Array<ProcessMonitor> = []
  monitoredProcesses: Array<ProcessMonitor> = []

  rpcDescriptions?: Array<TypeRegistry> = []

  manaUsed: number = 0
  manaLimit: number = 1000000

  memory: Uint8Array = new Uint8Array(0)

  readonly addon: NativeProcessAddon
  readonly serviceType: string
  readonly handle: NativeProcessHandle
  readonly serviceOpts?: { dataDir?: string, bufSize?: number }

  private sockets: Array<NativeSocket | undefined> = []

  constructor(
    kernel: Kernel,
    id: process_id,
    manaLimit: number,
    socketCount: number,
    addon: NativeProcessAddon,
    serviceType: string,
    serviceOpts?: { dataDir?: string, bufSize?: number }
  ) {
    this.kernel = kernel
    this.id = id
    this.manaLimit = manaLimit
    this.addon = addon
    this.serviceType = serviceType
    this.serviceOpts = serviceOpts
    this.handle = addon.createNativeProcess(serviceType, id, socketCount, serviceOpts)

    addon.setFlushCallback(this.handle, (socket: number) => {
      try {
        pumpFlush(this, socket, this.kernel.monitorEmitter, this.kernel.monitorBackpressure)
      } catch (error) {
        this.handleError(error instanceof Error ? error : new Error(String(error)))
      }
    })
    addon.setDrainCallback(this.handle, (socket: number) => {
      try {
        pumpInputDrain(this, socket, this.kernel.monitorEmitter, this.kernel.monitorBackpressure)
      } catch (error) {
        this.handleError(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  pausePump(): void {
    this.runtime.pausePump()
  }

  resumePump(): void {
    this.runtime.resumePump()
  }

  isPumpPaused(): boolean {
    return this.runtime.isPumpPaused()
  }

  useMana(mana: number): void {
    this.manaUsed += mana
    if (this.manaUsed > this.manaLimit) {
      throw new Error(`Mana limit exceeded. Mana used: ${this.manaUsed}, mana limit: ${this.manaLimit}`)
    }
  }

  getRpcDescription(socket: socket_id = 0): TypeRegistry | undefined {
    return this.rpcDescriptions?.[socket]
  }

  setRpcDescription(socket: socket_id, registry: TypeRegistry): void {
    this.rpcDescriptions![socket] = registry
  }

  getSocket(index: socket_id): Socket | null {
    const socket = this.sockets[index]
    if (!socket || !socket.isOpen()) {
      return null
    }
    return socket
  }

  createSocket(index: number, options: NativeSocketOptions): NativeSocket {
    if (this.sockets[index] && this.sockets[index]!.isOpen()) {
      throw new Error(`Socket ${index} already open on native process ${this.id}`)
    }

    const bufSize = Math.max(options.inputBufferSize, options.outputBufferSize)
    this.addon.openSocket(this.handle, index, bufSize)

    const emitter = this.kernel.monitorEmitter
    const backpressure = this.kernel.monitorBackpressure
    const socket = new NativeSocket(index, this.addon, this.handle, {
      ...options,
      flushCallback: (socketIndex: number) => {
        try {
          pumpFlush(this, socketIndex, emitter, backpressure)
        } catch (error) {
          this.handleError(error instanceof Error ? error : new Error(String(error)))
        }
      },
      drainCallback: (socketIndex: number) => {
        try {
          pumpInputDrain(this, socketIndex, emitter, backpressure)
        } catch (error) {
          this.handleError(error instanceof Error ? error : new Error(String(error)))
        }
      },
    })
    this.sockets[index] = socket
    return socket
  }

  handleError(error: string | Error): void {
    const errorMessage = error instanceof Error ? error.message : error
    this.kernel.kill(this.id, errorMessage).catch((killError) => {
      console.error(`Failed to kill process ${this.id} after error:`, killError)
    })
  }

  handleData(socket_id: number): void {
    if (!this.isAlive) {
      return
    }
    this.addon.handleData(this.handle, socket_id)
    const socket = this.sockets[socket_id]
    if (socket) {
      socket.handleData()
    }
    this.kernel.monitorBackpressure.notifyInputConsumed(this.id, socket_id)
  }

  handleDrain(socket_id: number): void {
    if (!this.isAlive) {
      return
    }
    this.addon.handleDrain(this.handle, socket_id)
    const socket = this.sockets[socket_id]
    if (socket) {
      socket.handleDrain()
    }
  }

  serializeToSocket(socket: socket_id, value: TypedValue, _typeRegistry: TypeRegistry): void {
    this.kernel.monitorEmitter.deliverEvent(
      { process: this, socket, config: { flags: 0 } },
      value._type as string,
      value as object
    )
  }

  async kill(error: string | undefined): Promise<void> {
    if (!this.isAlive) {
      return
    }
    this.isAlive = false
    this.runtime.pendingData.clear()
    this.runtime.pendingDrain.clear()

    this.addon.kill(this.handle)

    for (const socket of this.sockets) {
      if (socket) {
        socket.markClosed()
      }
    }

    for (let i = 0; i < this.socketConnections.length; i++) {
      const connection = this.socketConnections[i]
      if (!connection) continue

      const connectedTo = connection.connectedTo
      if (connectedTo) {
        const targetConnection = connectedTo.process.socketConnections[connectedTo.socketIndex]
        if (targetConnection?.connectedFrom?.processId === this.id &&
            targetConnection.connectedFrom.socketIndex === i) {
          targetConnection.connectedFrom.process.socketConnections[targetConnection.connectedFrom.socketIndex] = undefined
          targetConnection.connectedFrom = undefined
        }
      }

      const connectedFrom = connection.connectedFrom
      if (connectedFrom) {
        const sourceConnection = connectedFrom.process.socketConnections[connectedFrom.socketIndex]
        if (sourceConnection?.connectedTo?.processId === this.id &&
            sourceConnection.connectedTo.socketIndex === i) {
          sourceConnection.connectedTo.process.socketConnections[sourceConnection.connectedTo.socketIndex] = undefined
          sourceConnection.connectedTo = undefined
        }
      }

      connection.connectedTo = undefined
      connection.connectedFrom = undefined
    }
    this.socketConnections = []

    const monitoredProcessesToRemove = [...this.monitoredProcesses]
    this.monitoredProcesses = []
    for (const monitoredProcess of monitoredProcessesToRemove) {
      try {
        monitoredProcess.process.removeMonitor(this, monitoredProcess.socket)
        this.kernel.releaseProcessIfDeadAndUnmonitored(monitoredProcess.process.id)
      } catch (removeMonitorError) {
        console.error(`Failed to remove monitor relation ${this.id} -> ${monitoredProcess.process.id}:`, removeMonitorError)
      }
    }

    const monitorsToNotify = [...this.monitors]
    if (monitorsToNotify.length > 0) {
      try {
        if (error !== undefined) {
          this.kernel.monitorEmitter.emitLifecycleEvent(this, 'process_error_event', {
            _type: 'process_error_event',
            process: this.id,
            error,
          } as TypedValue & process_error_event)
        } else {
          this.kernel.monitorEmitter.emitLifecycleEvent(this, 'process_killed_event', {
            _type: 'process_killed_event',
            process: this.id,
          } as TypedValue & process_killed_event)
        }
      } catch (notificationError) {
        console.error(`Failed to notify monitors for process ${this.id}:`, notificationError)
      }
    }
  }

  get_memory(): Uint8Array {
    return this.memory
  }

  bind(processTo: Process, socket_id: socket_id, socket_to: socket_id, direction: Direction): void {
    if (!this.isAlive) {
      throw new Error(`Process ${this.id} is not alive`)
    }
    if (!processTo.isAlive) {
      throw new Error(`Process ${processTo.id} is not alive`)
    }

    const thisSocket = this.getSocket(socket_id)
    const targetSocket = processTo.getSocket(socket_to)

    if (!thisSocket) {
      throw new Error(`Socket ${socket_id} not found in process ${this.id}`)
    }
    if (!targetSocket) {
      throw new Error(`Socket ${socket_to} not found in process ${processTo.id}`)
    }
    if (processTo === this) {
      throw new Error('Cannot bind socket to the same process')
    }

    if (!this.socketConnections[socket_id]) {
      this.socketConnections[socket_id] = new SocketConnection(thisSocket)
    }

    if (!processTo.socketConnections[socket_to]) {
      processTo.socketConnections[socket_to] = new SocketConnection(targetSocket)
    }

    const thisConnection = this.socketConnections[socket_id]
    const targetConnection = processTo.socketConnections[socket_to]

    if (direction === Direction.OUT || direction === Direction.BOTH) {
      thisConnection.connectedTo = {
        processId: processTo.id,
        socketIndex: socket_to,
        process: processTo,
        socket: targetSocket
      }
      targetConnection.connectedFrom = {
        processId: this.id,
        socketIndex: socket_id,
        process: this,
        socket: thisSocket
      }
    }

    if (direction === Direction.IN || direction === Direction.BOTH) {
      thisConnection.connectedFrom = {
        processId: processTo.id,
        socketIndex: socket_to,
        process: processTo,
        socket: targetSocket
      }
      targetConnection.connectedTo = {
        processId: this.id,
        socketIndex: socket_id,
        process: this,
        socket: thisSocket
      }
    }
  }

  unbind(processTo: Process, socket_id: socket_id, socket_to: socket_id, direction: Direction): void {
    const thisConnection = this.socketConnections[socket_id]
    const targetConnection = processTo.socketConnections[socket_to]

    if (!thisConnection) {
      throw new Error(`Socket connection ${socket_id} not found in process ${this.id}`)
    }
    if (!targetConnection) {
      throw new Error(`Socket connection ${socket_to} not found in process ${processTo.id}`)
    }

    let removedOut = false
    let removedIn = false

    if (direction === Direction.OUT || direction === Direction.BOTH) {
      if (thisConnection.connectedTo?.processId === processTo.id &&
          thisConnection.connectedTo?.socketIndex === socket_to) {
        thisConnection.connectedTo = undefined
        targetConnection.connectedFrom = undefined
        removedOut = true
      }
    }

    if (direction === Direction.IN || direction === Direction.BOTH) {
      if (thisConnection.connectedFrom?.processId === processTo.id &&
          thisConnection.connectedFrom?.socketIndex === socket_to) {
        thisConnection.connectedFrom = undefined
        targetConnection.connectedTo = undefined
        removedIn = true
      }
    }

    if (direction === Direction.OUT && !removedOut) {
      throw new Error(`No OUT binding found from process ${this.id} socket ${socket_id} to process ${processTo.id} socket ${socket_to}`)
    }
    if (direction === Direction.IN && !removedIn) {
      throw new Error(`No IN binding found from process ${processTo.id} socket ${socket_to} to process ${this.id} socket ${socket_id}`)
    }
    if (direction === Direction.BOTH && !removedOut && !removedIn) {
      throw new Error(`No BOTH binding found from process ${this.id} socket ${socket_id} to process ${processTo.id} socket ${socket_to}`)
    }
  }

  addMonitor(monitorProcess: Process, socket_id: socket_id, config: MonitorConfig): void {
    if (!this.isAlive) {
      throw new Error(`Process ${this.id} is not alive`)
    }

    const existingMonitor = this.monitors.find(
      m => m.process.id === monitorProcess.id && m.socket === socket_id
    )
    if (existingMonitor) {
      throw new Error(`Process ${monitorProcess.id} is already monitoring process ${this.id} on socket ${socket_id}`)
    }

    const monitorEntry = new ProcessMonitor(monitorProcess, socket_id, config)
    this.monitors.push(monitorEntry)
    this.kernel.onMonitorRelationAdded(this, monitorEntry)
  }

  removeMonitor(monitorProcess: Process, socket_id: socket_id): void {
    const monitorIndex = this.monitors.findIndex(
      m => m.process.id === monitorProcess.id && m.socket === socket_id
    )

    if (monitorIndex === -1) {
      throw new Error(`Process ${monitorProcess.id} is not monitoring process ${this.id} on socket ${socket_id}`)
    }

    this.monitors.splice(monitorIndex, 1)
  }

  monitor(process: Process, socket_id: socket_id, config: MonitorConfig = { flags: DEFAULT_MONITOR_FLAGS }): void {
    if (!this.isAlive) {
      throw new Error(`Process ${this.id} is not alive`)
    }
    if (!process.isAlive) {
      throw new Error(`Process ${process.id} is not alive`)
    }

    const socket = this.getSocket(socket_id)
    if (!socket) {
      throw new Error(`Socket ${socket_id} not found in process ${this.id}`)
    }

    const existingOutgoingMonitor = this.monitoredProcesses.find(
      m => m.process.id === process.id && m.socket === socket_id
    )
    if (existingOutgoingMonitor) {
      throw new Error(`Process ${this.id} is already monitoring process ${process.id} on socket ${socket_id}`)
    }

    process.addMonitor(this, socket_id, config)
    this.monitoredProcesses.push(new ProcessMonitor(process, socket_id, config))
  }

  demonitor(process: Process, socket_id: socket_id): void {
    const monitoredProcessIndex = this.monitoredProcesses.findIndex(
      m => m.process.id === process.id && m.socket === socket_id
    )

    if (monitoredProcessIndex === -1) {
      throw new Error(`Process ${this.id} is not monitoring process ${process.id} on socket ${socket_id}`)
    }

    process.removeMonitor(this, socket_id)
    this.monitoredProcesses.splice(monitoredProcessIndex, 1)
  }
}

export default NativeProcess

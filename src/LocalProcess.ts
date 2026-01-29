import type { Kernel } from './kernel.js'
import Process, { SocketConnection, SocketConnectionDestination, ProcessMonitor } from './Process.js'
import type { process_id, socket_id } from './types.js'
import { Direction } from './types.js'
import { 
  TypeRegistry, 
  Socket, 
  CircularBufferWriter, 
  CircularBufferReader,
  TypedValue, 
  CodecRegistry, 
  registerDynamicCodecs,
  LocalSockets,
  LocalSocket,
  SocketOptions,
  SOCKET_FLAG_READABLE,
  SOCKET_FLAG_WRITABLE
} from "@wa-os/ts-rpc"
import { serializeValueByType, deserializeValueByType } from "@wa-os/ts-rpc/src/valueSerialization.js"
import type { process_event_pointer_21, process_killed_event_22, process_error_event_24 } from './kernelApi.js'

interface SocketCallbacks {
  onMessage?: (socket: number, size: number, message: Uint8Array) => void
  onDrained?: (socket: number) => void
}

export class LocalProcess implements Process {
  kernel: Kernel
  id: process_id

  localSockets: LocalSockets
  socketConnections: Array<SocketConnection> = []
  monitors: Array<ProcessMonitor> = []

  rpcDescription?: TypeRegistry
  socketCallbacks: Map<number, SocketCallbacks> = new Map()

  manaUsed: number = 0
  manaLimit: number = 1000000

  constructor(kernel: Kernel, id: process_id, manaLimit: number = 1000000) {
    this.kernel = kernel
    this.id = id
    this.manaLimit = manaLimit
    this.localSockets = new LocalSockets()
  }

  useMana(mana: number): void {
    this.manaUsed += mana
    if (this.manaUsed > this.manaLimit) {
      throw new Error(`Mana limit exceeded. Mana used: ${this.manaUsed}, mana limit: ${this.manaLimit}`)
    }
  }

  getRpcDescription(): TypeRegistry | undefined {
    return this.rpcDescription
  }

  setRpcDescription(registry: TypeRegistry): void {
    this.rpcDescription = registry
  }

  getSocket(index: socket_id): Socket | null {
    return this.localSockets.getSocket(index)
  }

  createSocket(index: number, options: SocketOptions): LocalSocket {
    return this.localSockets.createSocket(index, options)
  }

  createSocketWithCallbacks(
    index: number,
    options: SocketOptions,
    onMessage?: (socket: number, size: number, message: Uint8Array) => void,
    onDrained?: (socket: number) => void
  ): LocalSocket {
    const socket = this.localSockets.createSocket(index, options)
    if (onMessage || onDrained) {
      this.socketCallbacks.set(socket.index, { onMessage, onDrained })
    }
    return socket
  }

  handleError(error: string | Error): void {
    const errorMessage = error instanceof Error ? error.message : error
    this.kernel.kill(this.id, errorMessage).catch((killError) => {
      console.error(`Failed to kill process ${this.id} after error:`, killError)
    })
  }

  handleData(socket_id: number): void {
    const socket = this.getSocket(socket_id)
    if (!socket) {
      return
    }

    const callbacks = this.socketCallbacks.get(socket_id)
    if (callbacks?.onMessage) {
      const readableBytes = socket.inputBuffer.readableBytes()
      if (readableBytes > 0) {
        const message = new Uint8Array(readableBytes)
        const bytesRead = socket.inputBuffer.read(message, readableBytes)
        if (bytesRead > 0) {
          callbacks.onMessage(socket_id, bytesRead, message)
        }
      }
    }
  }

  handleDrain(socket_id: number): void {
    const callbacks = this.socketCallbacks.get(socket_id)
    if (callbacks?.onDrained) {
      callbacks.onDrained(socket_id)
    }
  }

  serializeToSocket(socket: socket_id, value: TypedValue, typeRegistry: TypeRegistry): void {
    const socketInstance = this.localSockets.getSocket(socket)
    if (!socketInstance) {
      throw new Error(`Socket ${socket} not found in process ${this.id}`)
    }

    const type = typeRegistry.getTypeByName(value._type)
    if (!type) {
      throw new Error(`Type ${value._type} not found in type registry`)
    }

    const codecs = new CodecRegistry()
    registerDynamicCodecs(codecs, typeRegistry)

    const writer = new CircularBufferWriter(socketInstance.inputBuffer, codecs)
    // @ts-ignore - CircularBufferWriter implements the same interface as Writer
    serializeValueByType(writer, typeRegistry, type, value)
    writer.writeRest()

    this.handleData(socket)
  }

  sendMessage(socket: socket_id, value: TypedValue): void {
    if (!this.rpcDescription) {
      throw new Error('RPC description not set. Call setRpcDescription() first.')
    }
    this.serializeToSocket(socket, value, this.rpcDescription)
  }

  deserializeFromSocket(socketIndex: number, typeRegistry: TypeRegistry): TypedValue | null {
    const socket = this.getSocket(socketIndex)
    if (!socket) {
      return null
    }

    const readableBytes = socket.inputBuffer.readableBytes()
    if (readableBytes === 0) {
      return null
    }

    try {
      const codecs = new CodecRegistry()
      registerDynamicCodecs(codecs, typeRegistry)
      const reader = new CircularBufferReader(socket.inputBuffer, codecs)

      let result: TypedValue | null = null
      reader.readTyped<TypedValue>((value) => {
        result = value as TypedValue
      })

      return result
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)))
      return null
    }
  }

  async kill(error: string | undefined): Promise<void> {
    for (let i = 0; i < this.socketConnections.length; i++) {
      const connection = this.socketConnections[i]
      if (connection) {
        connection.connectedTo = undefined
        connection.connectedFrom = undefined
      }
    }
    this.socketConnections = []

    const monitorsToNotify = [...this.monitors]
    this.monitors = []

    if (monitorsToNotify.length > 0) {
      try {
        const typeRegistry = this.kernel.createRpcRegistry()

        let event: TypedValue
        if (error !== undefined) {
          event = {
            _type: 'process_error_event',
            process: this.id,
            error: error
          } as TypedValue & process_error_event_24
        } else {
          event = {
            _type: 'process_killed_event',
            process: this.id
          } as TypedValue & process_killed_event_22
        }

        const eventPointer: TypedValue & process_event_pointer_21 = {
          _type: 'process_event_pointer',
          event_pointer: event
        }

        for (const monitor of monitorsToNotify) {
          try {
            if (monitor.process && monitor.process.getSocket(monitor.socket)) {
              monitor.process.serializeToSocket(monitor.socket, eventPointer, typeRegistry)
            }
          } catch (monitorError) {
            console.error(`Failed to notify monitor process ${monitor.process.id} on socket ${monitor.socket}:`, monitorError)
          }
        }
      } catch (notificationError) {
        console.error(`Failed to notify monitors for process ${this.id}:`, notificationError)
      }
    }
  }

  get_memory(): Uint8Array {
    return new Uint8Array(0)
  }

  bind(processTo: Process, socket_id: socket_id, socket_to: socket_id, direction: Direction): void {
    const thisSocket = this.localSockets.getSocket(socket_id)
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
    }

    if (direction === Direction.IN || direction === Direction.BOTH) {
      thisConnection.connectedFrom = {
        processId: processTo.id,
        socketIndex: socket_to,
        process: processTo,
        socket: targetSocket
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
        removedOut = true
      }
    }

    if (direction === Direction.IN || direction === Direction.BOTH) {
      if (thisConnection.connectedFrom?.processId === processTo.id && 
          thisConnection.connectedFrom?.socketIndex === socket_to) {
        thisConnection.connectedFrom = undefined
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

  monitor(process: Process, socket_id: socket_id): void {
    const socket = this.localSockets.getSocket(socket_id)
    if (!socket) {
      throw new Error(`Socket ${socket_id} not found in process ${this.id}`)
    }

    const existingMonitor = process.monitors.find(
      m => m.process.id === this.id && m.socket === socket_id
    )
    if (existingMonitor) {
      throw new Error(`Process ${this.id} is already monitoring process ${process.id} on socket ${socket_id}`)
    }

    process.monitors.push(new ProcessMonitor(this, socket_id))
  }

  demonitor(process: Process, socket_id: socket_id): void {
    const monitorIndex = process.monitors.findIndex(
      m => m.process.id === this.id && m.socket === socket_id
    )
    
    if (monitorIndex === -1) {
      throw new Error(`Process ${this.id} is not monitoring process ${process.id} on socket ${socket_id}`)
    }

    process.monitors.splice(monitorIndex, 1)
  }
}

export default LocalProcess

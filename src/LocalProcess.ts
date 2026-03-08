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

export class LocalProcess implements Process {
  kernel: Kernel
  id: process_id

  localSockets: LocalSockets
  socketConnections: Array<SocketConnection> = []
  monitors: Array<ProcessMonitor> = []

  rpcDescriptions?: Array<TypeRegistry> = []

  manaUsed: number = 0
  manaLimit: number = 1000000

  memory: Uint8Array = new Uint8Array(0) // memory used for testing

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

  getRpcDescription(socket: socket_id = 0): TypeRegistry | undefined {
    return this.rpcDescriptions?.[socket]
  }

  setRpcDescription(socket: socket_id, registry: TypeRegistry): void {
    this.rpcDescriptions![socket] = registry
  }

  getSocket(index: socket_id): Socket | null {
    return this.localSockets.getSocket(index)
  }

  createSocket(index: number, options: SocketOptions): LocalSocket {
    const socketOptions = {
      ...options,
      flushCallback: (socket: number) => {
        try {
          const socketConnection = this.socketConnections[socket]
          if (socketConnection?.connectedTo) {
            const copiedBytes = socketConnection.socket.outputBuffer
              .copyTo(socketConnection.connectedTo.socket.inputBuffer)
            if (copiedBytes > 0) {
              /// TODO: use scheduler when under load
              socketConnection.connectedTo.process.handleData(socketConnection.connectedTo.socket.index)
            }
          }
        } catch (error) {
          this.handleError(error instanceof Error ? error : new Error(String(error)))
        }
      },
      drainCallback: (socket: number) => {
        try {
          const socketConnection = this.socketConnections[socket]
          const fromConn = socketConnection?.connectedFrom
          if (fromConn) {
            const srcReadable = fromConn.socket.outputBuffer.readableBytes()
            const dstWritable = socketConnection.socket.inputBuffer.writableBytes()
            const copiedBytes = fromConn.socket.outputBuffer
              .copyTo(socketConnection.socket.inputBuffer)
            console.log(`  [bridge drain] socket=${socket} srcReadable=${srcReadable} dstWritable=${dstWritable} copied=${copiedBytes}`)
            if (copiedBytes > 0) {
              this.handleData(socket)
            }
          } else {
            console.log(`  [bridge drain] socket=${socket} NO connectedFrom`)
          }
        } catch (error) {
          console.error(`  [bridge drain] socket=${socket} ERROR:`, error)
          this.handleError(error instanceof Error ? error : new Error(String(error)))
        }
      }
    } as SocketOptions
    return this.localSockets.createSocket(index, socketOptions)
  }

  handleError(error: string | Error): void {
    const errorMessage = error instanceof Error ? error.message : error
    this.kernel.kill(this.id, errorMessage).catch((killError) => {
      console.error(`Failed to kill process ${this.id} after error:`, killError)
    })
  }

  handleData(socket_id: number): void {
    const localSocket = this.localSockets.getSocket(socket_id)
    if (!localSocket) {
      return
    }
/*     const bytesInBuffer = new Uint8Array(localSocket.inputBuffer.readableBytes())
    localSocket.inputBuffer.peek(0, bytesInBuffer, localSocket.inputBuffer.readableBytes())     
    console.log(`[LocalProcess handleData] pid=${this.id} socket=${socket_id} bytesInBuffer=${bytesInBuffer.length}`)
    for(let i = 0; i < bytesInBuffer.length; i+=16) {        
      console.log(`  ${i.toString(16).padStart(4, '0')}:`, Array.from(bytesInBuffer.subarray(i, i + 16)).map(b => b.toString(16).padStart(2, '0')).join(' '))
    } */
    localSocket.handleData()
  }

  handleDrain(socket_id: number): void {
    const localSocket = this.localSockets.getSocket(socket_id)
    if (!localSocket) {
      return
    }
    localSocket.handleDrain()
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
    if (!this.getRpcDescription(socket)) {
      throw new Error('RPC description not set. Call setRpcDescription() first.')
    }
    this.serializeToSocket(socket, value, this.getRpcDescription(socket))
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
    return this.memory
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

import type { Kernel } from './kernel.js'
import Process, { SocketConnection, ProcessMonitor } from './Process.js'
import type { SocketConnectionDestination } from './Process.js'

import type { 
  DatabaseBackend, process_id, socket_id, module_id, Range, BatchOperation, 
} from './types.js'
import { Direction } from './types.js'
import { toHex } from './utils.js'
import { TypeRegistry, deserializeTypeRegistry, ModuleSockets, Socket, CircularBufferWriter, TypedValue, CodecRegistry, registerDynamicCodecs } from "@wa-os/ts-rpc";
import { serializeValueByType } from "@wa-os/ts-rpc/src/valueSerialization.js";
import type { process_event_pointer_21, process_killed_event_22, process_error_event_24 } from './kernelApi.js'

export { SocketConnection, SocketConnectionDestination, ProcessMonitor }

function wasiImports(process: ModuleProcess) {
  const decoder = new TextDecoder()

  function readIovs(iovsPtr: number, iovsLen: number): string {
    const mem = new DataView(process.memory!.buffer)
    const bytes = new Uint8Array(process.memory!.buffer)
    let totalStr = ''
    let totalWritten = 0
    for (let i = 0; i < iovsLen; i++) {
      const base = iovsPtr + i * 8
      const buf = mem.getUint32(base, true)
      const bufLen = mem.getUint32(base + 4, true)
      totalStr += decoder.decode(bytes.slice(buf, buf + bufLen))
      totalWritten += bufLen
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
    fd_read(fd: number, iovsPtr: number, iovsLen: number, nreadPtr: number): number {
      const mem = new DataView(process.memory!.buffer)
      mem.setUint32(nreadPtr, 0, true)
      return 0
    },
    fd_seek(fd: number, offsetLow: number, offsetHigh: number, whence: number, newoffsetPtr: number): number {
      const mem = new DataView(process.memory!.buffer)
      mem.setUint32(newoffsetPtr, 0, true)
      mem.setUint32(newoffsetPtr + 4, 0, true)
      return 0
    },
    fd_close(fd: number): number {
      return 0
    },
    environ_sizes_get(countPtr: number, bufSizePtr: number): number {
      const mem = new DataView(process.memory!.buffer)
      mem.setUint32(countPtr, 0, true)
      mem.setUint32(bufSizePtr, 0, true)
      return 0
    },
    environ_get(environPtr: number, environBufPtr: number): number {
      return 0
    },
  }
}

function wasmImports(process: ModuleProcess) {
  return {
    waos_socket_flush(socket: number) {
      //debugger;
      try {
        const socketConnection = process.socketConnections[socket]
        if(socketConnection?.connectedTo) {
          const copiedBytes = socketConnection.socket.outputBuffer
            .copyTo(socketConnection.connectedTo.socket.inputBuffer)
          if(copiedBytes > 0) {
            /// TODO: use scheduler when under load
            socketConnection.connectedTo.process.handleData(socketConnection.connectedTo.socket.index)
          }
        }
      } catch (error) {
        process.handleError(error instanceof Error ? error : new Error(String(error)))
      }
    },
    waos_socket_input_drain(socket: number) {
      try {
        const socketConnection = process.socketConnections[socket]
        const fromConn = socketConnection?.connectedFrom
        if(fromConn) {
          const srcReadable = fromConn.socket.outputBuffer.readableBytes()
          const dstWritable = socketConnection.socket.inputBuffer.writableBytes()
          const copiedBytes = fromConn.socket.outputBuffer
            .copyTo(socketConnection.socket.inputBuffer)
          console.log(`  [drain] pid=${process.id} socket=${socket} srcReadable=${srcReadable} dstWritable=${dstWritable} copied=${copiedBytes}`)
          if(copiedBytes > 0) {
            process.handleData(socket)
          }
        } else {
          console.log(`  [drain] pid=${process.id} socket=${socket} NO connectedFrom (connectedTo=${!!socketConnection?.connectedTo})`)
        }
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

export class ModuleProcess implements Process {

  kernel: Kernel
  id: process_id
  maximumMemoryPages: number

  module?: WebAssembly.Module
  memory?: WebAssembly.Memory
  imports: WebAssembly.Imports  
  instance?: WebAssembly.Instance  

  moduleSockets?: ModuleSockets
  socketConnections: Array<SocketConnection> = []
  monitors: Array<ProcessMonitor> = []

  rpcDescription?: TypeRegistry
  
  manaUsed: number = 0
  manaLimit: number = 1000000

  stdout: string = ''
  stderr: string = ''

  constructor(kernel: Kernel, id: process_id, maximumMemoryPages: number = 2048, manaLimit: number = 1000000) {
    this.kernel = kernel
    this.id = id
    this.maximumMemoryPages = maximumMemoryPages
    this.manaUsed = 0
    this.manaLimit = manaLimit
  }

  /** set the module code directly from binary data */
  async setModuleCode(code: Uint8Array): Promise<void> {
    this.module = new WebAssembly.Module(code as BufferSource)
  }

  /**
   * Sets the process memory from a snapshot.
   * 
   * @param memorySnapshot - The memory state to restore as a Uint8Array
   * 
   * This method should restore the process memory state from the provided snapshot.
   * This is typically used for process persistence and state restoration.
   */
  async setMemory(memorySnapshot: Uint8Array): Promise<void> {
    const requiredPages = Math.ceil(memorySnapshot.length / 65536)
    if(requiredPages > this.maximumMemoryPages) {
      throw new Error(`Memory snapshot is too large.`
        +` Maximum memory pages is ${this.maximumMemoryPages} but required ${requiredPages}`)
    }
    if(this.memory) {
      this.memory.grow(requiredPages)
    } else {
      this.memory = new WebAssembly.Memory({ initial: requiredPages, maximum: this.maximumMemoryPages })
    }
    const memory = new Uint8Array(this.memory.buffer)
    memory.set(memorySnapshot, 0)
  }

  /**
   * Uses mana for the process.
   * 
   * @param mana - The amount of mana to use
   * 
   * This method should use the specified amount of mana for the process.
   * If the mana limit is exceeded, an error should be thrown.
   */
  useMana(mana: number) {
    this.manaUsed += mana
    if(this.manaUsed > this.manaLimit) {      
      throw new Error(`Mana limit exceeded. Mana used: ${this.manaUsed}, mana limit: ${this.manaLimit}`)
    }
  }

  /**
   * Starts the process execution.
   * This method should initialize the process runtime and begin executing any loaded modules.
   * The process should be ready to receive messages and handle requests after this method completes.
   */
  async start(): Promise<void> {
    try {
      if(!this.memory) {
        this.memory = new WebAssembly.Memory({ initial: Math.max(1024, this.maximumMemoryPages), maximum: this.maximumMemoryPages })
      }
      if(!this.module) throw new Error('Module not loaded')

      this.imports = {
        env: {
          memory: this.memory,
        },
        waos: wasmImports(this) as unknown as Record<string, any>
      }

      // Add WASI imports if the module requires them
      const moduleImports = WebAssembly.Module.imports(this.module)
      const needsWasi = moduleImports.some(i => i.module === 'wasi_snapshot_preview1')
      if (needsWasi) {
        this.imports['wasi_snapshot_preview1'] = wasiImports(this) as unknown as Record<string, any>
      }
      const needsEmscripten = moduleImports.some(i => i.name === 'emscripten_notify_memory_growth')
      if (needsEmscripten) {
        ;(this.imports['env'] as Record<string, any>)['emscripten_notify_memory_growth'] = () => {}
      }

      try {
        this.instance = new WebAssembly.Instance(this.module, this.imports)
      } catch (error) {
        console.error('Error instantiating module', error)
        console.error('module imports', WebAssembly.Module.imports(this.module))
        console.error('imports', this.imports)        
        throw error
      }
      
      try {
        //@ts-ignore
        this.instance.exports._initialize()
      } catch (error) {
        this.handleError(error instanceof Error ? error : new Error(String(error)))
        throw error
      }

      try {
        //@ts-ignore
        this.instance.exports.start()
      } catch (error) {
        this.handleError(error instanceof Error ? error : new Error(String(error)))
        throw error
      }

      // initialize sockets view
      this.moduleSockets = await ModuleSockets.fromInstance(this.instance, this.memory)
      
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  readRawRpcDescription(socket: socket_id = 0): Uint8Array {
    try {
      if (!this.instance) {
        throw new Error('Process instance not initialized')
      }
      /// call exported malloc to create space for returned pointer
      const malloc = this.instance.exports.malloc as ((size: number) => number) | undefined
      if (!malloc) {
        throw new Error('malloc not exported from WASM module')
      }
      const pointer = malloc(4)
      if (!pointer) {
        throw new Error('Failed to allocate memory for rpc description')
      }
      /// call exported rpc_description to get the description
      const rpcDescription = this.instance.exports.rpc_description as ((socket: number, pointer: number) => number) | undefined
      if (!rpcDescription) {
        throw new Error('rpc_description not exported from WASM module')
      }
      const descriptionSize = rpcDescription(socket, pointer)
      if (!descriptionSize) {
        throw new Error('Failed to get rpc description')
      }
      /// read the description pointer from the memory
      const descriptionPointer = new Uint32Array(this.memory!.buffer, pointer, 1)[0]
      if (!descriptionPointer) {
        throw new Error('Failed to read description pointer')
      }
      /// read the description from the memory by copying it to a new array buffer
      return new Uint8Array(this.memory!.buffer, descriptionPointer, descriptionSize)
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  getRpcDescription(socket: socket_id = 0): TypeRegistry | undefined {
    if(this.rpcDescription) return this.rpcDescription
    if(!this.instance?.exports.rpc_description) return undefined

    this.rpcDescription = deserializeTypeRegistry(this.readRawRpcDescription(socket))
    if (this.rpcDescription) {
      this.rpcDescription.assignMethodIds()
    }
    return this.rpcDescription
  }

  getSocket(index: socket_id): Socket | null {
    if (!this.moduleSockets) {
      return null
    }
    return this.moduleSockets.getSocket(index)
  }

  /**
   * Handles errors that occur during process execution.
   * This method will kill the process through the kernel.
   * 
   * @param error - The error message or error object
   */
  handleError(error: string | Error): void {
    const errorMessage = error instanceof Error ? error.message : error
    // Call kernel.kill asynchronously to avoid blocking
    this.kernel.kill(this.id, errorMessage).catch((killError) => {
      console.error(`Failed to kill process ${this.id} after error:`, killError)
    })
  }

  /**
   * Handles data available on a socket.
   * Called when data is flushed from another process to this process's socket input buffer.
   * 
   * @param socket_id - The socket identifier where data is available
   */
  handleData(socket_id: number): void {
    try {
      if (!this.instance) {
        throw new Error('Process instance not initialized')
      }
      const handleData = this.instance.exports.waos_socket_data as (socket: number) => void | undefined
      if (!handleData) {
        throw new Error('waos_socket_data not exported from WASM module')
      }
      const socketBuffer = this.moduleSockets.getSocket(socket_id)!.inputBuffer
      const bytesInBuffer = new Uint8Array(socketBuffer?.readableBytes() ?? 0)
      /* socketBuffer.peek(0, bytesInBuffer, socketBuffer.readableBytes())     
      console.log(`[handleData] pid=${this.id} socket=${socket_id} bytesInBuffer=${bytesInBuffer.length}`)
      for(let i = 0; i < bytesInBuffer.length; i+=16) {        
        console.log(`${i.toString(16).padStart(4, '0')}:`, Array.from(bytesInBuffer.subarray(i, i + 16)).map(b => b.toString(16).padStart(2, '0')).join(' '))
      }
      console.log("BUFFER SIZE:", socketBuffer.getSize(), "READ OFFSET:", socketBuffer.getReadOffset(), "WRITE OFFSET:", socketBuffer.getWriteOffset()) */
      handleData(socket_id)
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Handles drain request on a socket.
   * Called when another process requests to drain data from this process's socket.
   * 
   * @param socket_id - The socket identifier to drain
   */
  handleDrain(socket_id: number): void {
    try {
      if (!this.instance) {
        throw new Error('Process instance not initialized')
      }
      const handleDrain = this.instance.exports.waos_socket_output_drain as (socket: number) => void | undefined
      if (!handleDrain) {
        throw new Error('waos_socket_output_drain not exported from WASM module')
      }
      handleDrain(socket_id)
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Serializes a typed value and writes it to a socket's input buffer.
   * 
   * @param socket - The socket identifier where the value should be written
   * @param value - The typed value to serialize
   * @param typeRegistry - The type registry for serialization
   * 
   * This helper method handles serialization and writing to a socket's input buffer,
   * then triggers the process to handle the data.
   */
  serializeToSocket(socket: socket_id, value: TypedValue, typeRegistry: TypeRegistry): void {
    if (!this.moduleSockets) {
      throw new Error('Process not started - moduleSockets not initialized')
    }

    const socketInstance = this.moduleSockets.getSocket(socket)
    if (!socketInstance) {
      throw new Error(`Socket ${socket} not found in process ${this.id}`)
    }

    // Get the type description for the value
    const type = typeRegistry.getTypeByName(value._type)
    if (!type) {
      throw new Error(`Type ${value._type} not found in type registry`)
    }

    // Create CodecRegistry and register dynamic codecs for the registry
    const codecs = new CodecRegistry()
    registerDynamicCodecs(codecs, typeRegistry)

    // Create CircularBufferWriter wrapping the socket's input buffer
    const writer = new CircularBufferWriter(socketInstance.inputBuffer, codecs)

    // Serialize the value (CircularBufferWriter has same interface as Writer)
    // @ts-ignore - CircularBufferWriter implements the same interface as Writer
    serializeValueByType(writer, typeRegistry, type, value)

    // Finalize serialization (handle any pending pointers)
    writer.writeRest()

    // Trigger handleData on the process for the socket to process the event
    this.handleData(socket)
  }

  /**
   * Destroys the process and releases all associated resources.
   * This method should clean up all memory, connections, modules, and other resources
   * associated with this process. After destruction, the process should not be usable.
   */
  async kill(error: string | undefined): Promise<void> {
    // Clean up all socket connections
    for (let i = 0; i < this.socketConnections.length; i++) {
      const connection = this.socketConnections[i]
      if (connection) {
        // Clear connections
        connection.connectedTo = undefined
        connection.connectedFrom = undefined
      }
    }
    this.socketConnections = []

    // Notify all monitors
    const monitorsToNotify = [...this.monitors]
    this.monitors = []

    if (monitorsToNotify.length > 0) {
      try {
        // Get TypeRegistry from kernel
        const typeRegistry = this.kernel.createRpcRegistry()

        // Create the appropriate event object
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

        // Wrap the event in process_event_pointer
        const eventPointer: TypedValue & process_event_pointer_21 = {
          _type: 'process_event_pointer',
          event_pointer: event
        }

        // Notify each monitor
        for (const monitor of monitorsToNotify) {
          try {
            // Check if monitor process still exists and is valid
            if (monitor.process && monitor.process.getSocket(monitor.socket)) {
              monitor.process.serializeToSocket(monitor.socket, eventPointer, typeRegistry)
            }
          } catch (monitorError) {
            // Log but don't fail - monitor process may have been killed
            console.error(`Failed to notify monitor process ${monitor.process.id} on socket ${monitor.socket}:`, monitorError)
          }
        }
      } catch (notificationError) {
        // Log but don't fail - cleanup should continue
        console.error(`Failed to notify monitors for process ${this.id}:`, notificationError)
      }
    }
  }

  /**
   * Gets a snapshot of the current process memory state.
   * 
   * @returns A Uint8Array containing the current memory state of the process
   * 
   * This method should capture the current memory state of the process, which can be
   * used for persistence or state transfer. The snapshot should be complete and
   * sufficient to restore the process state later.
   */
  get_memory(): Uint8Array {
    if(!this.memory) throw new Error('Memory not initialized')
    return new Uint8Array(this.memory.buffer)
  }

  /**
   * Binds a socket from this process to a socket in another process.
   * 
   * @param processTo - The target process to bind to
   * @param socket_id - The socket identifier in this process
   * @param socket_to - The socket identifier in the target process
   * @param direction - The direction of communication (IN, OUT, or BOTH)
   * 
   * This method should establish a communication socket between this process and the target process.
   * Messages sent on the specified sockets will be routed according to the direction parameter.
   */
  bind(processTo: Process, socket_id: socket_id, socket_to: socket_id, direction: Direction): void {
    if (!this.moduleSockets) {
      throw new Error('Process not started - moduleSockets not initialized')
    }
    const targetSocket = processTo.getSocket(socket_to)
    if (!targetSocket) {
      throw new Error(`Socket ${socket_to} not found in process ${processTo.id}`)
    }
    if (processTo === this) {
      throw new Error('Cannot bind socket to the same process')
    }

    // Get sockets for both socket indices
    const thisSocket = this.moduleSockets.getSocket(socket_id)

    if (!thisSocket) {
      throw new Error(`Socket ${socket_id} not found in process ${this.id}`)
    }
    if (!targetSocket) {
      throw new Error(`Socket ${socket_to} not found in process ${processTo.id}`)
    }

    // Ensure SocketConnection exists for this socket
    if (!this.socketConnections[socket_id]) {
      this.socketConnections[socket_id] = new SocketConnection(thisSocket)
    }

    // Ensure SocketConnection exists for target socket
    if (!processTo.socketConnections[socket_to]) {
      processTo.socketConnections[socket_to] = new SocketConnection(targetSocket)
    }

    const thisConnection = this.socketConnections[socket_id]
    const targetConnection = processTo.socketConnections[socket_to]

    // Set up connections based on direction
    if (direction === Direction.OUT || direction === Direction.BOTH) {
      // Connect this process output -> target process input
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
      // Connect target process output -> this process input
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

  /**
   * Unbinds a socket binding between this process and another process.
   * 
   * @param processTo - The target process to unbind from
   * @param socket_id - The socket identifier in this process
   * @param socket_to - The socket identifier in the target process
   * @param direction - The direction of communication to unbind (IN, OUT, or BOTH)
   * 
   * This method should remove the communication socket binding. Messages will no longer
   * be routed between the specified sockets after unbinding.
   */
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

    // Remove connections based on direction
    if (direction === Direction.OUT || direction === Direction.BOTH) {
      // Remove this process output -> target process input connection
      if (thisConnection.connectedTo?.processId === processTo.id && 
          thisConnection.connectedTo?.socketIndex === socket_to) {
        thisConnection.connectedTo = undefined
        targetConnection.connectedFrom = undefined
        removedOut = true
      }
    }

    if (direction === Direction.IN || direction === Direction.BOTH) {
      // Remove target process output -> this process input connection
      if (thisConnection.connectedFrom?.processId === processTo.id && 
          thisConnection.connectedFrom?.socketIndex === socket_to) {
        thisConnection.connectedFrom = undefined
        targetConnection.connectedTo = undefined
        removedIn = true
      }
    }

    // Verify that at least one connection was removed
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

  /**
   * Sets up monitoring of another process's socket.
   * 
   * @param process - The process to monitor
   * @param socket_id - The socket identifier where notifications will be sent
   *    
   * When process is destroyed this process will receive a notification.
   */
  monitor(process: Process, socket_id: socket_id): void {
    if (!this.moduleSockets) {
      throw new Error('This process not started - moduleSockets not initialized')
    }
    
    // Validate that the socket exists in this process
    const socket = this.moduleSockets.getSocket(socket_id)
    if (!socket) {
      throw new Error(`Socket ${socket_id} not found in process ${this.id}`)
    }

    // Check for duplicate monitoring entry
    const existingMonitor = process.monitors.find(
      m => m.process.id === this.id && m.socket === socket_id
    )
    if (existingMonitor) {
      throw new Error(`Process ${this.id} is already monitoring process ${process.id} on socket ${socket_id}`)
    }

    // Add monitor entry to the target process
    process.monitors.push(new ProcessMonitor(this, socket_id))
  }

  /**
   * Removes monitoring of another process's socket.
   * 
   * @param process - The process to stop monitoring
   * @param socket_id - The socket identifier where notifications were sent
   * 
   * This process will no longer receive notifications when the process is destroyed.
   */
  demonitor(process: Process, socket_id: socket_id): void {
    const monitorIndex = process.monitors.findIndex(
      m => m.process.id === this.id && m.socket === socket_id
    )
    
    if (monitorIndex === -1) {
      throw new Error(`Process ${this.id} is not monitoring process ${process.id} on socket ${socket_id}`)
    }

    // Remove monitor entry from the target process
    process.monitors.splice(monitorIndex, 1)
  }

}

export default ModuleProcess
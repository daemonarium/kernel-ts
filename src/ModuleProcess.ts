import type { Kernel } from './kernel.js'
import Process, { SocketConnection, ProcessMonitor } from './Process.js'
import type { SocketConnectionDestination } from './Process.js'

import type { 
  DatabaseBackend, process_id, socket_id, module_id, Range, BatchOperation, 
} from './types.js'
import { Direction } from './types.js'
import { toHex } from './utils.js'
import {
  TypeRegistry,
  deserializeTypeRegistry,
  ModuleSockets,
  Socket,
  TypedValue,
} from "@wa-os/ts-rpc";
import type { process_killed_event, process_error_event } from './kernelApi.js'
import { ProcessRuntimeState } from './ProcessRuntimeState.js'
import type { MonitorConfig } from './monitorFlags.js'
import { DEFAULT_MONITOR_FLAGS } from './monitorFlags.js'
import { wasiImports, wasmImports } from './wasmImports.js'

export { SocketConnection, SocketConnectionDestination, ProcessMonitor }

export class ModuleProcess implements Process {

  kernel: Kernel
  id: process_id
  isAlive: boolean = true
  runtime = new ProcessRuntimeState()
  maximumMemoryPages: number

  module?: WebAssembly.Module
  memory?: WebAssembly.Memory
  imports: WebAssembly.Imports  
  instance?: WebAssembly.Instance  

  moduleSockets?: ModuleSockets
  socketConnections: Array<SocketConnection> = []
  monitors: Array<ProcessMonitor> = []
  monitoredProcesses: Array<ProcessMonitor> = []

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

  pausePump(): void {
    this.runtime.pausePump()
  }

  resumePump(): void {
    this.runtime.resumePump()
  }

  isPumpPaused(): boolean {
    return this.runtime.isPumpPaused()
  }

  /** set the module code directly from binary data */
  async setModuleCode(code: Uint8Array): Promise<void> {
    // Async compile: browsers disallow sync WebAssembly.Module for buffers > 8MB.
    this.module = await WebAssembly.compile(code as BufferSource)
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
        this.memory = new WebAssembly.Memory({ initial: this.maximumMemoryPages, maximum: this.maximumMemoryPages })
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
        // Async instantiate mirrors compile — large modules must not block the main thread.
        this.instance = await WebAssembly.instantiate(this.module, this.imports)
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

  /**
   * Soft read of rpc_description for inspection APIs.
   * Returns empty bytes on any failure and never calls handleError / kill.
   */
  readRawRpcDescriptionOrEmpty(socket: socket_id = 0): Uint8Array {
    try {
      if (!this.instance || !this.memory) {
        return new Uint8Array(0)
      }
      const malloc = this.instance.exports.malloc as ((size: number) => number) | undefined
      const rpcDescription = this.instance.exports.rpc_description as
        ((socket: number, pointer: number) => number) | undefined
      if (!malloc || !rpcDescription) {
        return new Uint8Array(0)
      }
      const pointer = malloc(4)
      if (!pointer) {
        return new Uint8Array(0)
      }
      const descriptionSize = rpcDescription(socket, pointer)
      if (!descriptionSize) {
        return new Uint8Array(0)
      }
      const descriptionPointer = new Uint32Array(this.memory.buffer, pointer, 1)[0]
      if (!descriptionPointer) {
        return new Uint8Array(0)
      }
      return new Uint8Array(this.memory.buffer, descriptionPointer, descriptionSize).slice()
    } catch {
      return new Uint8Array(0)
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
    console.error(`process ${this.id} error:`, error)
    this.kernel.kill(this.id, errorMessage).catch((killError) => {
      console.error(`Failed to kill process ${this.id} after error:`, killError)
    })
  }

  /**
   * Handles data available on a socket.
   * Called when data is flushed from another process to this process's socket input buffer.
   */
  handleData(socket_id: number): void {
    if (!this.isAlive) {
      return
    }
    try {
      if (!this.instance) {
        throw new Error('Process instance not initialized')
      }
      const handleData = this.instance.exports.waos_socket_data as (socket: number) => void | undefined
      if (!handleData) {
        throw new Error('waos_socket_data not exported from WASM module')
      }
      handleData(socket_id)
    } catch (error) {
      // Do not kill the process: a C++ exception here used to become
      // WebAssembly.Exception, kernel.kill, and every in-flight RPC spinner
      // (create table / put) hung forever with nothing in the page console.
      console.error(`process ${this.id} socket ${socket_id} handleData:`, error)
    }
    this.kernel.monitorBackpressure.notifyInputConsumed(this.id, socket_id)
  }

  /**
   * Handles drain request on a socket.
   * Called when another process requests to drain data from this process's socket.
   * 
   * @param socket_id - The socket identifier to drain
   */
  handleDrain(socket_id: number): void {
    if (!this.isAlive) {
      return
    }
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
  serializeToSocket(socket: socket_id, value: TypedValue, _typeRegistry: TypeRegistry): void {
    this.kernel.monitorEmitter.deliverEvent(
      { process: this, socket, config: { flags: 0 } },
      value._type as string,
      value as object
    )
  }

  /**
   * Destroys the process and releases all associated resources.
   * This method should clean up all memory, connections, modules, and other resources
   * associated with this process. After destruction, the process should not be usable.
   */
  async kill(error: string | undefined): Promise<void> {
    if (!this.isAlive) {
      return
    }
    this.isAlive = false

    this.runtime.pendingData.clear()
    this.runtime.pendingDrain.clear()

    // Clean up all socket connections
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

    // Notify all monitors
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
    if (!this.isAlive) {
      throw new Error(`Process ${this.id} is not alive`)
    }
    if (!processTo.isAlive) {
      throw new Error(`Process ${processTo.id} is not alive`)
    }

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
  monitor(process: Process, socket_id: socket_id, config: MonitorConfig = { flags: DEFAULT_MONITOR_FLAGS }): void {
    if (!this.isAlive) {
      throw new Error(`Process ${this.id} is not alive`)
    }
    if (!process.isAlive) {
      throw new Error(`Process ${process.id} is not alive`)
    }

    if (!this.moduleSockets) {
      throw new Error('This process not started - moduleSockets not initialized')
    }
    
    // Validate that the socket exists in this process
    const socket = this.moduleSockets.getSocket(socket_id)
    if (!socket) {
      throw new Error(`Socket ${socket_id} not found in process ${this.id}`)
    }

    // Check for duplicate outgoing monitoring entry
    const existingMonitor = this.monitoredProcesses.find(
      m => m.process.id === process.id && m.socket === socket_id
    )
    if (existingMonitor) {
      throw new Error(`Process ${this.id} is already monitoring process ${process.id} on socket ${socket_id}`)
    }

    process.addMonitor(this, socket_id, config)
    this.monitoredProcesses.push(new ProcessMonitor(process, socket_id, config))
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
    const monitoredProcessIndex = this.monitoredProcesses.findIndex(
      m => m.process.id === process.id && m.socket === socket_id
    )
    
    if (monitoredProcessIndex === -1) {
      throw new Error(`Process ${this.id} is not monitoring process ${process.id} on socket ${socket_id}`)
    }

    process.removeMonitor(this, socket_id)
    this.monitoredProcesses.splice(monitoredProcessIndex, 1)
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

}

export default ModuleProcess
import type Process from './Process.js'
import { ModuleProcess } from './ModuleProcess.js'
import { LocalProcess } from './LocalProcess.js'
import { EmscriptenProcess } from './EmscriptenProcess.js'

import { createGeneratedTypeRegistry, direction, monitor_flag, type save_result, type socket_binding } from './kernelApi.js'

import type { 
  process_id, socket_id
} from './types.js'
import { Direction } from './types.js'
import { TypeRegistry, serializeTypeRegistry } from '@wa-os/ts-rpc'
import { MonitorSocketBackpressure } from './MonitorSocketBackpressure.js'
import { ProcessMonitorEmitter } from './ProcessMonitorEmitter.js'
import type { MonitorConfig } from './monitorFlags.js'
import { DEFAULT_MONITOR_FLAGS } from './monitorFlags.js'
import { emitInitialBufferStates } from './monitorInit.js'
import { listBindingsForProcess } from './socketBindings.js'

export class Kernel {

  processes: Array<Process | null>
  processSearchPosition: number = 0
  manaLimit: number = 1000000

  readonly monitorBackpressure = new MonitorSocketBackpressure()
  readonly monitorEmitter = new ProcessMonitorEmitter(this, this.monitorBackpressure)

  constructor() {
    this.processes = []
  }

  async spawn(code: Uint8Array, memory_limit: number = 2048, mana_limit: number = 1000000): Promise<process_id> {
    let processId: process_id | undefined
    
    // Search for empty slot
    if (this.processes.length > 0) {
      const searchStart = this.processSearchPosition
      do {
        this.processSearchPosition = (this.processSearchPosition + 1) % this.processes.length
        if (this.processes[this.processSearchPosition] === null) {
          processId = this.processSearchPosition
          break
        }
      } while (this.processSearchPosition !== searchStart)
    }
    
    // If no empty slot found, append to end
    if (processId === undefined) {
      processId = this.processes.length
      this.processSearchPosition = processId
    }
    
    const process = new ModuleProcess(this, processId, memory_limit, mana_limit)
    try {
      await process.setModuleCode(code)
    } catch (error) {
      // @ts-ignore
      const hashBuffer = await crypto.subtle.digest('SHA-256', code);             
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      console.error(`Error setting module code for code with length ${code.byteLength} bytes and hash ${hashHex}`, error)
      throw error
    }
    try {
      await process.start()
    } catch (error) {
      console.error('Error starting process', error)
      throw error
    }
    
    if (processId >= this.processes.length) {
      this.processes.push(process)
    } else {
      this.processes[processId] = process
    }

    return processId
  }

  async spawnLocal(mana_limit: number = 1000000): Promise<process_id> {
    let processId: process_id | undefined
    
    if (this.processes.length > 0) {
      const searchStart = this.processSearchPosition
      do {
        this.processSearchPosition = (this.processSearchPosition + 1) % this.processes.length
        if (this.processes[this.processSearchPosition] === null) {
          processId = this.processSearchPosition
          break
        }
      } while (this.processSearchPosition !== searchStart)
    }
    
    if (processId === undefined) {
      processId = this.processes.length
      this.processSearchPosition = processId
    }
    
    const process = new LocalProcess(this, processId, mana_limit)
    
    if (processId >= this.processes.length) {
      this.processes.push(process)
    } else {
      this.processes[processId] = process
    }
    
    return processId
  }

  async spawnEmscripten(mana_limit: number = 1000000): Promise<process_id> {
    let processId: process_id | undefined

    if (this.processes.length > 0) {
      const searchStart = this.processSearchPosition
      do {
        this.processSearchPosition = (this.processSearchPosition + 1) % this.processes.length
        if (this.processes[this.processSearchPosition] === null) {
          processId = this.processSearchPosition
          break
        }
      } while (this.processSearchPosition !== searchStart)
    }

    if (processId === undefined) {
      processId = this.processes.length
      this.processSearchPosition = processId
    }

    const process = new EmscriptenProcess(this, processId, mana_limit)

    if (processId >= this.processes.length) {
      this.processes.push(process)
    } else {
      this.processes[processId] = process
    }

    return processId
  }

  async resurect(code: Uint8Array, memory: Uint8Array, memory_limit: number = 2048, mana_limit: number = 1000000): Promise<process_id> {
    let processId: process_id | undefined
    
    if (this.processes.length > 0) {
      const searchStart = this.processSearchPosition
      do {
        this.processSearchPosition = (this.processSearchPosition + 1) % this.processes.length
        if (this.processes[this.processSearchPosition] === null) {
          processId = this.processSearchPosition
          break
        }
      } while (this.processSearchPosition !== searchStart)
    }
    
    if (processId === undefined) {
      processId = this.processes.length
      this.processSearchPosition = processId
    }
    
    const process = new ModuleProcess(this, processId, memory_limit, mana_limit)
    await process.setModuleCode(code)
    await process.setMemory(memory)
    await process.start()
    
    if (processId >= this.processes.length) {
      this.processes.push(process)
    } else {
      this.processes[processId] = process
    }
    
    return processId
  }

  async save(id: process_id): Promise<save_result> {
    const process = this.processes[id]
    if (!process) {
      throw new Error(`Process ${id} not found`)
    }
    if (!process.isAlive) {
      throw new Error(`Process ${id} is not alive`)
    }

    process.pausePump()
    try {
      const snapshot_uid = process.runtime.nextSnapshotUid++
      // Copy: get_memory() is often a live WASM/host view; a save result must be stable.
      const memory = Uint8Array.from(process.get_memory())
      const mana_used = process.manaUsed
      const mana_limit = process.manaLimit

      await this.monitorEmitter.awaitEmitToMonitors(
        process,
        monitor_flag.SAVE,
        'process_save_event',
        () => ({
          _type: 'process_save_event',
          process: id,
          snapshot_uid,
        })
      )

      return { snapshot_uid, memory, mana_used, mana_limit }
    } finally {
      process.resumePump()
    }
  }

  async kill(id: process_id, error?: string): Promise<void> {
    const process = this.processes[id]
    if(!process) {
      throw new Error(`Process ${id} not found`)
    }
    await process.kill(error)
    this.releaseProcessIfDeadAndUnmonitored(id)
  }

  releaseProcessIfDeadAndUnmonitored(id: process_id): void {
    const process = this.processes[id]
    if (!process) {
      return
    }
    if (!process.isAlive && process.monitors.length === 0) {
      this.processes[id] = null
    }
  }

  async bind(process_from: process_id, socket_from: socket_id, 
             process_to: process_id, socket_to: socket_id, 
             direction: direction): Promise<void> {
    const processFrom = this.processes[process_from]
    const processTo = this.processes[process_to]
    if(!processFrom) throw new Error(`Process ${process_from} not found`)
    if(!processTo) throw new Error(`Process ${process_to} not found`)
    
    const dir = direction as unknown as Direction
    if(dir === Direction.NONE) throw new Error(`Direction cannot be NONE`)
    
    processFrom.bind(processTo, socket_from, socket_to, dir)
    await this.emitBindEvents(
      'process_bind_event',
      processFrom,
      processTo,
      process_from,
      socket_from,
      process_to,
      socket_to,
      direction
    )
  }

  async unbind(process_from: process_id, socket_from: socket_id,
               process_to: process_id, socket_to: socket_id,
               direction: direction): Promise<void> {
    const processFrom = this.processes[process_from]
    const processTo = this.processes[process_to]
    if(!processFrom) throw new Error(`Process ${process_from} not found`)
    if(!processTo) throw new Error(`Process ${process_to} not found`)
    
    const dir = direction as unknown as Direction
    if(dir === Direction.NONE) throw new Error(`Direction cannot be NONE`)
    
    processFrom.unbind(processTo, socket_from, socket_to, dir)
    await this.emitBindEvents(
      'process_unbind_event',
      processFrom,
      processTo,
      process_from,
      socket_from,
      process_to,
      socket_to,
      direction
    )
  }

  private async emitBindEvents(
    typeName: 'process_bind_event' | 'process_unbind_event',
    processFrom: Process,
    processTo: Process,
    process_from: process_id,
    socket_from: socket_id,
    process_to: process_id,
    socket_to: socket_id,
    dir: direction
  ): Promise<void> {
    const inverted = invertDirection(dir)
    await this.monitorEmitter.awaitEmitToMonitors(
      processFrom,
      monitor_flag.BIND,
      typeName,
      () => ({
        _type: typeName,
        process: process_from,
        socket: socket_from,
        peer_process: process_to,
        peer_socket: socket_to,
        direction: dir,
      })
    )
    await this.monitorEmitter.awaitEmitToMonitors(
      processTo,
      monitor_flag.BIND,
      typeName,
      () => ({
        _type: typeName,
        process: process_to,
        socket: socket_to,
        peer_process: process_from,
        peer_socket: socket_from,
        direction: inverted,
      })
    )
  }

  async monitor(
    target: process_id,
    monitor: process_id,
    monitor_socket: socket_id,
    config: MonitorConfig = { flags: DEFAULT_MONITOR_FLAGS }
  ): Promise<void> {
    const targetProcess = this.processes[target]
    const monitorProcess = this.processes[monitor]
    if(!targetProcess) throw new Error(`Target process ${target} not found`)
    if(!monitorProcess) throw new Error(`Monitor process ${monitor} not found`)
    monitorProcess.monitor(targetProcess, monitor_socket, config)
  }

  async demonitor(target: process_id, monitor: process_id, monitor_socket: socket_id): Promise<void> {
    const targetProcess = this.processes[target]
    const monitorProcess = this.processes[monitor]
    if(!targetProcess) throw new Error(`Target process ${target} not found`)
    if(!monitorProcess) throw new Error(`Monitor process ${monitor} not found`)
    monitorProcess.demonitor(targetProcess, monitor_socket)
    this.releaseProcessIfDeadAndUnmonitored(target)
  }

  async measure_mana(process: process_id, new_mana: number): Promise<number> {
    const processInstance = this.processes[process]
    if(!processInstance) {
      throw new Error(`Process ${process} not found`)
    }
    const oldMana = processInstance.manaUsed
    processInstance.useMana(new_mana)
    this.monitorEmitter.emitToMonitors(
      processInstance,
      monitor_flag.MANA,
      'process_measure_mana_event',
      () => ({
        _type: 'process_measure_mana_event',
        process,
        new_mana,
      })
    )
    return oldMana
  }

  async set_mana_limit(process: process_id, mana_limit: number): Promise<void> {
    const processInstance = this.processes[process]
    if(!processInstance) {
      throw new Error(`Process ${process} not found`)
    }    
    processInstance.manaLimit = mana_limit
    this.monitorEmitter.emitToMonitors(
      processInstance,
      monitor_flag.MANA,
      'process_set_mana_limit_event',
      () => ({
        _type: 'process_set_mana_limit_event',
        process,
        mana_limit,
      })
    )
  }

  async list_socket_bindings(id: process_id): Promise<socket_binding[]> {
    const process = this.processes[id]
    if (!process) {
      throw new Error(`Process ${id} not found`)
    }
    return listBindingsForProcess(process)
  }

  async get_rpc_description(id: process_id, socket: socket_id): Promise<Uint8Array> {
    const process = this.processes[id]
    if (!process) {
      throw new Error(`Process ${id} not found`)
    }
    if (process instanceof ModuleProcess) {
      return process.readRawRpcDescriptionOrEmpty(socket)
    }
    // Duck-type: LocalProcess, NativeProcess, and any Process with getRpcDescription
    if (typeof (process as { getRpcDescription?: unknown }).getRpcDescription === 'function') {
      const registry = process.getRpcDescription(socket)
      if (!registry) {
        return new Uint8Array(0)
      }
      try {
        return serializeTypeRegistry(registry)
      } catch {
        return new Uint8Array(0)
      }
    }
    return new Uint8Array(0)
  }


  createRpcRegistry(): TypeRegistry {
    const result = createGeneratedTypeRegistry()
    const { registry, types } = result
    
    types['kernel_spawn'].implementation = (
      code: Uint8Array, memory_limit: number, mana_limit: number
    ): Promise<number> => this.spawn(code, memory_limit, mana_limit)
    
    types['kernel_resurect'].implementation = (
      code: Uint8Array, memory: Uint8Array, memory_limit: number, mana_limit: number
    ): Promise<number> => this.resurect(code, memory, memory_limit, mana_limit)
    
    types['kernel_save'].implementation = (id: number) => this.save(id)

    types['kernel_kill'].implementation = (
      id: number
    ): Promise<void> => this.kill(id)

    types['kernel_bind'].implementation = (
      process_from: number, socket_from: number,
      process_to: number, socket_to: number,
      direction: direction
    ): Promise<void> => this.bind(process_from, socket_from, process_to, socket_to, direction)

    types['kernel_unbind'].implementation = (
      process_from: number, socket_from: number,
      process_to: number, socket_to: number,
      direction: direction
    ): Promise<void> => this.unbind(process_from, socket_from, process_to, socket_to, direction)

    types['kernel_monitor'].implementation = (
      target: number, monitor: number, monitor_socket: number,
      config: MonitorConfig
    ): Promise<void> => this.monitor(target, monitor, monitor_socket, config)

    types['kernel_demonitor'].implementation = (
      target: number, monitor: number, monitor_socket: number
    ): Promise<void> => this.demonitor(target, monitor, monitor_socket)

    types['kernel_measure_mana'].implementation = (
      process: number, new_mana: number
    ): Promise<number> => this.measure_mana(process, new_mana)

    types['kernel_set_mana_limit'].implementation = (
      process: number, mana_limit: number
    ): Promise<void> => this.set_mana_limit(process, mana_limit)

    types['kernel_list_socket_bindings'].implementation = (
      process: number
    ): Promise<socket_binding[]> => this.list_socket_bindings(process)

    types['kernel_get_rpc_description'].implementation = (
      process: number, socket: number
    ): Promise<Uint8Array> => this.get_rpc_description(process, socket)
    
    registry.assignMethodIds()
    return registry
  }

  onMonitorRelationAdded(target: Process, monitorEntry: import('./Process.js').ProcessMonitor): void {
    emitInitialBufferStates(target, monitorEntry, this.monitorEmitter)
  }
}

function invertDirection(dir: direction): direction {
  if (dir === direction.IN) return direction.OUT
  if (dir === direction.OUT) return direction.IN
  return dir
}

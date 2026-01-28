import Process from './process.js'

import { createGeneratedTypeRegistry, direction_15 } from './kernelApi.js'

import type { 
  process_id, channel_id
} from './types.js'
import { Direction } from './types.js'
import { TypeRegistry } from '@wa-os/ts-rpc'

export class Kernel {

  processes: Array<Process | null>
  processSearchPosition: number = 0
  manaLimit: number = 1000000

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
    
    const process = new Process(this, processId, memory_limit, mana_limit)
    await process.setModuleCode(code)
    await process.start()
    
    if (processId >= this.processes.length) {
      this.processes.push(process)
    } else {
      this.processes[processId] = process
    }
    
    return processId
  }

  async resurect(code: Uint8Array, memory: Uint8Array, memory_limit: number = 2048, mana_limit: number = 1000000): Promise<process_id> {
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
    
    const process = new Process(this, processId, memory_limit, mana_limit)
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

  async save(id: process_id): Promise<Uint8Array> {
    const process = this.processes[id]
    if(!process) {
      throw new Error(`Process ${id} not found`)
    }
    return process.get_memory()
  }

  async kill(id: process_id, error?: string): Promise<void> {
    const process = this.processes[id]
    if(!process) {
      throw new Error(`Process ${id} not found`)
    }
    await process.kill(error)
    this.processes[id] = null
  }

  async bind(process_from: process_id, channel_from: channel_id, 
             process_to: process_id, channel_to: channel_id, 
             direction: direction_15): Promise<void> {
    const processFrom = this.processes[process_from]
    const processTo = this.processes[process_to]
    if(!processFrom) throw new Error(`Process ${process_from} not found`)
    if(!processTo) throw new Error(`Process ${process_to} not found`)
    
    // Convert direction_15 enum to Direction enum
    const dir = direction as unknown as Direction
    if(dir === Direction.NONE) throw new Error(`Direction cannot be NONE`)
    
    processFrom.bind(processTo, channel_from, channel_to, dir)
  }

  async unbind(process_from: process_id, channel_from: channel_id,
               process_to: process_id, channel_to: channel_id,
               direction: direction_15): Promise<void> {
    const processFrom = this.processes[process_from]
    const processTo = this.processes[process_to]
    if(!processFrom) throw new Error(`Process ${process_from} not found`)
    if(!processTo) throw new Error(`Process ${process_to} not found`)
    
    // Convert direction_15 enum to Direction enum
    const dir = direction as unknown as Direction
    if(dir === Direction.NONE) throw new Error(`Direction cannot be NONE`)
    
    processFrom.unbind(processTo, channel_from, channel_to, dir)
  }

  async monitor(target: process_id, monitor: process_id, monitor_channel: channel_id): Promise<void> {
    const targetProcess = this.processes[target]
    const monitorProcess = this.processes[monitor]
    if(!targetProcess) throw new Error(`Target process ${target} not found`)
    if(!monitorProcess) throw new Error(`Monitor process ${monitor} not found`)
    monitorProcess.monitor(targetProcess, monitor_channel)
  }

  async demonitor(target: process_id, monitor: process_id, monitor_channel: channel_id): Promise<void> {
    const targetProcess = this.processes[target]
    const monitorProcess = this.processes[monitor]
    if(!targetProcess) throw new Error(`Target process ${target} not found`)
    if(!monitorProcess) throw new Error(`Monitor process ${monitor} not found`)
    monitorProcess.demonitor(targetProcess, monitor_channel)
  }

  async measure_mana(process: process_id, new_mana: number): Promise<number> {
    const processInstance = this.processes[process]
    if(!processInstance) {
      throw new Error(`Process ${process} not found`)
    }
    const oldMana = processInstance.manaUsed
    processInstance.useMana(new_mana)
    return processInstance.manaUsed
  }

  async set_mana_limit(mana_limit: number): Promise<void> {
    this.manaLimit = mana_limit
  }


  createRpcRegistry(): TypeRegistry {
    const result = createGeneratedTypeRegistry()
    const { registry, types } = result
    
    types['kernel_spawn_10'].implementation = (
      code: Uint8Array, memory_limit: number, mana_limit: number
    ): Promise<number> => this.spawn(code, memory_limit, mana_limit)
    
    types['kernel_resurect_11'].implementation = (
      code: Uint8Array, memory: Uint8Array, memory_limit: number, mana_limit: number
    ): Promise<number> => this.resurect(code, memory, memory_limit, mana_limit)
    
    types['kernel_save_12'].implementation = (
      id: number
    ): Promise<Uint8Array> => this.save(id)
    
    types['kernel_kill_13'].implementation = (
      id: number
    ): Promise<void> => this.kill(id)
    
    types['kernel_bind_14'].implementation = (
      process_from: number, channel_from: number,
      process_to: number, channel_to: number,
      direction: direction_15
    ): Promise<void> => this.bind(process_from, channel_from, process_to, channel_to, direction)
    
    types['kernel_unbind_16'].implementation = (
      process_from: number, channel_from: number,
      process_to: number, channel_to: number,
      direction: direction_15
    ): Promise<void> => this.unbind(process_from, channel_from, process_to, channel_to, direction)
    
    types['kernel_monitor_17'].implementation = (
      target: number, monitor: number, monitor_channel: number
    ): Promise<void> => this.monitor(target, monitor, monitor_channel)
    
    types['kernel_demonitor_18'].implementation = (
      target: number, monitor: number, monitor_channel: number
    ): Promise<void> => this.demonitor(target, monitor, monitor_channel)
    
    types['kernel_measure_mana_19'].implementation = (
      process: number, new_mana: number
    ): Promise<number> => this.measure_mana(process, new_mana)
    
    types['kernel_set_mana_limit_20'].implementation = (
      mana_limit: number
    ): Promise<void> => this.set_mana_limit(mana_limit)
    
    registry.assignMethodIds()
    return registry
  }
}
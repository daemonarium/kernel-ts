import type Process from './Process.js'
import { ModuleProcess } from './ModuleProcess.js'
import { LocalProcess } from './LocalProcess.js'

import { createGeneratedTypeRegistry, direction_28 } from './kernelApi.js'

import type { 
  process_id, socket_id
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
    
    const process = new ModuleProcess(this, processId, memory_limit, mana_limit)
    try {
      await process.setModuleCode(code)
    } catch (error) {
      // @ts-ignore
      const hashBuffer = await crypto.subtle.digest('SHA-256', code);             
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      console.error(`Error setting module code for code with length ${code.byteLength} bytes and hash ${hashHex}`, error)
      // print code as hex in chunks of 16 bytes    
/*       console.log("code:", code)
      for (let i = 0; i < code.byteLength; i += 16) {
        // @ts-ignore
        console.error(i.toString(16).padStart(4,'0'), Array.from(code.slice(i, i + 16)).map(b => b.toString(16).padStart(2, '0')).join(' '))
      } */
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
    
    const process = new LocalProcess(this, processId, mana_limit)
    
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
             direction: direction_28): Promise<void> {
    const processFrom = this.processes[process_from]
    const processTo = this.processes[process_to]
    if(!processFrom) throw new Error(`Process ${process_from} not found`)
    if(!processTo) throw new Error(`Process ${process_to} not found`)
    
    // Convert direction_15 enum to Direction enum
    const dir = direction as unknown as Direction
    if(dir === Direction.NONE) throw new Error(`Direction cannot be NONE`)
    
    processFrom.bind(processTo, socket_from, socket_to, dir)
  }

  async unbind(process_from: process_id, socket_from: socket_id,
               process_to: process_id, socket_to: socket_id,
               direction: direction_28): Promise<void> {
    const processFrom = this.processes[process_from]
    const processTo = this.processes[process_to]
    if(!processFrom) throw new Error(`Process ${process_from} not found`)
    if(!processTo) throw new Error(`Process ${process_to} not found`)
    
    // Convert direction_15 enum to Direction enum
    const dir = direction as unknown as Direction
    if(dir === Direction.NONE) throw new Error(`Direction cannot be NONE`)
    
    processFrom.unbind(processTo, socket_from, socket_to, dir)
  }

  async monitor(target: process_id, monitor: process_id, monitor_socket: socket_id): Promise<void> {
    const targetProcess = this.processes[target]
    const monitorProcess = this.processes[monitor]
    if(!targetProcess) throw new Error(`Target process ${target} not found`)
    if(!monitorProcess) throw new Error(`Monitor process ${monitor} not found`)
    monitorProcess.monitor(targetProcess, monitor_socket)
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
    return processInstance.manaUsed
  }

  async set_mana_limit(process: process_id, mana_limit: number): Promise<void> {
    const processInstance = this.processes[process]
    if(!processInstance) {
      throw new Error(`Process ${process} not found`)
    }    
    processInstance.manaLimit = mana_limit
  }


  createRpcRegistry(): TypeRegistry {
    const result = createGeneratedTypeRegistry()
    const { registry, types } = result
    
    types['kernel_spawn_23'].implementation = (
      code: Uint8Array, memory_limit: number, mana_limit: number
    ): Promise<number> => this.spawn(code, memory_limit, mana_limit)
    
    types['kernel_resurect_24'].implementation = (
      code: Uint8Array, memory: Uint8Array, memory_limit: number, mana_limit: number
    ): Promise<number> => this.resurect(code, memory, memory_limit, mana_limit)
    
    types['kernel_save_25'].implementation = (
      id: number
    ): Promise<Uint8Array> => this.save(id)
    
    types['kernel_kill_26'].implementation = (
      id: number
    ): Promise<void> => this.kill(id)
    
    types['kernel_bind_27'].implementation = (
      process_from: number, socket_from: number,
      process_to: number, socket_to: number,
      direction: direction_28
    ): Promise<void> => this.bind(process_from, socket_from, process_to, socket_to, direction)
    
    types['kernel_unbind_29'].implementation = (
      process_from: number, socket_from: number,
      process_to: number, socket_to: number,
      direction: direction_28
    ): Promise<void> => this.unbind(process_from, socket_from, process_to, socket_to, direction)
    
    types['kernel_monitor_30'].implementation = (
      target: number, monitor: number, monitor_socket: number
    ): Promise<void> => this.monitor(target, monitor, monitor_socket)
    
    types['kernel_demonitor_31'].implementation = (
      target: number, monitor: number, monitor_socket: number
    ): Promise<void> => this.demonitor(target, monitor, monitor_socket)
    
    types['kernel_measure_mana_32'].implementation = (
      process: number, new_mana: number
    ): Promise<number> => this.measure_mana(process, new_mana)
    
    types['kernel_set_mana_limit_33'].implementation = (
      process: number, mana_limit: number
    ): Promise<void> => this.set_mana_limit(process, mana_limit)
    
    registry.assignMethodIds()
    return registry
  }
}
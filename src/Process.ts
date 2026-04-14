import type { Kernel } from './kernel.js'
import type { process_id, socket_id } from './types.js'
import type { Direction } from './types.js'
import type { Socket, TypeRegistry, TypedValue } from '@wa-os/ts-rpc'

export interface SocketConnectionDestination {
  processId: process_id
  socketIndex: number
  process: Process
  socket: Socket
}

export class SocketConnection {
  socket: Socket
  connectedTo?: SocketConnectionDestination
  connectedFrom?: SocketConnectionDestination

  constructor(socket: Socket) {
    this.socket = socket
  }
}

export class ProcessMonitor {
  process: Process
  socket: socket_id

  constructor(process: Process, socket: socket_id) {
    this.process = process
    this.socket = socket
  }
}

export default interface Process {
  kernel: Kernel
  id: process_id
  isAlive: boolean

  manaUsed: number
  manaLimit: number
  useMana(mana: number): void

  socketConnections: Array<SocketConnection>
  monitors: Array<ProcessMonitor>
  monitoredProcesses: Array<ProcessMonitor>

  getSocket(index: socket_id): Socket | null

  getRpcDescription(): TypeRegistry | undefined

  handleError(error: string | Error): void
  handleData(socket_id: number): void
  handleDrain(socket_id: number): void

  serializeToSocket(socket: socket_id, value: TypedValue, typeRegistry: TypeRegistry): void

  get_memory(): Uint8Array
  kill(error: string | undefined): Promise<void>

  bind(processTo: Process, socket_id: socket_id, socket_to: socket_id, direction: Direction): void
  unbind(processTo: Process, socket_id: socket_id, socket_to: socket_id, direction: Direction): void

  addMonitor(monitorProcess: Process, socket_id: socket_id): void
  removeMonitor(monitorProcess: Process, socket_id: socket_id): void
  monitor(process: Process, socket_id: socket_id): void
  demonitor(process: Process, socket_id: socket_id): void
}


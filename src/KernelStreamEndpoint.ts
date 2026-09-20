/**
 * Binds a kernel (pid, socket) pair as a MessageChannel for observable.
 * Owns LocalSocket lifecycle; exposes returnPid/returnSocket for StreamMultiplexer.
 * The observable core in ts-rpc depends only on MessageChannel — this adapter
 * is optional and only for kernel-local clients.
 */

import {
  CodecRegistry,
  FlatSocketMessageChannel,
  type LocalSocket,
  type MessageChannel,
  type SocketOptions,
} from '@wa-os/ts-rpc'
import type { Kernel } from './kernel.js'
import { LocalProcess } from './LocalProcess.js'
import { direction } from './kernelApi.js'
import type { process_id, socket_id } from './types.js'

export class KernelStreamEndpoint {
  private readonly kernel: Kernel
  private readonly pid: process_id
  private readonly socketId: socket_id
  private readonly sock: LocalSocket
  private readonly messageChannel: FlatSocketMessageChannel

  constructor(
    kernel: Kernel,
    pid: process_id,
    socket: socket_id,
    opts: SocketOptions,
    codecs: CodecRegistry = new CodecRegistry()
  ) {
    this.kernel = kernel
    this.pid = pid
    this.socketId = socket
    const process = kernel.processes[pid]
    if (!process) {
      throw new Error(`Process ${pid} not found`)
    }
    const existing = process.getSocket(socket) as LocalSocket | null
    if (existing) {
      this.sock = existing
    } else if (process instanceof LocalProcess) {
      this.sock = process.createSocket(socket, opts)
    } else {
      throw new Error(`Process ${pid} cannot create a LocalSocket`)
    }
    this.messageChannel = new FlatSocketMessageChannel(this.sock, codecs)
  }

  get channel(): MessageChannel {
    return this.messageChannel
  }

  get returnPid(): bigint {
    return BigInt(this.pid)
  }

  get returnSocket(): number {
    return this.socketId
  }

  async bindTo(
    destPid: process_id,
    destSocket: socket_id,
    dir: direction = direction.BOTH
  ): Promise<void> {
    await this.kernel.bind(this.pid, this.socketId, destPid, destSocket, dir)
  }

  close(): void {
    this.sock.close()
  }
}

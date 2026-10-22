import { expect } from 'chai'
import { Kernel } from '../src/kernel.js'
import { LocalProcess } from '../src/LocalProcess.js'
import { direction, monitor_flag } from '../src/kernelApi.js'
import { FlatLocalCircularBufferReader } from '@daemonarium/rpc'
import type { LocalSocket } from '@daemonarium/rpc'

const LENGTH_SIZE = 4

function defaultSocketOptions() {
  return {
    inputBufferSize: 2048,
    outputBufferSize: 2048,
    flushThreshold: 64,
    dataEventThreshold: 0,
    drainEventThreshold: 4,
    flags: 0,
  }
}

function readMonitorFrames(
  kernel: Kernel,
  monitorSocket: LocalSocket
): Array<{ typeName: string, header: Record<string, unknown> }> {
  const { codecs } = kernel.monitorEmitter.getCodecs()
  const input = monitorSocket.inputBuffer
  const frames: Array<{ typeName: string, header: Record<string, unknown> }> = []

  while (input.readableBytes() >= LENGTH_SIZE) {
    const lengthBytes = new Uint8Array(LENGTH_SIZE)
    input.peek(0, lengthBytes, LENGTH_SIZE)
    const msgLen = new DataView(lengthBytes.buffer).getUint32(0, true)
    if (input.readableBytes() < LENGTH_SIZE + msgLen) {
      break
    }
    input.skipRead(LENGTH_SIZE)
    const reader = new FlatLocalCircularBufferReader(input, codecs)
    reader.setReadOffset(0)
    const typeIndex = reader.readU32()
    reader.readU32() // encoded_size_0
    const codec = codecs.messages.getByIndex(typeIndex)
    let header: Record<string, unknown> = {}
    codec.deserialize(reader as any, (value: unknown) => {
      header = value as Record<string, unknown>
    })
    reader.readRest()
    const sentinel = reader.readU32()
    if (sentinel !== 0) {
      throw new Error(`flat monitor frame: expected sentinel 0, got ${sentinel}`)
    }
    frames.push({ typeName: codec.name, header })
    input.skipRead(msgLen)
  }

  return frames
}

describe('monitor BIND events', () => {
  it('emits process_bind_event on target monitor after host bind', async () => {
    const kernel = new Kernel()
    const target = new LocalProcess(kernel, 1, 1000000)
    const peer = new LocalProcess(kernel, 2, 1000000)
    const recorder = new LocalProcess(kernel, 3, 1000000)
    kernel.processes[1] = target
    kernel.processes[2] = peer
    kernel.processes[3] = recorder

    target.createSocket(0, defaultSocketOptions())
    peer.createSocket(0, defaultSocketOptions())
    const monitorSocket = recorder.createSocket(5, defaultSocketOptions())

    await kernel.monitor(1, 3, 5, { flags: monitor_flag.BIND })
    await kernel.bind(1, 0, 2, 0, direction.BOTH)

    const frames = readMonitorFrames(kernel, monitorSocket)
    expect(frames).to.have.length(1)
    expect(frames[0].typeName).to.equal('process_bind_event')
    expect(frames[0].header.process).to.equal(1)
    expect(frames[0].header.socket).to.equal(0)
    expect(frames[0].header.peer_process).to.equal(2)
    expect(frames[0].header.peer_socket).to.equal(0)
    expect(frames[0].header.direction).to.equal(direction.BOTH)
  })

  it('emits relative events to both sides when both are monitored', async () => {
    const kernel = new Kernel()
    const target = new LocalProcess(kernel, 1, 1000000)
    const peer = new LocalProcess(kernel, 2, 1000000)
    const recorderA = new LocalProcess(kernel, 3, 1000000)
    const recorderB = new LocalProcess(kernel, 4, 1000000)
    kernel.processes[1] = target
    kernel.processes[2] = peer
    kernel.processes[3] = recorderA
    kernel.processes[4] = recorderB

    target.createSocket(1, defaultSocketOptions())
    peer.createSocket(2, defaultSocketOptions())
    const monA = recorderA.createSocket(5, defaultSocketOptions())
    const monB = recorderB.createSocket(6, defaultSocketOptions())

    await kernel.monitor(1, 3, 5, { flags: monitor_flag.BIND })
    await kernel.monitor(2, 4, 6, { flags: monitor_flag.BIND })
    await kernel.bind(1, 1, 2, 2, direction.OUT)

    const framesA = readMonitorFrames(kernel, monA)
    const framesB = readMonitorFrames(kernel, monB)

    expect(framesA).to.have.length(1)
    expect(framesA[0].typeName).to.equal('process_bind_event')
    expect(framesA[0].header.process).to.equal(1)
    expect(framesA[0].header.socket).to.equal(1)
    expect(framesA[0].header.peer_process).to.equal(2)
    expect(framesA[0].header.peer_socket).to.equal(2)
    expect(framesA[0].header.direction).to.equal(direction.OUT)

    expect(framesB).to.have.length(1)
    expect(framesB[0].typeName).to.equal('process_bind_event')
    expect(framesB[0].header.process).to.equal(2)
    expect(framesB[0].header.socket).to.equal(2)
    expect(framesB[0].header.peer_process).to.equal(1)
    expect(framesB[0].header.peer_socket).to.equal(1)
    expect(framesB[0].header.direction).to.equal(direction.IN)
  })

  it('does not emit bind event without BIND flag', async () => {
    const kernel = new Kernel()
    const target = new LocalProcess(kernel, 1, 1000000)
    const peer = new LocalProcess(kernel, 2, 1000000)
    const recorder = new LocalProcess(kernel, 3, 1000000)
    kernel.processes[1] = target
    kernel.processes[2] = peer
    kernel.processes[3] = recorder

    target.createSocket(0, defaultSocketOptions())
    peer.createSocket(0, defaultSocketOptions())
    const monitorSocket = recorder.createSocket(5, defaultSocketOptions())

    await kernel.monitor(1, 3, 5, { flags: monitor_flag.SAVE | monitor_flag.KILLED })
    await kernel.bind(1, 0, 2, 0, direction.BOTH)

    expect(monitorSocket.inputBuffer.readableBytes()).to.equal(0)
  })

  it('emits process_unbind_event after unbind', async () => {
    const kernel = new Kernel()
    const target = new LocalProcess(kernel, 1, 1000000)
    const peer = new LocalProcess(kernel, 2, 1000000)
    const recorder = new LocalProcess(kernel, 3, 1000000)
    kernel.processes[1] = target
    kernel.processes[2] = peer
    kernel.processes[3] = recorder

    target.createSocket(0, defaultSocketOptions())
    peer.createSocket(0, defaultSocketOptions())
    const monitorSocket = recorder.createSocket(5, defaultSocketOptions())

    await kernel.monitor(1, 3, 5, { flags: monitor_flag.BIND })
    await kernel.bind(1, 0, 2, 0, direction.BOTH)

    // Clear bind frame so we only assert unbind
    while (monitorSocket.inputBuffer.readableBytes() > 0) {
      monitorSocket.inputBuffer.skipRead(monitorSocket.inputBuffer.readableBytes())
    }

    await kernel.unbind(1, 0, 2, 0, direction.BOTH)

    const frames = readMonitorFrames(kernel, monitorSocket)
    expect(frames).to.have.length(1)
    expect(frames[0].typeName).to.equal('process_unbind_event')
    expect(frames[0].header.process).to.equal(1)
    expect(frames[0].header.socket).to.equal(0)
    expect(frames[0].header.peer_process).to.equal(2)
    expect(frames[0].header.peer_socket).to.equal(0)
    expect(frames[0].header.direction).to.equal(direction.BOTH)
  })

  it('places BIND in the monitor buffer before any Copy from a later flush', async () => {
    const kernel = new Kernel()
    const target = new LocalProcess(kernel, 1, 1000000)
    const peer = new LocalProcess(kernel, 2, 1000000)
    const recorder = new LocalProcess(kernel, 3, 1000000)
    kernel.processes[1] = target
    kernel.processes[2] = peer
    kernel.processes[3] = recorder

    const targetSock = target.createSocket(0, defaultSocketOptions())
    peer.createSocket(0, defaultSocketOptions())
    const monitorSocket = recorder.createSocket(5, defaultSocketOptions())

    await kernel.monitor(1, 3, 5, {
      flags: monitor_flag.BIND | monitor_flag.COPY | monitor_flag.COPY_PAYLOAD,
    })
    await kernel.bind(1, 0, 2, 0, direction.OUT)

    // BIND must already be buffered before we generate Copy via flush
    expect(monitorSocket.inputBuffer.readableBytes()).to.be.greaterThan(0)
    const bindOnly = kernel.monitorEmitter.computeFrameSize('process_bind_event', {
      _type: 'process_bind_event',
      process: 1,
      socket: 0,
      peer_process: 2,
      peer_socket: 0,
      direction: direction.OUT,
    })
    expect(monitorSocket.inputBuffer.readableBytes()).to.equal(bindOnly)

    const payload = new Uint8Array([7, 8, 9])
    // write() already commits; do not call commitWrite again
    targetSock.outputBuffer.write(payload, payload.length)
    targetSock.flush()

    const frames = readMonitorFrames(kernel, monitorSocket)
    expect(frames.map(f => f.typeName)).to.deep.equal([
      'process_bind_event',
      'process_copy_event',
    ])
    expect(frames[0].header.direction).to.equal(direction.OUT)
    expect(frames[1].header.socket).to.equal(0)
    expect(frames[1].header.direction).to.equal(direction.OUT)
    expect(frames[1].header.amount).to.equal(3)
  })
})

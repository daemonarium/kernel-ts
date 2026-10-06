import { expect } from 'chai'
import { Kernel } from '../src/kernel.js'
import { LocalProcess } from '../src/LocalProcess.js'
import { EmscriptenProcess } from '../src/EmscriptenProcess.js'
import { attachEmscripten } from '../src/attachEmscripten.js'
import { Direction } from '../src/types.js'
import { SOCKET_FLAG_OPEN } from '@wa-os/ts-rpc'

const SOCKET_INFO_SIZE = 40
const HEADER_SIZE = 12
const DATA_CAPACITY = 2048

function align4(value: number): number {
  return (value + 3) & ~3
}

function layoutMockSocket(memory: WebAssembly.Memory): {
  tablePtr: number
  dataCalls: number[]
  drainCalls: number[]
  shutdownCalls: number
  instance: WebAssembly.Instance
} {
  const view = new DataView(memory.buffer)
  const tablePtr = 64
  const bufTotal = align4(DATA_CAPACITY + HEADER_SIZE + 1)
  const inputStruct = 256
  const outputStruct = inputStruct + bufTotal
  const socketInfoPtr = tablePtr + 4

  view.setUint32(tablePtr, 1, true)
  view.setUint32(socketInfoPtr + 0, inputStruct, true)
  view.setUint32(socketInfoPtr + 8, outputStruct, true)
  view.setUint8(socketInfoPtr + 28, SOCKET_FLAG_OPEN)

  view.setUint32(inputStruct + 0, bufTotal, true)
  view.setUint32(inputStruct + 4, 0, true)
  view.setUint32(inputStruct + 8, 0, true)
  view.setUint32(outputStruct + 0, bufTotal, true)
  view.setUint32(outputStruct + 4, 0, true)
  view.setUint32(outputStruct + 8, 0, true)

  const dataCalls: number[] = []
  const drainCalls: number[] = []
  let shutdownCalls = 0

  const instance = {
    exports: {
      waos_sockets_table: () => tablePtr,
      waos_socket_data: (socket: number) => { dataCalls.push(socket) },
      waos_socket_output_drain: (socket: number) => { drainCalls.push(socket) },
      malloc: (size: number) => size,
      waos_shutdown: () => { shutdownCalls += 1 },
    }
  } as unknown as WebAssembly.Instance

  return { tablePtr, dataCalls, drainCalls, get shutdownCalls() { return shutdownCalls }, instance }
}

function socketOptions() {
  return {
    inputBufferSize: DATA_CAPACITY,
    outputBufferSize: DATA_CAPACITY,
    flushThreshold: 1,
    dataEventThreshold: 0,
    drainEventThreshold: 4,
    flags: 0,
  }
}

describe('EmscriptenProcess', () => {
  it('handleData calls the wasm export', async () => {
    const kernel = new Kernel()
    const pid = await kernel.spawnEmscripten()
    const proc = kernel.processes[pid] as EmscriptenProcess
    const memory = new WebAssembly.Memory({ initial: 2, maximum: 2 })
    const mock = layoutMockSocket(memory)
    proc.attach(mock.instance, memory)

    proc.handleData(0)
    expect(mock.dataCalls).to.deep.equal([0])
    expect(proc.getSocket(0)).to.not.equal(null)
  })

  it('bind + pump copies bytes and wakes handleData', async () => {
    const kernel = new Kernel()
    const localPid = await kernel.spawnLocal()
    const wasmPid = await kernel.spawnEmscripten()
    const local = kernel.processes[localPid] as LocalProcess
    const wasm = kernel.processes[wasmPid] as EmscriptenProcess

    local.createSocket(0, socketOptions())
    const memory = new WebAssembly.Memory({ initial: 2, maximum: 2 })
    const mock = layoutMockSocket(memory)
    wasm.attach(mock.instance, memory)

    await kernel.bind(localPid, 0, wasmPid, 0, Direction.BOTH)

    const payload = new Uint8Array([1, 2, 3, 4, 5])
    const localSock = local.getSocket(0)!
    localSock.outputBuffer.write(payload, payload.length)
    localSock.flush()

    await new Promise<void>((resolve) => queueMicrotask(resolve))
    expect(mock.dataCalls).to.deep.equal([0])

    const wasmSock = wasm.getSocket(0)!
    expect(wasmSock.inputBuffer.readableBytes()).to.equal(payload.length)
    const got = new Uint8Array(payload.length)
    wasmSock.inputBuffer.read(got, payload.length)
    expect(Array.from(got)).to.deep.equal(Array.from(payload))
  })

  it('kill sets isAlive false and calls waos_shutdown', async () => {
    const kernel = new Kernel()
    const pid = await kernel.spawnEmscripten()
    const proc = kernel.processes[pid] as EmscriptenProcess
    const memory = new WebAssembly.Memory({ initial: 2, maximum: 2 })
    const mock = layoutMockSocket(memory)
    proc.attach(mock.instance, memory)

    expect(proc.isAlive).to.equal(true)
    await proc.kill(undefined)
    expect(proc.isAlive).to.equal(false)
    expect(mock.shutdownCalls).to.equal(1)
    proc.handleData(0)
    expect(mock.dataCalls).to.deep.equal([])
  })

  it('exposes waos flush imports before attach', async () => {
    const kernel = new Kernel()
    const pid = await kernel.spawnEmscripten()
    const proc = kernel.processes[pid] as EmscriptenProcess
    expect(typeof proc.wasmImports.waos_socket_flush).to.equal('function')
    expect(typeof proc.wasmImports.waos_socket_input_drain).to.equal('function')
    expect(typeof proc.wasmImports.waos_use_mana).to.equal('function')
  })

  it('attachEmscripten loadGlue attaches without calling module exports', async () => {
    const kernel = new Kernel()
    const memory = new WebAssembly.Memory({ initial: 2, maximum: 2 })
    const mock = layoutMockSocket(memory)
    let startCalls = 0
    ;(mock.instance.exports as { start_session?: () => void }).start_session = () => {
      startCalls += 1
    }

    const proc = await attachEmscripten({
      kernel,
      loadGlue: async (waos) => {
        expect(typeof waos.waos_socket_flush).to.equal('function')
        return { instance: mock.instance, memory }
      }
    })
    expect(proc.instance).to.equal(mock.instance)
    expect(proc.memory).to.equal(memory)
    expect(startCalls).to.equal(0)
  })

  it('attachEmscripten requires loadGlue or scriptSrc', async () => {
    const kernel = new Kernel()
    try {
      await attachEmscripten({ kernel })
      expect.fail('expected attachEmscripten to throw')
    } catch (error) {
      expect((error as Error).message).to.equal(
        'attachEmscripten requires loadGlue or scriptSrc'
      )
    }
    expect(kernel.processes.filter(Boolean)).to.have.length(0)
  })

  it('attachEmscripten scriptSrc without document requires loadGlue', async () => {
    const kernel = new Kernel()
    try {
      await attachEmscripten({ kernel, scriptSrc: 'astro_chart.js' })
      expect.fail('expected attachEmscripten to throw')
    } catch (error) {
      expect((error as Error).message).to.equal(
        'attachEmscripten requires loadGlue when no Emscripten glue is loading'
      )
    }
    expect(kernel.processes.filter(Boolean)).to.have.length(0)
  })
})

import { expect } from 'chai'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deserializeTypeRegistry } from '@wa-os/ts-rpc'
import { Kernel } from '../src/kernel.js'
import { LocalProcess } from '../src/LocalProcess.js'
import { createGeneratedTypeRegistry, direction } from '../src/kernelApi.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const EM_BUILD = join(__dirname, '../../cmake-build-emscripten')
const MOCK_MODULE_WASM = join(EM_BUILD, 'kernel-shield/cpp-test/mock-module.wasm')
const KERNEL_SHIELD_WASM = join(EM_BUILD, 'kernel-shield.wasm')

function defaultSocketOptions() {
  return {
    inputBufferSize: 256,
    outputBufferSize: 256,
    flushThreshold: 64,
    dataEventThreshold: 0,
    drainEventThreshold: 4,
    flags: 0,
  }
}

describe('kernel list_socket_bindings / get_rpc_description', () => {
  it('lists bindings for a known graph', async () => {
    const kernel = new Kernel()
    const a = new LocalProcess(kernel, 1, 1000000)
    const b = new LocalProcess(kernel, 2, 1000000)
    kernel.processes[1] = a
    kernel.processes[2] = b

    a.createSocket(0, defaultSocketOptions())
    a.createSocket(1, defaultSocketOptions())
    b.createSocket(0, defaultSocketOptions())
    b.createSocket(1, defaultSocketOptions())

    await kernel.bind(1, 0, 2, 0, direction.BOTH)
    await kernel.bind(1, 1, 2, 1, direction.OUT)

    const fromA = await kernel.list_socket_bindings(1)
    expect(fromA).to.deep.equal([
      { socket: 0, peer_process: 2, peer_socket: 0, direction: direction.BOTH },
      { socket: 1, peer_process: 2, peer_socket: 1, direction: direction.OUT },
    ])

    const fromB = await kernel.list_socket_bindings(2)
    expect(fromB).to.deep.equal([
      { socket: 0, peer_process: 1, peer_socket: 0, direction: direction.BOTH },
      { socket: 1, peer_process: 1, peer_socket: 1, direction: direction.IN },
    ])
  })

  it('returns empty list when process has no bindings', async () => {
    const kernel = new Kernel()
    const process = new LocalProcess(kernel, 1, 1000000)
    kernel.processes[1] = process
    process.createSocket(0, defaultSocketOptions())

    const bindings = await kernel.list_socket_bindings(1)
    expect(bindings).to.deep.equal([])
  })

  it('throws when listing bindings for missing process', async () => {
    const kernel = new Kernel()
    try {
      await kernel.list_socket_bindings(99)
      expect.fail('expected throw')
    } catch (error) {
      expect((error as Error).message).to.match(/not found/)
    }
  })

  it('serializes LocalProcess registry and round-trips', async () => {
    const kernel = new Kernel()
    const process = new LocalProcess(kernel, 1, 1000000)
    kernel.processes[1] = process
    process.createSocket(0, defaultSocketOptions())

    const { registry } = createGeneratedTypeRegistry()
    process.setRpcDescription(0, registry)

    const bytes = await kernel.get_rpc_description(1, 0)
    expect(bytes.byteLength).to.be.greaterThan(0)

    const restored = deserializeTypeRegistry(bytes)
    expect(restored.getTypeByName('kernel')).to.not.equal(undefined)
    expect(restored.getTypeByName('socket_binding')).to.not.equal(undefined)
  })

  it('returns empty binary when LocalProcess has no registry', async () => {
    const kernel = new Kernel()
    const process = new LocalProcess(kernel, 1, 1000000)
    kernel.processes[1] = process
    process.createSocket(0, defaultSocketOptions())

    const bytes = await kernel.get_rpc_description(1, 0)
    expect(bytes.byteLength).to.equal(0)
  })

  it('throws get_rpc_description for missing process', async () => {
    const kernel = new Kernel()
    try {
      await kernel.get_rpc_description(42, 0)
      expect.fail('expected throw')
    } catch (error) {
      expect((error as Error).message).to.match(/not found/)
    }
  })

  it('returns non-empty rpc_description from kernel-shield.wasm', async () => {
    const code = readFileSync(KERNEL_SHIELD_WASM)
    const kernel = new Kernel()
    const pid = await kernel.spawn(code, 2048, 5_000_000)
    const bytes = await kernel.get_rpc_description(pid, 0)
    expect(bytes.byteLength).to.be.greaterThan(0)
    const restored = deserializeTypeRegistry(bytes)
    expect(restored.getTypes().length).to.be.greaterThan(0)
  })

  it('returns mock-module rpc_description without killing the process', async () => {
    // Historically mock-module trapped in rpc_description (missing wasi stubs) and
    // soft-failed to empty while corrupting the live RPC channel. It must succeed.
    const code = readFileSync(MOCK_MODULE_WASM)
    const kernel = new Kernel()
    const pid = await kernel.spawn(code, 16, 5_000_000)
    const process = kernel.processes[pid]!
    expect(process.isAlive).to.equal(true)

    const bytes = await kernel.get_rpc_description(pid, 0)
    expect(bytes.byteLength).to.be.greaterThan(0)
    expect(process.isAlive).to.equal(true)
    const restored = deserializeTypeRegistry(bytes)
    restored.assignMethodIds()
    expect(restored.getMethods().some((m) => m.memberName.includes('echo'))).to.equal(true)
  })
})

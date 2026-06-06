import { expect } from 'chai'
import { Kernel } from '../src/kernel.js'
import { LocalProcess } from '../src/LocalProcess.js'
import { monitor_flag } from '../src/kernelApi.js'
import { requestData, requestDrain } from '../src/ProcessSocketPending.js'

describe('ProcessSocketPending', () => {
  it('coalesces multiple requestData calls into one handleData', () => {
    const kernel = new Kernel()
    const process = new LocalProcess(kernel, 1, 1000000)
    let handleCount = 0
    const originalHandleData = process.handleData.bind(process)
    process.handleData = (socket: number) => {
      handleCount++
      originalHandleData(socket)
    }

    process.createSocket(0, {
      inputBufferSize: 256,
      outputBufferSize: 256,
      flushThreshold: 64,
      dataEventThreshold: 0,
      drainEventThreshold: 4,
      flags: 0,
    })

    requestData(process, 0)
    requestData(process, 0)
    requestData(process, 0)

    return new Promise<void>((resolve, reject) => {
      queueMicrotask(() => {
        try {
          expect(handleCount).to.equal(1)
          resolve()
        } catch (error) {
          reject(error)
        }
      })
    })
  })

  it('does not reenter handleData while inFlight', () => {
    const kernel = new Kernel()
    const process = new LocalProcess(kernel, 1, 1000000)
    let depth = 0
    let maxDepth = 0

    process.createSocket(0, {
      inputBufferSize: 256,
      outputBufferSize: 256,
      flushThreshold: 64,
      dataEventThreshold: 0,
      drainEventThreshold: 4,
      flags: 0,
    })
    process.createSocket(1, {
      inputBufferSize: 256,
      outputBufferSize: 256,
      flushThreshold: 64,
      dataEventThreshold: 0,
      drainEventThreshold: 4,
      flags: 0,
    })

    const originalHandleData = process.handleData.bind(process)
    process.handleData = (socket: number) => {
      depth++
      maxDepth = Math.max(maxDepth, depth)
      originalHandleData(socket)
      depth--
    }

    requestData(process, 0)
    requestData(process, 1)

    return new Promise<void>((resolve, reject) => {
      queueMicrotask(() => {
        queueMicrotask(() => {
          try {
            expect(maxDepth).to.equal(1)
            resolve()
          } catch (error) {
            reject(error)
          }
        })
      })
    })
  })

  it('processes data before drain', () => {
    const kernel = new Kernel()
    const process = new LocalProcess(kernel, 1, 1000000)
    const order: string[] = []

    process.createSocket(2, {
      inputBufferSize: 256,
      outputBufferSize: 256,
      flushThreshold: 64,
      dataEventThreshold: 0,
      drainEventThreshold: 4,
      flags: 0,
    })

    process.handleData = () => { order.push('data') }
    process.handleDrain = () => { order.push('drain') }

    requestData(process, 2)
    requestDrain(process, 2)

    return new Promise<void>((resolve, reject) => {
      queueMicrotask(() => {
        queueMicrotask(() => {
          try {
            expect(order).to.deep.equal(['data', 'drain'])
            resolve()
          } catch (error) {
            reject(error)
          }
        })
      })
    })
  })
})

describe('save', () => {
  it('returns snapshot_uid and emits process_save_event', async () => {
    const kernel = new Kernel()
    const target = new LocalProcess(kernel, 1, 1000000)
    target.memory = new Uint8Array([1, 2, 3, 4])
    kernel.processes[1] = target

    const recorder = new LocalProcess(kernel, 2, 1000000)
    kernel.processes[2] = recorder
    recorder.createSocket(3, {
      inputBufferSize: 512,
      outputBufferSize: 512,
      flushThreshold: 64,
      dataEventThreshold: 0,
      drainEventThreshold: 4,
      flags: 0,
    })

    await kernel.monitor(1, 2, 3, { flags: monitor_flag.SAVE })

    const result = await kernel.save(1)
    expect(result.snapshot_uid).to.equal(1n)
    expect(result.memory).to.deep.equal(new Uint8Array([1, 2, 3, 4]))

    const monitorSocket = recorder.getSocket(3)!
    expect(monitorSocket.inputBuffer.readableBytes()).to.be.greaterThan(0)
  })

  it('increments snapshot_uid on repeated saves', async () => {
    const kernel = new Kernel()
    const target = new LocalProcess(kernel, 1, 1000000)
    kernel.processes[1] = target

    const recorder = new LocalProcess(kernel, 2, 1000000)
    kernel.processes[2] = recorder
    recorder.createSocket(3, {
      inputBufferSize: 1024,
      outputBufferSize: 512,
      flushThreshold: 64,
      dataEventThreshold: 0,
      drainEventThreshold: 4,
      flags: 0,
    })

    await kernel.monitor(1, 2, 3, { flags: monitor_flag.SAVE })

    const first = await kernel.save(1)
    const second = await kernel.save(1)
    expect(first.snapshot_uid).to.equal(1n)
    expect(second.snapshot_uid).to.equal(2n)
  })
})

describe('save backpressure', () => {
  it('awaits until monitor consumes without growing buffer', async () => {
    const kernel = new Kernel()
    const target = new LocalProcess(kernel, 1, 1000000)
    target.memory = new Uint8Array([9, 9])
    kernel.processes[1] = target

    const recorder = new LocalProcess(kernel, 2, 1000000)
    kernel.processes[2] = recorder
    const monitorSocket = recorder.createSocket(3, {
      inputBufferSize: 64,
      outputBufferSize: 64,
      flushThreshold: 16,
      dataEventThreshold: 0,
      drainEventThreshold: 4,
      flags: 0,
    })

    await kernel.monitor(1, 2, 3, { flags: monitor_flag.SAVE })

    const frameSize = kernel.monitorEmitter.computeFrameSize('process_save_event', {
      _type: 'process_save_event',
      process: 1,
      snapshot_uid: 1n,
    })

    while (monitorSocket.inputBuffer.writableBytes() >= frameSize) {
      const writeSize = Math.min(4, monitorSocket.inputBuffer.writableBytes())
      const chunk = new Uint8Array(writeSize)
      monitorSocket.inputBuffer.write(chunk, writeSize)
      monitorSocket.inputBuffer.commitWrite(writeSize)
    }

    const initialCapacity = monitorSocket.inputBuffer.capacity()
    let saveDone = false

    const savePromise = kernel.save(1).then(result => {
      saveDone = true
      return result
    })

    await new Promise(resolve => setTimeout(resolve, 20))
    expect(saveDone).to.equal(false)
    expect(monitorSocket.inputBuffer.capacity()).to.equal(initialCapacity)

    while (monitorSocket.inputBuffer.readableBytes() > 0) {
      monitorSocket.inputBuffer.skipRead(monitorSocket.inputBuffer.readableBytes())
    }
    kernel.monitorBackpressure.notifyInputConsumed(2, 3)

    const result = await savePromise
    expect(result.snapshot_uid).to.equal(1n)
    expect(saveDone).to.equal(true)
  })
})

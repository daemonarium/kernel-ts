# Examples

## Two local processes

`LocalProcess` needs no Wasm. `bind` connects socket 0 on each side.
A flush copies the producer's output buffer into the peer's input
buffer.

```ts
import { Kernel, LocalProcess, kernelApi } from '@daemonarium/kernel'

const kernel = new Kernel()
const left = new LocalProcess(kernel, 1, 1_000_000)
const right = new LocalProcess(kernel, 2, 1_000_000)
kernel.processes[1] = left
kernel.processes[2] = right

const opts = {
  inputBufferSize: 256,
  outputBufferSize: 256,
  flushThreshold: 64,
  dataEventThreshold: 0,
  drainEventThreshold: 4,
  flags: 0
}
const leftSock = left.createSocket(0, opts)
right.createSocket(0, opts)

await kernel.bind(1, 0, 2, 0, kernelApi.direction.BOTH)

const payload = new TextEncoder().encode('ping')
leftSock.outputBuffer.write(payload, payload.length)
leftSock.flush()
```

`Direction.BOTH` is the same numeric value as `kernelApi.direction.BOTH`.
`bind` takes the kernel API enum.

## A Wasm module

The host supplies the module bytes. `spawn` instantiates a
`ModuleProcess` and returns its process id. The module then uses
socket 0 through the `waos_*` imports.

```ts
import { Kernel } from '@daemonarium/kernel'

const kernel = new Kernel()
const wasmBytes = new Uint8Array(await file.arrayBuffer())
const pid = await kernel.spawn(wasmBytes)
```

This package does not fetch or build that Wasm. A module built with
`daemonarium/gateway-cpp` can sit on socket 0 and speak the session
protocol to a peer bound by this kernel.

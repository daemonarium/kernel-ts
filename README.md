# kernel

The first Daemonarium kernel. It runs in the browser and in Node.
A process table, socket IPC, mana limits, and deterministic monitor
events. Wasm modules load through the host `WebAssembly` API.

Later kernels will implement the same process and socket contract on
other Wasm virtual machines: WAVM, Wasmer, Wasmtime, WASMEdge. This
repository is that contract's first implementation, not the only one.

The npm package is `@daemonarium/kernel`. This repository is
`daemonarium/kernel-ts`.

## Install

```
npm i @daemonarium/kernel
```

`@daemonarium/rpc` is a dependency. Sockets and circular buffers come
from that package.

## One import

```ts
import {
  Kernel,
  LocalProcess,
  ModuleProcess,
  EmscriptenProcess,
  Direction,
  kernelApi,
  pumpFlush
} from '@daemonarium/kernel'
```

`Direction` and `kernelApi.direction` use the same values. `bind`
takes `kernelApi.direction`.

## Three ways to run code

`LocalProcess` is TypeScript in the same isolate. Tests and adapters
use it.

`ModuleProcess` instantiates a Wasm module. `kernel.spawn(wasmBytes)`
creates one. The module sees `waos_socket_flush`,
`waos_socket_input_drain`, and `waos_use_mana`. It does not see the
process table.

`EmscriptenProcess` attaches to a module the host already started, for
example a WebGL loop driven by `requestAnimationFrame`. The kernel
does not call `_start`. `attachEmscripten` injects the same socket
imports.

`NativeProcess` is the TypeScript contract for a future native addon.
This package does not ship a `.node` file. A host passes an object
that implements `NativeProcessAddon`.

## One bind

```ts
await kernel.bind(1, 0, 2, 0, kernelApi.direction.BOTH)
```

Flush copies bytes from one socket's output buffer into the peer's
input buffer. A full input buffer stops the producer. That is the
backpressure.

The session protocol that can run on that socket is
`@daemonarium/gateway`. This package does not speak it.

## Recording

Monitor flags and `kernel.save` live here, at the pump, so a replay
does not depend on a proxy in front of the process. A monitor socket
is an ordered pipe of copy, data, drain, and save events. The flag
tables are in [docs/architecture.md](docs/architecture.md).

## Examples

[docs/examples.md](docs/examples.md) binds two local processes and
shows `kernel.spawn`.

## License

MIT. Upstream notices are in `NOTICE`. Conduct is in
`CODE_OF_CONDUCT.md`.

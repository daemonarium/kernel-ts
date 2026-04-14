# ts-kernel

`ts-kernel` is a minimal WA-OS kernel implementation in TypeScript.
Its main goal is to provide only the essential runtime primitives:

- process list and `process_id` allocation
- message transport through sockets
- process lifecycle and monitoring

The design is intentionally minimal because WA-OS needs equivalent kernels in multiple environments.
This implementation targets Node.js and browsers, but the same contract should also be implementable in runtimes such as WAVM, Wasmer, or WASMEdge.

## Why this kernel stays minimal

This kernel is expected to be hidden behind a first process that acts as a shield.
Other processes should not communicate with the kernel directly.

The idea is:

- keep kernel responsibilities small, deterministic, and portable
- move higher-level features to the shield process and other user processes
- keep cross-runtime behavior predictable by minimizing kernel surface area

## Core building blocks

- `Kernel`: owns the `processes` table and process lifecycle operations
- `ModuleProcess`: executes WASM modules and exposes module sockets
- `LocalProcess`: local non-WASM process, useful for tests and adapters
- `Process`: shared interface for lifecycle, socket wiring, and monitoring

## Why Message Passing and Sockets?

A fundamental design choice in WA-OS is using sockets instead of direct WASM module function calls. This provides three critical guarantees:

- **Strict Isolation & Sandboxing:** A process cannot connect to or monitor anything without invoking the kernel. This allows us to easily inject a "process shield" (similar to `kernel-shield`) in front of an untrusted process to create a perfectly safe sandbox. This isolation is mandatory for competitive bots, smart contracts, and user-extensible applications.
- **Network Transparency:** Binary message passing over sockets translates trivially to network streams, making it vastly easier to distribute processes across a cluster compared to proxying direct function calls.
- **Native Backpressure:** Sockets provide a natural boundary for flow control (unlike synchronous function calls).

## Message Transport & Buffers

Communication between processes is established by forming directed links via `bind`/`unbind`.

At its core, transport is strictly binary. When a producer flushes data, its output buffer is directly copied to the consumer's input buffer (`outputBuffer.copyTo(inputBuffer)`). Typed messages are encoded and decoded on top of this binary stream.

**Flow Control and Backpressure:**
Backpressure is naturally enforced at the binary-buffer level. It is driven by writable/readable buffer states and explicit callbacks:
- In `LocalProcess`: `flushCallback` and `drainCallback`.
- In `ModuleProcess` (WASM): `waos_socket_flush` and `waos_socket_input_drain`.

If a consumer's input buffer is full, the producer's output buffer will fill up, and the producer must wait for the consumer to drain the data.

**Why Circular Buffers?**
Serialization and deserialization happen directly into and out of circular buffers (`LocalCircularBuffer`, `LocalCircularBufferWriter`, `LocalCircularBufferReader`). 
Circular buffers provide predictable, bounded memory behavior. Because processes must manage their own memory and buffers, this explicit control over resource usage is crucial. It aligns perfectly with future requirements for charging and measurement (e.g., tracking mana/gas limits) in competitive bots and smart-contract-like workloads.

## Networking and Clusters

The binary chunk flow and explicit buffer boundaries perfectly fit network fragmentation and asynchronous delivery.

When building clustered or distributed kernel adapters, the binary stream can be easily chunked, sent over TCP/WebSocket, and reassembled on the other side. The process abstraction remains completely unbroken, as the processes are already designed to handle fragmented binary streams and asynchronous backpressure.

## Lifecycle model: alive + tombstone

Each process has `isAlive`.

- `isAlive = true`: active process
- `isAlive = false`: dead process tombstone

After `kill`, a process is not immediately removed from `Kernel.processes` if someone still monitors it.
A process slot is released only when both conditions are true:

- `isAlive === false`
- `monitors.length === 0`

Kernel-side release is centralized in `releaseProcessIfDeadAndUnmonitored(processId)`.

## Monitoring model: incoming and outgoing relations

Each process tracks two sets:

- `monitors` (incoming): who is monitoring this process
- `monitoredProcesses` (outgoing): which processes this process is monitoring

Incoming monitor entries are managed explicitly via:

- `addMonitor(monitorProcess, socketId)`
- `removeMonitor(monitorProcess, socketId)`

`monitor(...)` and `demonitor(...)` keep both sides of the relation consistent.

## Kill behavior

When a process is killed:

1. It is marked dead (`isAlive = false`)
2. All socket bindings are disconnected immediately (including peer-side references)
3. All outgoing monitor relations are removed (the dead process stops monitoring others)
4. Incoming monitors receive a death notification:
  - `process_killed_event`
  - `process_error_event` (when kill carries an error)
5. Kernel tries to release the slot, but only if incoming monitor count is already zero

Important: incoming monitors are not automatically removed after notification.
Each monitoring process must call `demonitor(...)` explicitly.

## Why tombstones are required

Tombstones protect direct process-to-process communication from `process_id` reuse races.

Consider this scenario:

1. A source process needs to talk directly to a target process
2. It gets target `process_id` from a process repository
3. The repository must guarantee that this `process_id` referred to a live target, so the repository monitors registered processes
4. Before giving out the `process_id`, the repository asks kernel to make the source process monitor the same target
5. The source process can now communicate directly and trust target liveness via monitor events

Now the race:

- target process dies
- death notification to observers may arrive slightly later
- if `process_id` were released immediately, another process could take the same ID
- source process could accidentally send traffic to the wrong process

Tombstone behavior closes this race window:

- dead process keeps its slot while still monitored
- no new valid direct communication can be attached to that dead process
- repository and source process receive death notification, stop using that `process_id`, and perform internal cleanup
- only after all relevant parties call `demonitor(...)` can the slot be recycled

This gives observers time to converge on the new state before ID reuse is allowed.

## Contract for direct communication

If a process communicates directly with another process, it should:

- monitor target liveness before relying on its `process_id`
- stop using the target ID immediately after death notification
- call `demonitor(...)` after handling cleanup

This contract is what makes tombstones effective and keeps ID reuse safe.

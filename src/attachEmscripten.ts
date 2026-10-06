import type { Kernel } from './kernel.js'
import type { EmscriptenProcess } from './EmscriptenProcess.js'

export type WaosImports = EmscriptenProcess['wasmImports']

export type EmscriptenGlue = {
  instance: WebAssembly.Instance
  memory: WebAssembly.Memory
}

export type AttachEmscriptenOptions = {
  kernel: Kernel
  loadGlue?: (waos: WaosImports) => Promise<EmscriptenGlue>
  scriptSrc?: string
}

type WaosHookGlobal = typeof globalThis & {
  __waosKernelImports?: { waos: WaosImports }
  __waosAttach?: (instance: WebAssembly.Instance, memory: WebAssembly.Memory) => void
}

type ScriptDocument = {
  createElement: (tag: string) => { src: string }
  body?: { appendChild: (n: unknown) => void }
}

function scriptDocument(): ScriptDocument | undefined {
  return (globalThis as { document?: ScriptDocument }).document
}

/**
 * Spawn an EmscriptenProcess and attach a live module.
 * Does not instantiate wasm or call module exports — glue owns WebGL / RAF.
 *
 * Pass loadGlue for tests / custom instantiate, or scriptSrc so a pre-js hook
 * (__waosKernelImports / __waosAttach) can attach after Emscripten starts.
 */
export async function attachEmscripten(
  options: AttachEmscriptenOptions
): Promise<EmscriptenProcess> {
  if (options.loadGlue) {
    const pid = await options.kernel.spawnEmscripten()
    const proc = options.kernel.processes[pid] as EmscriptenProcess
    if (!proc) {
      throw new Error('spawnEmscripten did not register a process')
    }
    const glue = await options.loadGlue(proc.wasmImports)
    proc.attach(glue.instance, glue.memory)
    return proc
  }

  const src = options.scriptSrc
  if (!src) {
    throw new Error('attachEmscripten requires loadGlue or scriptSrc')
  }

  const doc = scriptDocument()
  if (!doc) {
    throw new Error('attachEmscripten requires loadGlue when no Emscripten glue is loading')
  }

  const pid = await options.kernel.spawnEmscripten()
  const proc = options.kernel.processes[pid] as EmscriptenProcess
  if (!proc) {
    throw new Error('spawnEmscripten did not register a process')
  }

  const g = globalThis as WaosHookGlobal
  g.__waosKernelImports = { waos: proc.wasmImports }

  const attached = new Promise<void>((resolve, reject) => {
    g.__waosAttach = (instance, memory) => {
      try {
        proc.attach(instance, memory)
        resolve()
      } catch (error) {
        reject(error)
      }
    }
  })

  const script = doc.createElement('script')
  script.src = src
  doc.body?.appendChild(script)

  await attached
  delete g.__waosAttach
  delete g.__waosKernelImports
  return proc
}

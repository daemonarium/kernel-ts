import { expect } from 'chai'
import { Kernel } from '../src/kernel.js'
import { ModuleProcess } from '../src/ModuleProcess.js'
import { wasmImports } from '../src/wasmImports.js'

describe('ModuleProcess.useMana', () => {
  it('accepts the i64 bigint the gas import passes', () => {
    const proc = new ModuleProcess(new Kernel(), 1, 2048, 100)
    proc.useMana(40n)
    expect(proc.manaUsed).to.equal(40)
    proc.useMana(10)
    expect(proc.manaUsed).to.equal(50)

    wasmImports(proc).waos_use_mana(7n)
    expect(proc.manaUsed).to.equal(57)
  })
})

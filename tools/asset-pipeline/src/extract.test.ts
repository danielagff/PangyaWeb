import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mountClient } from './extract.ts'

describe('mountClient', () => {
  it('continua quando um .pak está corrompido e registra o erro', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cliente-'))
    // Rodapé apontando para 5 entradas que não existem.
    const broken = new Uint8Array(9)
    new DataView(broken.buffer).setUint32(4, 5, true)
    writeFileSync(join(dir, 'projectg_quebrado.pak'), broken)

    const { paks, vfs } = mountClient(dir)
    expect(vfs.size).toBe(0)
    expect(paks).toHaveLength(1)
    expect(paks[0]?.error).toMatch(/índice truncado na entrada 0 de 5/)
    expect(paks[0]?.error).toMatch(/bytes na posição/)
  })
})

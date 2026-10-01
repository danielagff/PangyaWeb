import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolvePangyaDir } from './config.ts'

describe('resolvePangyaDir', () => {
  it('exige PANGYA_DIR', () => {
    expect(() => resolvePangyaDir({})).toThrow(/PANGYA_DIR não definido/)
  })

  it('rejeita pasta inexistente', () => {
    expect(() => resolvePangyaDir({ PANGYA_DIR: join(tmpdir(), 'nao-existe-123') })).toThrow(
      /não existe/,
    )
  })

  it('aceita pasta existente', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pangya-'))
    expect(resolvePangyaDir({ PANGYA_DIR: dir })).toBe(dir)
  })
})

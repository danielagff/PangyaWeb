import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolvePangyaDir } from './config.ts'

const missing = join(tmpdir(), 'nao-existe-123')

describe('resolvePangyaDir', () => {
  it('falha sem PANGYA_DIR e sem a pasta padrão', () => {
    expect(() => resolvePangyaDir({}, missing)).toThrow(/Cliente não encontrado/)
  })

  it('usa a pasta padrão quando PANGYA_DIR não está definido', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cliente-jp-'))
    expect(resolvePangyaDir({}, dir)).toBe(dir)
  })

  it('rejeita PANGYA_DIR inexistente', () => {
    expect(() => resolvePangyaDir({ PANGYA_DIR: missing })).toThrow(/não existe/)
  })

  it('PANGYA_DIR tem prioridade sobre a pasta padrão', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pangya-'))
    expect(resolvePangyaDir({ PANGYA_DIR: dir }, missing)).toBe(dir)
  })
})

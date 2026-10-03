import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  EXTRACTION_VERSION,
  extractionVersion,
  mountClient,
  parsePakKey,
  removeGarbledFiles,
  writeExtractionMarker,
} from './extract.ts'

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

describe('parsePakKey', () => {
  it('lê 4 números hex', () => {
    expect(parsePakKey('0x020a5fd4, 1eebdff,0x02b3c6a0,0x04f6a3e1')).toEqual([
      0x020a5fd4, 0x01eebdff, 0x02b3c6a0, 0x04f6a3e1,
    ])
  })

  it('aceita vazio e rejeita formato inválido', () => {
    expect(parsePakKey('')).toBeUndefined()
    expect(() => parsePakKey('1,2,3')).toThrow(/PAK_KEY inválida/)
  })
})

describe('extração antiga com nomes coreanos corrompidos', () => {
  it('apaga só os arquivos com nome corrompido que esta extração não gravou', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pangya-ext-'))
    const file = (path: string) => {
      mkdirSync(join(dir, path, '..'), { recursive: true })
      writeFileSync(join(dir, path), 'x')
      return resolve(dir, path)
    }
    const old = file('data/sound/ﾆﾎｾﾟ.wav') // "팡야.wav" lido como japonês
    const oldDir = file('data/ｻﾒｸｮ/a.wav') // pasta com nome corrompido
    const lost = file('data/f-ﾀﾌｱﾛｹ�.wav')
    const good = file('data/sound/팡야.wav')
    const ascii = file('data/sound/birdie.wav')
    const kept = file('data/ui/ﾃｽﾄ.png') // gravado agora (nome japonês de verdade)
    expect(removeGarbledFiles(dir, new Set([good, ascii, kept]))).toBe(3)
    expect([old, oldDir, lost].some(existsSync)).toBe(false)
    expect(existsSync(join(dir, 'data/ｻﾒｸｮ'))).toBe(false)
    expect([good, ascii, kept].every(existsSync)).toBe(true)
  })

  it('marca a versão da extração (sem marca = antiga)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pangya-ext-'))
    expect(extractionVersion(dir)).toBe(0)
    writeExtractionMarker(dir)
    expect(extractionVersion(dir)).toBe(EXTRACTION_VERSION)
  })
})

import { describe, expect, it } from 'vitest'
import { lz772Decompress, lz77Decompress } from './lz77.ts'
import { PAK_FOOTER_SIZE, PAK_VERSION, readPakEntry, readPakIndex } from './pak.ts'
import { PAK_KEYS, xteaBlocks, xteaDecrypt, xteaEncrypt } from './xtea.ts'

const text = (s: string) => new TextEncoder().encode(s)

// "abc" literal + cópia de 6 bytes a 3 de distância = "abcabcabc"
const LZ77_ABC = new Uint8Array([0x08, 0x61, 0x62, 0x63, 0x03, 0x40])
// Mesmo conteúdo na variante ofuscada: máscara ^ 0xC8, cabeçalho ^ 0xFF21
const LZ772_ABC = new Uint8Array([0xc0, 0x61, 0x62, 0x63, 0x22, 0xbf])

interface FakeEntry {
  path: string
  data: Uint8Array
  size?: number
  type: 0 | 1 | 2 | 3
}

/** Monta um .pak sintético; versão 1 (XOR) ou 3 (XTEA com chave JP). */
function buildPak(entries: FakeEntry[], entryVersion: 1 | 3): Uint8Array {
  const parts: Uint8Array[] = []
  const index: Uint8Array[] = []
  let offset = 0

  for (const e of entries) {
    parts.push(e.data)
    let name = text(e.path.replaceAll('/', '\\'))
    let size = e.size ?? e.data.length
    let off = offset

    if (entryVersion === 1) {
      name = Uint8Array.from([...name, 0], (b, i) => (i < name.length ? b ^ 0x71 : 0))
      size ^= 0x71
    } else {
      const padded = new Uint8Array(Math.ceil(name.length / 8) * 8)
      padded.set(name)
      xteaBlocks(PAK_KEYS.jp, padded, true)
      name = padded
      ;[off, size] = xteaEncrypt(PAK_KEYS.jp, off, size)
    }

    const head = new Uint8Array(14)
    const view = new DataView(head.buffer)
    head[0] = entryVersion === 3 ? name.length : name.length - 1
    head[1] = (entryVersion << 4) | e.type
    view.setUint32(2, off, true)
    view.setUint32(6, e.data.length, true)
    view.setUint32(10, size, true)
    index.push(head, name)
    offset += e.data.length
  }

  const footer = new Uint8Array(PAK_FOOTER_SIZE)
  const fv = new DataView(footer.buffer)
  fv.setUint32(0, offset, true)
  fv.setUint32(4, entries.length, true)
  fv.setUint8(8, PAK_VERSION)

  const all = [...parts, ...index, footer]
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of all) {
    out.set(p, at)
    at += p.length
  }
  return out
}

const FILES: FakeEntry[] = [
  { path: 'data/readme.txt', data: text('Pangya!'), type: 0 },
  { path: 'model/ball.pet', data: LZ77_ABC, size: 9, type: 1 },
  { path: 'model/club.pet', data: LZ772_ABC, size: 9, type: 3 },
]

describe('xtea', () => {
  it('cifra e decifra de volta', () => {
    const [a, b] = xteaEncrypt(PAK_KEYS.jp, 0x12345678, 0x9abcdef0)
    expect(xteaDecrypt(PAK_KEYS.jp, a, b)).toEqual([0x12345678, 0x9abcdef0])
  })
})

describe('lz77', () => {
  it('descomprime com cópias sobrepostas', () => {
    expect(new TextDecoder().decode(lz77Decompress(LZ77_ABC, 9))).toBe('abcabcabc')
  })

  it('descomprime a variante ofuscada', () => {
    expect(new TextDecoder().decode(lz772Decompress(LZ772_ABC, 9))).toBe('abcabcabc')
  })

  it('rejeita referência para antes do início', () => {
    expect(() => lz77Decompress(new Uint8Array([0x01, 0x05, 0x00]), 4)).toThrow(/inválida/)
  })
})

describe.each([1, 3] as const)('readPakIndex (entradas v%i)', (version) => {
  const pak = buildPak(FILES, version)

  it('lista as entradas com caminho e tipo', () => {
    const index = readPakIndex(pak)
    expect(index.version).toBe(PAK_VERSION)
    expect(index.entries.map((e) => [e.path, e.type])).toEqual([
      ['data/readme.txt', 'raw'],
      ['model/ball.pet', 'lz77'],
      ['model/club.pet', 'lz772'],
    ])
    if (version === 3) expect(index.region).toBe('jp')
  })

  it('extrai o conteúdo de cada entrada', () => {
    const [readme, ball, club] = readPakIndex(pak).entries
    const decode = (e: typeof readme) => new TextDecoder().decode(readPakEntry(pak, e!))
    expect(decode(readme)).toBe('Pangya!')
    expect(decode(ball)).toBe('abcabcabc')
    expect(decode(club)).toBe('abcabcabc')
  })
})

it('rejeita arquivo que não é .pak', () => {
  expect(() => readPakIndex(new Uint8Array(4))).toThrow(/pequeno demais/)
})

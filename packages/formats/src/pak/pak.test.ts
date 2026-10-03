import { describe, expect, it } from 'vitest'
import { lz772Decompress, lz77Decompress } from './lz77.ts'
import {
  decodePakName,
  findPakKey,
  PAK_FOOTER_SIZE,
  PAK_VERSION,
  PakIndexError,
  readPakEntry,
  readPakIndex,
} from './pak.ts'
import { PAK_KEYS, xteaBlocks, xteaDecrypt, xteaEncrypt, type XteaKey } from './xtea.ts'

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

/** Monta um .pak sintético; entradas versão 1 (XOR) ou 2 (XTEA). */
function buildPak(
  entries: FakeEntry[],
  entryVersion: 1 | 2,
  key: XteaKey = PAK_KEYS.jp,
): Uint8Array {
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
      xteaBlocks(key, padded, true)
      name = padded
      ;[off, size] = xteaEncrypt(key, off, size)
    }

    const head = new Uint8Array(14)
    const view = new DataView(head.buffer)
    head[0] = entryVersion === 2 ? name.length : name.length - 1
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

describe.each([1, 2] as const)('readPakIndex (entradas v%i)', (version) => {
  const pak = buildPak(FILES, version)

  it('lista as entradas com caminho e tipo', () => {
    const index = readPakIndex(pak)
    expect(index.version).toBe(PAK_VERSION)
    expect(index.entries.map((e) => [e.path, e.type])).toEqual([
      ['data/readme.txt', 'raw'],
      ['model/ball.pet', 'lz77'],
      ['model/club.pet', 'lz772'],
    ])
    if (version === 2) expect(index.region).toBe('jp')
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

it('explica onde o índice quebrou', () => {
  const pak = buildPak(FILES, 1)
  // Aumenta o tamanho do nome da 2ª entrada: o resto do índice fica desalinhado.
  const view = new DataView(pak.buffer)
  const indexOffset = view.getUint32(pak.length - PAK_FOOTER_SIZE, true)
  pak[indexOffset + 14 + 16]! += 40
  try {
    readPakIndex(pak)
    expect.unreachable()
  } catch (err) {
    expect(err).toBeInstanceOf(PakIndexError)
    expect((err as PakIndexError).details.entriesRead[0]?.path).toBe('data/readme.txt')
  }
})

describe('chave customizada', () => {
  const custom: XteaKey = [0x11223344, 0x55667788, 0x99aabbcc, 0xddeeff00]
  const pak = buildPak([{ path: 'model', data: new Uint8Array(), type: 2 }, ...FILES], 2, custom)

  it('sem a chave, explica que ela é desconhecida', () => {
    expect(() => readPakIndex(pak)).toThrow(/chave XTEA desconhecida/)
  })

  it('com a chave, lê o índice', () => {
    expect(readPakIndex(pak, custom).entries.map((e) => e.path)).toContain('model/ball.pet')
  })

  it('encontra a chave escondida em outro arquivo', () => {
    const exe = new Uint8Array(4096).map((_, i) => (i * 37) & 0xff)
    const view = new DataView(exe.buffer)
    custom.forEach((k, i) => view.setUint32(1000 + i * 4, k, true))
    expect(findPakKey(pak, exe)).toEqual([custom])
  })
})

describe('nome das entradas', () => {
  const bytes = (...b: number[]) => Uint8Array.from([...b, 0])
  it('nome coreano (CP949) vira coreano, não katakana de meia largura', () => {
    // "팡야.wav" e "sound\\발자국_green.wav" como o time coreano gravou.
    expect(decodePakName(bytes(0xc6, 0xce, 0xbe, 0xdf, 0x2e, 0x77, 0x61, 0x76))).toBe('팡야.wav')
    expect(
      decodePakName(
        bytes(0x73, 0x5c, 0xb9, 0xdf, 0xc0, 0xda, 0xb1, 0xb9, 0x5f, 0x67, 0x2e, 0x77, 0x61, 0x76),
      ),
    ).toBe('s/발자국_g.wav')
  })

  it('nome japonês (Shift-JIS) e ASCII continuam iguais', () => {
    expect(decodePakName(bytes(0x83, 0x47, 0x83, 0x41, 0x81, 0x5b))).toBe('エアー')
    expect(decodePakName(bytes(0x61, 0x5c, 0x62, 0x2e, 0x70, 0x65, 0x74))).toBe('a/b.pet')
  })
})

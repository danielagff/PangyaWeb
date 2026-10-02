import { describe, expect, it } from 'vitest'
import { readDds } from './dds.ts'
import { Writer } from '../test-writer.ts'

interface Format {
  flags: number
  fourCC?: string
  bits?: number
  masks?: [number, number, number, number]
}

function header(w: Writer, width: number, height: number, f: Format) {
  w.fixed('DDS ', 4).u32(124).u32(0).u32(height).u32(width).u32(0).u32(0).u32(1)
  for (let i = 0; i < 11; i++) w.u32(0)
  w.u32(32)
    .u32(f.flags)
    .fixed(f.fourCC ?? '', 4)
    .u32(f.bits ?? 0)
  for (const m of f.masks ?? [0, 0, 0, 0]) w.u32(m)
  for (let i = 0; i < 5; i++) w.u32(0)
  return w
}

const pixel = (img: ReturnType<typeof readDds>, x: number, y: number) =>
  Array.from(img.rgba.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4))

describe('readDds', () => {
  it('decodifica DXT1 com 4 cores e respeita a posição de cada pixel', () => {
    // c0 = vermelho puro (0xF800), c1 = azul puro (0x001F); índices: linha 0 = 0,1,2,3.
    const w = header(new Writer(), 4, 4, { flags: 0x4, fourCC: 'DXT1' })
    w.u16(0xf800).u16(0x001f).u32(0b11_10_01_00)
    const img = readDds(w.done())
    expect(img).toMatchObject({ width: 4, height: 4, format: 'DXT1' })
    expect(pixel(img, 0, 0)).toEqual([255, 0, 0, 255])
    expect(pixel(img, 1, 0)).toEqual([0, 0, 255, 255])
    expect(pixel(img, 2, 0)).toEqual([170, 0, 85, 255])
    expect(pixel(img, 3, 0)).toEqual([85, 0, 170, 255])
    expect(pixel(img, 0, 3)).toEqual([255, 0, 0, 255])
  })

  it('DXT1 com c0 <= c1 usa o índice 3 como transparente', () => {
    const w = header(new Writer(), 4, 4, { flags: 0x4, fourCC: 'DXT1' })
    w.u16(0x001f).u16(0xf800).u32(0xffffffff)
    expect(pixel(readDds(w.done()), 2, 2)).toEqual([0, 0, 0, 0])
  })

  it('decodifica o alfa de DXT3 e DXT5', () => {
    const dxt3 = header(new Writer(), 4, 4, { flags: 0x4, fourCC: 'DXT3' })
    dxt3.bytes([0xf0, 0, 0, 0, 0, 0, 0, 0]).u16(0xffff).u16(0xffff).u32(0)
    const a3 = readDds(dxt3.done())
    expect(pixel(a3, 0, 0)).toEqual([255, 255, 255, 0])
    expect(pixel(a3, 1, 0)[3]).toBe(255)

    const dxt5 = header(new Writer(), 4, 4, { flags: 0x4, fourCC: 'DXT5' })
    // a0=255, a1=0; pixel 0 → índice 1 (0), pixel 1 → índice 0 (255), resto índice 0.
    dxt5.bytes([255, 0, 0b0000_0001, 0, 0, 0, 0, 0]).u16(0).u16(0).u32(0)
    const a5 = readDds(dxt5.done())
    expect(pixel(a5, 0, 0)[3]).toBe(0)
    expect(pixel(a5, 1, 0)[3]).toBe(255)
  })

  it('decodifica formatos sem compressão por máscara (BGRA 32 e 16 bits 4444)', () => {
    const w32 = header(new Writer(), 1, 1, {
      flags: 0x41,
      bits: 32,
      masks: [0x00ff0000, 0x0000ff00, 0x000000ff, 0xff000000],
    })
    w32.bytes([30, 20, 10, 128]) // B G R A na memória
    expect(pixel(readDds(w32.done()), 0, 0)).toEqual([10, 20, 30, 128])

    const w16 = header(new Writer(), 1, 1, {
      flags: 0x41,
      bits: 16,
      masks: [0x0f00, 0x00f0, 0x000f, 0xf000],
    })
    w16.u16(0x8f0f) // a=8, r=15, g=0, b=15
    expect(pixel(readDds(w16.done()), 0, 0)).toEqual([255, 0, 255, 136])
  })

  it('rejeita arquivos que não são .dds ou estão truncados', () => {
    expect(() => readDds(new Uint8Array(200))).toThrow(/magic/)
    const w = header(new Writer(), 8, 8, { flags: 0x4, fourCC: 'DXT1' })
    expect(() => readDds(w.done())).toThrow(/truncado/)
  })
})

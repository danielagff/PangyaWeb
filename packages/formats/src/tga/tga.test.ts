import { describe, expect, it } from 'vitest'
import { readTga } from './tga.ts'

/** Cabeçalho TGA de 18 bytes. */
function header(type: number, width: number, height: number, bpp: number, descriptor: number) {
  const h = new Uint8Array(18)
  h[2] = type
  h[12] = width
  h[14] = height
  h[16] = bpp
  h[17] = descriptor
  return h
}

describe('readTga', () => {
  it('32 bits sem compressão, de baixo para cima (BGRA → RGBA, linha 0 no topo)', () => {
    // 1×2: a primeira linha gravada é a de baixo (azul), depois a de cima (vermelho, meio alfa).
    const bytes = new Uint8Array([...header(2, 1, 2, 32, 8), 255, 0, 0, 255, 0, 0, 255, 128])
    expect([...readTga(bytes).rgba]).toEqual([255, 0, 0, 128, 0, 0, 255, 255])
  })

  it('24 bits com RLE, de cima para baixo', () => {
    // 3×1: pacote repetido de 2 pixels verdes + pacote cru de 1 pixel branco.
    const bytes = new Uint8Array([
      ...header(10, 3, 1, 24, 0x20),
      0x81,
      0,
      255,
      0,
      0x00,
      255,
      255,
      255,
    ])
    const image = readTga(bytes)
    expect(image.width).toBe(3)
    expect([...image.rgba]).toEqual([0, 255, 0, 255, 0, 255, 0, 255, 255, 255, 255, 255])
  })
})

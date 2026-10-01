import { describe, expect, it } from 'vitest'
import { BinaryReader } from './binary-reader.ts'

describe('BinaryReader', () => {
  it('lê inteiros e floats little-endian em sequência', () => {
    const buf = new Uint8Array(13)
    const view = new DataView(buf.buffer)
    view.setUint8(0, 0xab)
    view.setUint16(1, 0x1234, true)
    view.setUint32(3, 0xdeadbeef, true)
    view.setFloat32(7, 1.5, true)
    view.setUint16(11, 7, true)

    const r = new BinaryReader(buf)
    expect(r.u8()).toBe(0xab)
    expect(r.u16()).toBe(0x1234)
    expect(r.u32()).toBe(0xdeadbeef)
    expect(r.f32()).toBe(1.5)
    expect(r.u16()).toBe(7)
    expect(r.remaining).toBe(0)
  })

  it('lê string de tamanho fixo até o terminador zero', () => {
    const buf = new Uint8Array(8)
    buf.set(new TextEncoder().encode('Nuri'))
    const r = new BinaryReader(buf)
    expect(r.fixedString(8)).toBe('Nuri')
    expect(r.offset).toBe(8)
  })

  it('falha ao ler além do fim', () => {
    const r = new BinaryReader(new Uint8Array(3))
    expect(() => r.u32()).toThrow(RangeError)
  })
})

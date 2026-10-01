import { describe, expect, it } from 'vitest'
import { BinaryReader } from './binary-reader.ts'
import { array, pad, str, struct, u16, u32 } from './codec.ts'

describe('struct', () => {
  const layout = struct({ id: u32, name: str(8), skipped: pad(2), stats: array(u16, 3) })

  it('soma o tamanho dos campos', () => {
    expect(layout.size).toBe(4 + 8 + 2 + 6)
  })

  it('lê os campos em ordem', () => {
    const bytes = new Uint8Array(layout.size)
    const view = new DataView(bytes.buffer)
    view.setUint32(0, 42, true)
    bytes.set(new TextEncoder().encode('Kooh'), 4)
    view.setUint16(14, 1, true)
    view.setUint16(16, 2, true)
    view.setUint16(18, 3, true)
    expect(layout.read(new BinaryReader(bytes))).toEqual({
      id: 42,
      name: 'Kooh',
      skipped: undefined,
      stats: [1, 2, 3],
    })
  })

  it('decodifica Shift-JIS', () => {
    // "ケン" em Shift-JIS
    const bytes = new Uint8Array([0x83, 0x50, 0x83, 0x93, 0, 0])
    expect(str(6).read(new BinaryReader(bytes))).toBe('ケン')
  })
})

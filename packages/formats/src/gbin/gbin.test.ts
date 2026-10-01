import { describe, expect, it } from 'vitest'
import { Writer } from '../test-writer.ts'
import { holePoints, readGbin } from './gbin.ts'

const TEE = [0xbd, 0xc3, 0xc0, 0xdb, 0xc1, 0xa1] // "시작점" em CP949
const PIN = [0xb3, 0xa1, 0xc1, 0xa1] // "끝점" em CP949
const IDENT = [1, 0, 0, 0, 1, 0, 0, 0, 1]

function element(w: Writer, name: string, at: [number, number, number], courseType = 0) {
  return w
    .u8(0b01011) // anim = 3, colisão = 1
    .u8(0)
    .u16(0)
    .u32(2) // faces
    .fixed(name, 32)
    .f32(0, 0, 0, 1, 1, 1)
    .f32(0, 0, 0, 1, 10, 1)
    .f32(...IDENT, ...at)
    .i32(courseType)
    .fixed('', 32) // script (versão > 0x70)
}

function sampleGbin() {
  const w = new Writer()
    .bytes(new TextEncoder().encode('WEPX'))
    .u32(0x71)
    .u32(1) // global
    .u32(0) // type0
    .u32(0) // type1
    .u32(1) // câmeras
    .u32(2) // luzes
    .u32(0) // soundboxes
    .u32(1) // texturas
    .u32(1) // nós
  w.fixed('cam_tee', 32).f32(0, 5, -10).f32(0, 0, 0).f32(60, 0)
  w.u8(0).fixedBytes(TEE, 32).f32(1, 2, 3)
  w.u8(0).fixedBytes(PIN, 32).f32(100, 0, 400)
  w.fixed('grass.dds', 32)
  w.fixed('ai_path', 16).u32(2).u32(7).f32(0, 0, 0, 1, 1, 1)
  element(w, 'pink_01.pet', [0, 0, 0]) // base (terreno)
  w.u32(0).u32(0).u32(0).u32(0).u32(0).u32(0) // cor por vértice da base: 2 faces × 3
  element(w, 's_tree09.pet', [50, 0, 200], 3)
  w.u8(4) // par
  w.f32(1, 3, 2, 4) // 2 tees
  w.f32(100, 400, 101, 401, 102, 402, 110, 410, 111, 411, 112, 412) // 2×3 pins
  return w.done()
}

describe('readGbin', () => {
  const gbin = readGbin(sampleGbin())

  it('lê cabeçalho, câmeras, texturas e nós', () => {
    expect(gbin.version).toBe(0x71)
    expect(gbin.cameras[0]).toMatchObject({ name: 'cam_tee', position: [0, 5, -10], fov: 60 })
    expect(gbin.textures).toEqual(['grass.dds'])
    expect(gbin.nodes[0]).toMatchObject({
      name: 'ai_path',
      type: 7,
      points: [
        [0, 0, 0],
        [1, 1, 1],
      ],
    })
  })

  it('identifica tee e pin pelos nomes coreanos das luzes', () => {
    expect(gbin.lights.map((l) => l.special)).toEqual(['tee', 'pin'])
    expect(holePoints(gbin)).toEqual({ tees: [[1, 2, 3]], pins: [[100, 0, 400]] })
  })

  it('lê o terreno base e os elementos com matriz de mundo', () => {
    expect(gbin.base).toMatchObject({ name: 'pink_01.pet', animFlag: 3, collisionFlag: 1 })
    expect(gbin.elements).toHaveLength(1)
    expect(gbin.elements[0]).toMatchObject({ name: 's_tree09.pet', courseType: 3 })
    expect(gbin.elements[0]!.matrix.slice(9)).toEqual([50, 0, 200])
  })

  it('lê par, tees e pins do mapCheck', () => {
    expect(gbin.mapCheck).toMatchObject({
      par: 4,
      tees: [
        [1, 3],
        [2, 4],
      ],
    })
    expect(gbin.mapCheck?.pins?.[1]?.[2]).toEqual([112, 412])
  })

  it('rejeita arquivo sem o magic', () => {
    expect(() => readGbin(new Uint8Array(16))).toThrow(/WEPX/)
  })
})

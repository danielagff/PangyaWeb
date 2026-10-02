import { describe, expect, it } from 'vitest'
import type { Pet } from '../pet/pet.ts'
import { Writer } from '../test-writer.ts'
import { boxesFromModels, readPycb, solidBoxes } from './pycb.ts'

const cube = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
  [
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y0, z1],
    [x0, y0, z1],
    [x0, y1, z0],
    [x1, y1, z0],
    [x1, y1, z1],
    [x0, y1, z1],
  ] as [number, number, number][]

function pycb(boxes: { name: string; flag: number; corners: number[][] }[]) {
  const w = new Writer().fixed('PYCB', 4).u32(1).f32(0, 0, 0).u32(boxes.length)
  for (const b of boxes) {
    w.fixed(b.name, 32).u32(b.flag)
    for (const c of b.corners) w.f32(...c)
  }
  return w.done()
}

describe('readPycb', () => {
  it('lê as caixas e associa as sub-caixas ao objeto anterior', () => {
    const boxes = readPycb(
      pycb([
        { name: 'tree.pet', flag: 0, corners: cube(0, 0, 0, 10, 20, 10) },
        { name: 'Trunk', flag: 1, corners: cube(4, 0, 4, 6, 20, 6) },
        { name: 'Window_glow', flag: 1, corners: cube(0, 0, 0, 1, 1, 1) },
        { name: 'Huge', flag: 1, corners: cube(0, 0, -99999, 1, 1, 99999) },
      ]),
    )
    expect(boxes.map((b) => [b.name, b.model])).toEqual([
      ['tree.pet', 'tree.pet'],
      ['Trunk', 'tree.pet'],
      ['Window_glow', 'tree.pet'],
      ['Huge', 'tree.pet'],
    ])
    expect(boxes[1]!.corners[6]).toEqual([6, 20, 6])
    expect(solidBoxes(boxes).map((b) => b.name)).toEqual(['Trunk'])
  })

  it('rejeita arquivos que não são .pycb', () => {
    expect(() => readPycb(new Uint8Array(24))).toThrow(/PYCB/)
  })
})

describe('boxesFromModels', () => {
  it('aplica a matriz do osso e a da instância aos blocos COLL', () => {
    const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]
    const pet = {
      bones: [{ name: 'Trunk', parent: -1, matrix: [...identity.slice(0, 9), 5, 0, 0] }],
      collisions: [
        {
          shape: 1,
          show: 1,
          boxName: 'Trunk',
          boneName: 'Trunk',
          options: ['', ''],
          min: [-1, 0, -1],
          max: [1, 10, 1],
        },
      ],
    } as unknown as Pet
    const [box] = boxesFromModels(
      [{ model: 'tree.pet', matrix: [...identity.slice(0, 9), 100, 0, 0] }],
      new Map([['tree.pet', pet]]),
    )
    expect(box!.corners[0]).toEqual([104, 0, -1])
    expect(box!.corners[6]).toEqual([106, 10, 1])
  })
})

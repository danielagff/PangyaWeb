import { describe, expect, it } from 'vitest'
import { readSoundBoxes } from './hole-data.ts'

const box = {
  min: [0, 0, 0] as [number, number, number],
  max: [1, 1, 1] as [number, number, number],
}

describe('caixas de som do .gbin', () => {
  it('separa o som ambiente dos bichos do cenário', () => {
    // Como no blue_01.gbin do Blue Lagoon.
    const info = readSoundBoxes([
      { type: 0, name: '바다', box },
      { type: 1, name: '*type 0 *pet NPC_SeaGull.pet *num 5', box },
      { type: 1, name: '*type 1 *pet NPC_Butterfly.pet *num 2 ', box },
      { type: 1, name: '*type 4 *pet NPC_Dolphin.pet', box },
      { type: 0, name: '', box },
      { type: 0, name: '*extra', box },
      { type: 0, name: '바다', box },
    ])
    expect(info.ambient).toEqual(['바다'])
    expect(info.npcs.map((n) => [n.model, n.count])).toEqual([
      ['NPC_SeaGull.pet', 5],
      ['NPC_Butterfly.pet', 2],
      ['NPC_Dolphin.pet', 1],
    ])
  })
})

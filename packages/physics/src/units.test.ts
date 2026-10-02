import { describe, expect, it } from 'vitest'
import { metersToUnits, unitsToMeters, unitsToYards, yardsToUnits } from './units.ts'

describe('unidades', () => {
  it('jardas e altura em metros (como no HUD do jogo) vão e voltam', () => {
    expect(unitsToYards(yardsToUnits(232))).toBeCloseTo(232)
    expect(unitsToMeters(metersToUnits(-3.84))).toBeCloseTo(-3.84)
    expect(unitsToMeters(3.2 * 1.094)).toBeCloseTo(1)
  })
})

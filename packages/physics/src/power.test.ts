import { describe, expect, it } from 'vitest'
import { CLUBS } from './clubs.ts'
import { distanceBand, NO_BONUS, powerRange } from './power.ts'

describe('powerRange', () => {
  const player = { power: 15, bonus: NO_BONUS }

  it('usa a distância base do taco', () => {
    expect(powerRange(CLUBS['1W'], 'ge58', player, 'none')).toBe(230)
    expect(powerRange(CLUBS['7I'], 'ge58', player, 'none')).toBe(130)
  })

  it('soma power shot e atributo power nas madeiras', () => {
    expect(powerRange(CLUBS['1W'], 'ge58', { ...player, power: 20 }, 'one')).toBe(230 + 10 + 10)
    expect(powerRange(CLUBS['7I'], 'ge58', { ...player, power: 20 }, 'two')).toBe(130 + 20)
  })

  it('wedges perto do green usam alcance curto', () => {
    expect(powerRange(CLUBS.SW, distanceBand(20), player, 'none')).toBe(30)
    expect(powerRange(CLUBS.SW, distanceBand(40), player, 'one')).toBe(80)
  })
})

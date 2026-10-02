import { describe, expect, it } from 'vitest'
import { applyShot, isChipIn, scoreName, scoreToPar, startHole } from './hole.ts'

const at = (x: number) => ({ x, y: 0, z: 0 })

describe('regras do buraco', () => {
  it('conta tacadas e acompanha a bola até a cova', () => {
    let s = startHole(4, at(0))
    s = applyShot(s, { type: 'stop', at: at(200), surface: 'fairway' })
    expect(s).toMatchObject({ strokes: 1, lie: 'fairway', ball: at(200), finished: false })
    s = applyShot(s, { type: 'stop', at: at(380), surface: 'green' })
    s = applyShot(s, { type: 'hole', at: at(400) })
    expect(s).toMatchObject({ strokes: 3, finished: true, result: 'holed', holedFrom: 'green' })
    expect(s.shots.map((shot) => shot.lie)).toEqual(['tee', 'fairway', 'green'])
    expect(isChipIn(s)).toBe(false)
    expect(scoreName(s.strokes, s.par)).toBe('Birdie')
  })

  it('água: +1 e a bola vai para o ponto de recolocação', () => {
    const s = applyShot(startHole(3, at(0)), {
      type: 'water',
      at: at(150),
      dropAt: at(140),
      dropSurface: 'rough',
    })
    expect(s).toMatchObject({ strokes: 2, penalties: 1, ball: at(140), lie: 'rough' })
  })

  it('O.B.: +1 e a bola volta para onde a tacada saiu', () => {
    let s = startHole(5, at(0))
    s = applyShot(s, { type: 'stop', at: at(250), surface: 'rough' })
    s = applyShot(s, { type: 'outOfBounds', at: at(999) })
    expect(s).toMatchObject({ strokes: 3, penalties: 1, ball: at(250), lie: 'rough' })
  })

  it('desiste ao atingir o limite de tacadas', () => {
    let s = startHole(3, at(0), 2)
    s = applyShot(s, { type: 'outOfBounds', at: at(1) })
    expect(s).toMatchObject({ strokes: 2, finished: true, result: 'gaveUp' })
    expect(() => applyShot(s, { type: 'hole', at: at(0) })).toThrow()
  })

  it('chip-in e nomes de resultado', () => {
    let s = startHole(4, at(0))
    s = applyShot(s, { type: 'stop', at: at(300), surface: 'rough' })
    s = applyShot(s, { type: 'hole', at: at(400) })
    expect(isChipIn(s)).toBe(true)
    expect(scoreName(1, 3)).toBe('Hole in One')
    expect(scoreName(2, 5)).toBe('Albatross')
    expect(scoreName(3, 5)).toBe('Eagle')
    expect(scoreName(4, 4)).toBe('Par')
    expect(scoreName(9, 4)).toBe('+5')
    expect(scoreToPar(3, 4)).toBe('-1')
    expect(scoreToPar(4, 4)).toBe('E')
    expect(scoreToPar(6, 4)).toBe('+2')
  })
})

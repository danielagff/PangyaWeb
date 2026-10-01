import { describe, expect, it } from 'vitest'
import { CLUB_IDS } from './clubs.ts'
import {
  DEFAULT_PLAYER,
  FlightSimulator,
  simulateFlight,
  type ShotInput,
  type SpecialShot,
} from './flight.ts'

const shot = (extra: Partial<ShotInput> = {}): ShotInput => ({
  club: '1W',
  player: DEFAULT_PLAYER,
  percent: 1,
  ...extra,
})

describe('simulateFlight', () => {
  it('é determinística', () => {
    const input = shot({ spin: 0.3, curve: -0.5, wind: { speed: 4, degree: 135 } })
    expect(simulateFlight(input).frames).toEqual(simulateFlight(input).frames)
  })

  it('mantém as distâncias de referência (regressão)', () => {
    const carries = Object.fromEntries(
      CLUB_IDS.filter((c) => !c.startsWith('PT')).map((club) => [
        club,
        Math.round(simulateFlight(shot({ club })).carry * 10) / 10,
      ]),
    )
    expect(carries).toMatchInlineSnapshot(`
      {
        "1W": 192.8,
        "2I": 149.8,
        "2W": 175.3,
        "3I": 142.5,
        "3W": 156.7,
        "4I": 134.7,
        "5I": 127,
        "6I": 117.6,
        "7I": 107.9,
        "8I": 99,
        "9I": 89.8,
        "PW": 80,
        "SW": 63.1,
      }
    `)
  })

  it('tacos mais longos vão mais longe', () => {
    const ordered = ['1W', '2W', '3W', '2I', '5I', '9I', 'PW', 'SW'] as const
    const carries = ordered.map((club) => simulateFlight(shot({ club })).carry)
    for (let i = 1; i < carries.length; i++) expect(carries[i]).toBeLessThan(carries[i - 1]!)
  })

  it('mais força na barra = mais distância', () => {
    expect(simulateFlight(shot({ percent: 0.5 })).carry).toBeLessThan(
      simulateFlight(shot({ percent: 0.8 })).carry,
    )
  })

  it('pousa na altura pedida', () => {
    expect(simulateFlight(shot(), 10).landing.y).toBeCloseTo(10, 6)
  })

  it('vento a favor aumenta e contra diminui a distância', () => {
    const none = simulateFlight(shot()).carry
    expect(simulateFlight(shot({ wind: { speed: 5, degree: 0 } })).carry).toBeGreaterThan(none)
    expect(simulateFlight(shot({ wind: { speed: 5, degree: 180 } })).carry).toBeLessThan(none)
  })

  it('vento lateral desvia a bola para lados opostos', () => {
    const right = simulateFlight(shot({ wind: { speed: 5, degree: 90 } })).lateral
    const left = simulateFlight(shot({ wind: { speed: 5, degree: 270 } })).lateral
    expect(Math.sign(right)).toBe(-Math.sign(left))
    expect(Math.abs(right)).toBeGreaterThan(1)
  })

  it('curva abre a trajetória e volta para perto da mira', () => {
    const result = simulateFlight(shot({ curve: 1 }))
    const maxLateral = Math.max(
      ...Array.from({ length: result.frames.length / 3 }, (_, i) =>
        Math.abs(result.frames[i * 3]!),
      ),
    )
    expect(maxLateral / 3.2).toBeGreaterThan(10)
    expect(Math.abs(result.lateral)).toBeLessThan(5)
  })

  it('tacadas especiais têm trajetórias distintas', () => {
    const fly = (special: SpecialShot) => simulateFlight(shot({ shot: special, powerShot: 'one' }))
    const dunk = fly('dunk')
    const tomahawk = fly('tomahawk')
    const spike = fly('spike')
    const cobra = fly('cobra')

    expect(tomahawk.carry).toBeGreaterThan(dunk.carry)
    expect(spike.carry).toBeGreaterThan(dunk.carry)
    expect(spike.apex).toBeGreaterThan(tomahawk.apex)
    expect(cobra.apex).toBeLessThan(dunk.apex)
  })
})

describe('flyOverGround', () => {
  it('em chão plano cai no mesmo lugar que flyTo', () => {
    const flat = new FlightSimulator(shot()).flyOverGround(() => 0)
    const reference = simulateFlight(shot(), 0)
    expect(flat.landed).toBe(true)
    expect(flat.carry).toBeCloseTo(reference.carry, 3)
  })

  it('chão mais alto encurta o voo', () => {
    const uphill = new FlightSimulator(shot()).flyOverGround(() => 60)
    expect(uphill.landing.y).toBeCloseTo(60, 3)
    expect(uphill.carry).toBeLessThan(simulateFlight(shot(), 0).carry)
  })
})

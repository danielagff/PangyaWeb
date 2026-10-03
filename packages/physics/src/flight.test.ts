import { describe, expect, it } from 'vitest'
import { CLUB_IDS } from './clubs.ts'
import {
  BAR_CARRY_SHARE,
  beamCapture,
  CUP_BEAM,
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

  it('modelo do SuperSS (√força) mantém as distâncias de referência (regressão)', () => {
    const carries = Object.fromEntries(
      CLUB_IDS.filter((c) => !c.startsWith('PT')).map((club) => [
        club,
        Math.round(
          new FlightSimulator(shot({ club }), undefined, { launchScale: 1 }).flyTo(0).carry * 10,
        ) / 10,
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

  it('a barra é a distância de verdade: x% da barra voa x% do voo do taco (o resto rola)', () => {
    for (const club of ['1W', '3W', '5I', '9I', 'PW', 'SW'] as const) {
      for (const percent of [0.1, 0.373, 0.5, 0.75, 1]) {
        const result = simulateFlight(shot({ club, percent }))
        expect(result.carry).toBeCloseTo(percent * BAR_CARRY_SHARE * result.range, 2)
      }
    }
    // Vídeo do tutorial: 1W de 230y a 100% voa 219y.
    const full = simulateFlight(shot())
    expect(full.range).toBe(230)
    expect(full.carry).toBeCloseTo(219, 2)
  })

  it('vale com mais força, power shot e faixa curta das wedges', () => {
    const strong = { ...DEFAULT_PLAYER, power: 40 }
    for (const extra of [
      { player: strong },
      { powerShot: 'two' as const },
      { club: 'SW' as const, targetDistance: 40 },
    ]) {
      const result = simulateFlight(shot({ ...extra, percent: 0.62 }))
      expect(result.carry).toBeCloseTo(0.62 * BAR_CARRY_SHARE * result.range, 2)
    }
  })

  it('vento, spin e curva mudam a distância a partir da barra', () => {
    const base = simulateFlight(shot({ percent: 0.6 })).carry
    expect(
      simulateFlight(shot({ percent: 0.6, wind: { speed: 5, degree: 0 } })).carry,
    ).toBeGreaterThan(base)
    expect(simulateFlight(shot({ percent: 0.6, spin: 0.8 })).carry).not.toBeCloseTo(base, 0)
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

  // Curva e tacadas especiais: conferidas no modelo do SuperSS (√força). Com a barra sendo a
  // distância real a bola sai mais rápida e a curva abre mais (1W a 100%: cai ~12 y ao lado
  // da mira; no SuperSS, ~1 y) — ajuste da curva e das especiais pendente (ESTADO.md).
  const superss = (input: ShotInput) =>
    new FlightSimulator(input, undefined, { launchScale: Math.sqrt(input.percent) }).flyTo(0)

  it('curva abre a trajetória e volta para perto da mira (SuperSS, 100%)', () => {
    const result = superss(shot({ curve: 1 }))
    const maxLateral = Math.max(
      ...Array.from({ length: result.frames.length / 3 }, (_, i) =>
        Math.abs(result.frames[i * 3]!),
      ),
    )
    expect(maxLateral / 3.2).toBeGreaterThan(10)
    expect(Math.abs(result.lateral)).toBeLessThan(5)
  })

  it('tacadas especiais têm trajetórias distintas (SuperSS)', () => {
    const fly = (special: SpecialShot) => superss(shot({ shot: special, powerShot: 'one' }))
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

describe('luz da cova (beamCapture)', () => {
  const cup = { x: 0, y: 0, z: 0 }
  it('pega a bola que passa baixa por cima da cova', () => {
    const at = beamCapture({ x: -2, y: 1.2, z: 0 }, { x: 2, y: 0.8, z: 0 }, cup)
    expect(at).toBeDefined()
    expect(at!.x).toBeCloseTo(0)
  })
  it('não faz milagre: alta demais ou longe da cova, passa', () => {
    expect(beamCapture({ x: -2, y: 5, z: 0 }, { x: 2, y: 4, z: 0 }, cup)).toBeUndefined()
    expect(beamCapture({ x: -2, y: 1, z: 2 }, { x: 2, y: 0.5, z: 2 }, cup)).toBeUndefined()
  })
  it('limite de altura em CUP_BEAM', () => {
    const h = CUP_BEAM.height
    expect(beamCapture({ x: -1, y: h - 0.1, z: 0 }, { x: 1, y: h - 0.1, z: 0 }, cup)).toBeDefined()
    expect(
      beamCapture({ x: -1, y: h + 0.1, z: 0 }, { x: 1, y: h + 0.1, z: 0 }, cup),
    ).toBeUndefined()
  })
})

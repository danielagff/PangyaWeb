import type { SurfaceClass } from '@pangya/formats'
import { describe, expect, it } from 'vitest'
import { solveShot, type ShotSolution } from './calculator.ts'
import { startHole } from './hole.ts'
import type { HoleData } from './hole-data.ts'
import { HoleWorld } from './world.ts'

const surface = (kind: SurfaceClass['kind']): SurfaceClass => ({
  name: kind,
  kind,
  sort: '',
  bound: kind === 'green' ? 0.3 : 0.4,
  roll: kind === 'green' ? 0.18 : 0.2,
  power: { min: 100, max: 100 },
  pass: false,
  boundSound: '',
  rollSound: '',
  pet: '',
  textures: [],
})

/**
 * Buraco sintético: fairway em y = 0 até z = 400, rampa descendo até `drop` em z = 600 e
 * green dali em diante, com o pin em z = `pinZ` (unidades; 3,2 = 1 jarda).
 */
function hole(pinZ: number, drop = 0, obstacles: HoleData['obstacles'] = []): HoleWorld {
  const quad = (z0: number, y0: number, z1: number, y1: number) => [
    -600,
    y0,
    z0,
    600,
    y0,
    z0,
    600,
    y1,
    z1,
    -600,
    y0,
    z0,
    600,
    y1,
    z1,
    -600,
    y1,
    z1,
  ]
  const triangles = Float32Array.from([
    ...quad(-100, 0, 400, 0),
    ...quad(400, 0, 600, drop),
    ...quad(600, drop, 2000, drop),
  ])
  const data: HoleData = {
    ref: { round: 'teste', prefix: 't', hole: 1 },
    par: 3,
    tee: [0, 0, 0],
    pin: [0, pinZ > 600 ? drop : 0, pinZ],
    terrain: [],
    collision: {
      triangles,
      surfaces: ['fairway', 'fairway', 'fairway', 'fairway', 'green', 'green'].map((k) =>
        surface(k as SurfaceClass['kind']),
      ),
    },
    objects: [],
    missingModels: [],
    fog: undefined,
    obstacles,
    obstacleSource: 'pycb',
    ambient: [],
    npcs: [],
  }
  return new HoleWorld(data)
}

const calm = { speed: 0, degree: 0 }
const solve = (world: HoleWorld, wind = calm, club: 'PT1' | '1W' | '5I' = '1W') =>
  solveShot(world, startHole(world.par, world.tee), wind, { club, powerShot: 'none', power: 15 })

describe('calculadora (G)', () => {
  it('no plano e sem vento: a força é a distância ÷ alcance e entra de dunk', () => {
    const world = hole(640) // pin a 200 y; 1W de 230 y
    const result = solve(world) as ShotSolution
    expect(result.holed).toBe(true)
    expect(result.percent).toBeCloseTo(200 / 230, 3)
    expect(result.aim).toBeCloseTo(0, 4)
  })

  it('com vento de lado e o pin mais baixo: mira e força corrigidas, entra de dunk', () => {
    for (const wind of [
      { speed: 5, degree: 90 },
      { speed: 7, degree: 200 },
      { speed: 3, degree: 330 },
    ]) {
      const world = hole(700, -12)
      const result = solve(world, wind) as ShotSolution
      expect(result.holed).toBe(true)
      expect(result.miss).toBeLessThan(0.05)
    }
  })

  it('o taco escolhido não alcança: usa um mais longo', () => {
    const result = solve(hole(640), calm, '5I') as ShotSolution
    expect(result.holed).toBe(true)
    expect(['3W', '2W', '1W']).toContain(result.club)
  })

  it('longe demais para todos os tacos: diz quanto falta', () => {
    const result = solve(hole(1400))
    expect(result).toMatchObject({ reason: 'outOfReach', club: '1W' })
    expect('shortBy' in result && result.shortBy).toBeGreaterThan(100)
  })

  it('obstáculo no caminho: avisa onde a bola bate', () => {
    // Parede alta a 60 y (192 unidades) na linha do pin.
    const wall = {
      name: 'parede',
      flag: 0,
      model: 'parede.pet',
      corners: [
        [-50, 0, 190],
        [50, 0, 190],
        [50, 0, 194],
        [-50, 0, 194],
        [-50, 400, 190],
        [50, 400, 190],
        [50, 400, 194],
        [-50, 400, 194],
      ] as [number, number, number][],
    }
    const result = solve(hole(640, 0, [wall]))
    expect(result).toMatchObject({ reason: 'obstacle' })
    expect('obstacleAt' in result && result.obstacleAt).toBeGreaterThan(55)
    expect('obstacleAt' in result && result.obstacleAt).toBeLessThan(61)
  })

  it('no green (putter) ainda não calcula', () => {
    expect(solve(hole(640), calm, 'PT1')).toMatchObject({ reason: 'putter' })
  })
})

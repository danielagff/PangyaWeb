import { describe, expect, it } from 'vitest'
import { DEFAULT_PLAYER, FlightSimulator } from './flight.ts'
import { simulateGround, type GroundAt } from './ground.ts'
import { deflect, Obstacles } from './obstacles.ts'

/** Caixa alinhada aos eixos, na ordem de cantos do .pycb. */
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => ({
  name: 'parede',
  corners: [
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y0, z1],
    [x0, y0, z1],
    [x0, y1, z0],
    [x1, y1, z0],
    [x1, y1, z1],
    [x0, y1, z1],
  ] as [number, number, number][],
})

const at = (x: number, y: number, z: number) => ({ x, y, z })
const flat: GroundAt = () => ({
  y: 0,
  normal: [0, 1, 0],
  surface: { kind: 'fairway', bound: 0.4, roll: 0.2 },
})

describe('Obstacles', () => {
  const wall = new Obstacles([box(-50, 0, 100, 50, 80, 110)])

  it('acha o ponto e a normal da face atingida', () => {
    const hit = wall.hit(at(0, 10, 90), at(0, 10, 105))!
    expect(hit.t).toBeCloseTo(10 / 15)
    expect(hit.point.z).toBeCloseTo(100)
    expect(hit.normal.z).toBeCloseTo(-1)
    expect(hit.name).toBe('parede')
  })

  it('ignora segmentos que não cruzam ou que já começam dentro', () => {
    expect(wall.hit(at(0, 90, 90), at(0, 90, 120))).toBeUndefined()
    expect(wall.hit(at(0, 10, 105), at(0, 10, 120))).toBeUndefined()
  })

  it('funciona com caixa girada (45° em Y)', () => {
    const s = Math.SQRT1_2 * 10
    const rotated = new Obstacles([
      {
        corners: [
          [0, 0, -s],
          [s, 0, 0],
          [0, 0, s],
          [-s, 0, 0],
          [0, 20, -s],
          [s, 20, 0],
          [0, 20, s],
          [-s, 20, 0],
        ],
      },
    ])
    const hit = rotated.hit(at(-20, 5, 0), at(20, 5, 0))!
    expect(hit.point.x).toBeCloseTo(-s)
    expect(hit.normal.x).toBeLessThan(0)
  })

  it('deflect devolve parte da velocidade normal e freia a tangencial', () => {
    const v = deflect(at(0, 0, 10), at(0, 0, -1))
    expect(v.z).toBeCloseTo(-3)
  })
})

describe('bola contra objetos', () => {
  it('o voo termina ao bater na parede e a bola volta', () => {
    const wall = new Obstacles([box(-500, 0, 300, 500, 500, 310)])
    const flight = new FlightSimulator({
      club: '1W',
      player: DEFAULT_PLAYER,
      percent: 1,
    }).flyOverGround(() => 0, -1000, wall)
    expect(flight.obstacle).toBe('parede')
    expect(flight.landing.z).toBeLessThan(300)
    expect(flight.velocity.z).toBeLessThan(0)
    const ground = simulateGround(
      { position: flight.landing, velocity: flight.velocity, spin: flight.spin },
      flat,
      wall,
    )
    expect(ground.final.z).toBeLessThan(300)
  })

  it('a bola rolando bate no objeto e volta', () => {
    const wall = new Obstacles([box(-50, 0, 40, 50, 30, 50)])
    const result = simulateGround(
      { position: at(0, 0, 0), velocity: at(0, 0, 30), rolling: true },
      flat,
      wall,
    )
    expect(result.events.some((e) => e.type === 'obstacle')).toBe(true)
    expect(result.final.z).toBeLessThan(40)
  })
})

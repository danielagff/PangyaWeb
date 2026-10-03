import type { SurfaceClass } from '@pangya/formats'
import { describe, expect, it } from 'vitest'
import { applyShot, startHole } from './hole.ts'
import type { HoleData } from './hole-data.ts'
import { describeShot, HoleWorld, sanitizeRequest } from './world.ts'
import { decodeFrames, encodeFrames } from './protocol.ts'

const surface = (kind: SurfaceClass['kind'], bound: number, roll: number): SurfaceClass => ({
  name: kind,
  kind,
  sort: '',
  bound,
  roll,
  power: { min: 90, max: 100 },
  pass: false,
  boundSound: '',
  rollSound: '',
  pet: '',
  textures: [],
})

/** Faixa plana de z = -100 a 2000: fairway até z = 1200, green depois. */
function flatHole(): HoleData {
  const quad = (z0: number, z1: number) => [
    -400,
    0,
    z0,
    400,
    0,
    z0,
    400,
    0,
    z1,
    -400,
    0,
    z0,
    400,
    0,
    z1,
    -400,
    0,
    z1,
  ]
  const triangles = Float32Array.from([...quad(-100, 1200), ...quad(1200, 2000)])
  const fairway = surface('fairway', 0.4, 0.2)
  const green = surface('green', 0.3, 0.18)
  return {
    ref: { round: 'teste', prefix: 't', hole: 1 },
    par: 4,
    tee: [0, 0, 0],
    pin: [0, 0, 1400],
    terrain: [],
    collision: { triangles, surfaces: [fairway, fairway, green, green] },
    objects: [],
    missingModels: [],
    fog: undefined,
    obstacles: [],
    obstacleSource: 'pycb',
    ambient: [],
    npcs: [],
  }
}

const calm = { speed: 0, degree: 0 }

describe('HoleWorld', () => {
  const world = new HoleWorld(flatHole())

  it('sugere o taco pela distância e o putter no green', () => {
    const tee = startHole(4, world.tee)
    expect(world.suggestClub(tee).club).toBe('1W')
    const near = { ...tee, ball: { x: 0, y: 0, z: 1300 }, lie: 'green' }
    expect(world.suggestClub(near)).toMatchObject({ club: 'PT1' })
  })

  it('joga a tacada do tee até parar no fairway, na direção da mira', () => {
    const state = startHole(4, world.tee)
    const shot = world.play(
      state,
      { club: '1W', percent: 1, aim: world.aimAtPin(state.ball) },
      calm,
    )
    expect(shot.outcome.type).toBe('stop')
    expect(shot.outcome.at.z).toBeGreaterThan(600)
    expect(Math.abs(shot.outcome.at.x)).toBeLessThan(5)
    expect(shot.groundPower).toBe(100)
    expect(describeShot(state.ball, shot)).toMatch(/^voo \d+\.\dy \+ rolagem/)
  })

  it('a força do piso sai sorteada quando a bola para e a tacada seguinte usa ela', () => {
    const state = startHole(4, world.tee)
    const shot = world.play(state, { club: '1W', percent: 1, aim: 0 }, calm, () => 0.25)
    expect(shot.outcome).toMatchObject({ type: 'stop', surface: 'fairway' })
    const power = (shot.outcome as { liePower: number }).liePower
    expect(power).toBe(93) // faixa do fairway do teste: 90–100%, sorteio 0,25 (arredondado)
    const next = applyShot(state, shot.outcome)
    const request = { club: '5I' as const, percent: 0.8, aim: 0 }
    // Sorteio novo ignorado: vale a força já sorteada.
    expect(world.shotInput(next, request, calm, () => 0.99).ground).toBe(93)
  })

  it('a linha do tempo vai da batida ao fim, em quadros crescentes', () => {
    const state = startHole(4, world.tee)
    const shot = world.play(state, { club: '1W', percent: 1, aim: 0 }, calm)
    const types = shot.events.map((e) => e.type)
    expect(types[0]).toBe('hit')
    expect(types).toContain('bounce')
    expect(types).toContain('roll')
    expect(types.at(-1)).toBe('stop')
    const frames = shot.events.map((e) => e.frame)
    expect(frames).toEqual([...frames].sort((a, b) => a - b))
    expect(frames.at(-1)).toBeLessThan(shot.frames.length / 3)
    expect(shot.events.find((e) => e.type === 'bounce')?.surface).toBe('fairway')
  })

  it('putt na direção do pin entra na cova', () => {
    const state = { ...startHole(4, world.tee), ball: { x: 0, y: 0, z: 1390 }, lie: 'green' }
    const request = { club: 'PT1' as const, percent: 4 / 30, aim: world.aimAtPin(state.ball) }
    expect(world.play(state, request, calm).outcome.type).toBe('hole')
  })

  it('fora do terreno é O.B. e volta ao último ponto válido do caminho', () => {
    const state = startHole(4, world.tee)
    const shot = world.play(state, { club: '1W', percent: 1, aim: Math.PI / 2 }, calm)
    expect(shot.outcome.type).toBe('outOfBounds')
    if (shot.outcome.type !== 'outOfBounds') return
    const drop = shot.outcome.dropAt!
    expect(world.surfaceAt(drop.x, drop.z)).toBeDefined()
    // Longe da saída (andou pelo caminho), não de volta ao tee.
    expect(Math.hypot(drop.x - state.ball.x, drop.z - state.ball.z)).toBeGreaterThan(10)
  })

  it('predictLanding cai perto de onde a tacada real pousa sem vento', () => {
    const state = startHole(4, world.tee)
    const request = { club: '7I' as const, percent: 1, aim: 0 }
    const landing = world.predictLanding(state, request)
    expect(landing.z).toBeGreaterThan(300)
    expect(landing.z).toBeLessThan(world.play(state, request, calm).outcome.at.z)
  })
})

describe('sanitizeRequest e frames', () => {
  it('limita valores fora da faixa e rejeita taco inválido', () => {
    const r = sanitizeRequest({ club: '1W', percent: 5, spin: -9, aim: 1, shot: 'xx' as never })
    expect(r).toMatchObject({ percent: 1, spin: -1, shot: 'dunk', powerShot: 'none' })
    expect(() => sanitizeRequest({ club: 'XX' as never, percent: 1, aim: 0 })).toThrow()
  })

  it('codifica e decodifica a trajetória sem perda', () => {
    const frames = Float32Array.from([1.5, -2.25, 1e6, 0])
    expect(Array.from(decodeFrames(encodeFrames(frames)))).toEqual(Array.from(frames))
  })
})

describe('erro de impacto da barra', () => {
  const world = new HoleWorld(flatHole())
  const state = startHole(4, world.tee)
  const shot = (impact?: number) =>
    world.play(
      state,
      { club: '5I', percent: 1, aim: 0, ...(impact !== undefined && { impact }) },
      calm,
    )

  it('perto do centro é Pangya (igual a sem barra)', () => {
    expect(shot(0.1).outcome.at).toEqual(shot().outcome.at)
    expect(describeShot(state.ball, shot(0.1))).toMatch(/^✨ PANGYA!/)
  })

  it('fora do centro curva para o lado do erro', () => {
    const left = shot(0.8).outcome.at.x
    const right = shot(-0.8).outcome.at.x
    expect(Math.sign(left)).not.toBe(Math.sign(right))
    expect(Math.abs(left)).toBeGreaterThan(3)
  })

  it('fora da zona perde força', () => {
    expect(shot(2).carry).toBeLessThan(shot(0.9).carry)
    expect(describeShot(state.ball, shot(2))).toMatch(/errou a zona/)
  })
})

import { describe, expect, it } from 'vitest'
import { DEFAULT_PLAYER, FlightSimulator, type ShotInput } from './flight.ts'
import { simulateGround, type GroundAt, type GroundSurface } from './ground.ts'
import { unitsToYards } from './units.ts'

const SURFACES = {
  road: { kind: 'road', bound: 0.7, roll: 0.1 },
  fairway: { kind: 'fairway', bound: 0.4, roll: 0.2 },
  green: { kind: 'green', bound: 0.3, roll: 0.18 },
  rough: { kind: 'rough', bound: 0.2, roll: 0.42 },
  bunker: { kind: 'bunker', bound: 0.1, roll: 0.6 },
  water: { kind: 'water', bound: 0.1, roll: 0.5 },
} satisfies Record<string, GroundSurface>

const flat =
  (surface: GroundSurface): GroundAt =>
  () => ({ y: 0, normal: [0, 1, 0], surface })

function shot(club: ShotInput['club'], surface: GroundSurface, spin = 0) {
  const flight = new FlightSimulator({
    club,
    player: DEFAULT_PLAYER,
    percent: 1,
    spin,
  }).flyOverGround(() => 0)
  const ground = simulateGround(
    { position: flight.landing, velocity: flight.velocity, spin },
    flat(surface),
  )
  const run = unitsToYards(
    Math.hypot(ground.final.x - flight.landing.x, ground.final.z - flight.landing.z),
  )
  return { flight, ground, run, total: flight.carry + run }
}

describe('simulateGround', () => {
  it('voo + rolagem no fairway ≈ alcance do HUD de cada taco', () => {
    for (const club of ['1W', '7I', 'SW'] as const) {
      const { total, flight } = shot(club, SURFACES.fairway)
      expect(Math.abs(total - flight.range) / flight.range).toBeLessThan(0.05)
    }
  })

  it('a bola rola mais em pisos rápidos', () => {
    const runs = (['road', 'fairway', 'rough', 'bunker'] as const).map(
      (s) => shot('1W', SURFACES[s]).run,
    )
    for (let i = 1; i < runs.length; i++) expect(runs[i]).toBeLessThan(runs[i - 1]!)
  })

  it('backspin segura a bola', () => {
    expect(shot('PW', SURFACES.green, 1).run).toBeLessThan(shot('PW', SURFACES.green, 0).run / 2)
  })

  it('para na água', () => {
    const { ground } = shot('1W', SURFACES.water)
    expect(ground.outcome).toBe('water')
  })

  it('sai do mapa quando não há chão', () => {
    const edge: GroundAt = (x, z) =>
      Math.hypot(x, z) < 400 ? flat(SURFACES.road)(x, z) : undefined
    const ground = simulateGround(
      { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: -10, z: 200 } },
      edge,
    )
    expect(ground.outcome).toBe('outOfBounds')
  })

  it('desce a ladeira a partir do repouso', () => {
    // Plano inclinado ~30°: y = -0.577 z (normal apontando para +z e para cima).
    const n: [number, number, number] = [0, Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)]
    const slope: GroundAt = (_x, z) => ({ y: -0.577 * z, normal: n, surface: SURFACES.fairway })
    const ground = simulateGround(
      { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
      (x, z) => (z < 300 ? slope(x, z) : undefined),
    )
    expect(ground.final.z).toBeGreaterThan(50)
  })

  it('cai na cova quando passa devagar por cima dela', () => {
    const ground = simulateGround(
      {
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: -1, z: 8 },
        cup: { x: 0, y: 0, z: 3 },
      },
      flat(SURFACES.green),
    )
    expect(ground.outcome).toBe('hole')
  })
})

import { describe, expect, it } from 'vitest'
import { TerrainGrid } from './terrain.ts'

// Rampa: dois triângulos cobrindo x,z ∈ [0, 100], altura y = x / 10.
const ramp = new Float32Array([0, 0, 0, 100, 10, 0, 100, 10, 100, 0, 0, 0, 100, 10, 100, 0, 0, 100])

describe('TerrainGrid', () => {
  const grid = new TerrainGrid(ramp)

  it('interpola a altura dentro dos triângulos', () => {
    expect(grid.groundAt(50, 20)?.y).toBeCloseTo(5)
    expect(grid.groundAt(80, 90)?.y).toBeCloseTo(8)
  })

  it('informa qual triângulo foi atingido', () => {
    expect(grid.groundAt(90, 10)?.triangle).toBe(0)
    expect(grid.groundAt(10, 90)?.triangle).toBe(1)
  })

  it('retorna undefined fora do terreno', () => {
    expect(grid.groundAt(150, 50)).toBeUndefined()
  })

  it('escolhe o chão mais alto quando há sobreposição', () => {
    const twoFloors = new Float32Array([...ramp, 0, 50, 0, 100, 50, 0, 0, 50, 100])
    expect(new TerrainGrid(twoFloors).groundAt(10, 10)?.y).toBe(50)
  })
})

import { describe, expect, it } from 'vitest'
import { lerpFactor, Smooth } from './smooth.ts'

/** Roda a mola até `seconds` com quadros de `dt`, guardando cada valor. */
function run(smooth: Smooth, target: number, seconds: number, dt: number) {
  const values: number[] = []
  for (let t = 0; t < seconds - 1e-9; t += dt) values.push(smooth.update(target, dt))
  return values
}

describe('mola da câmera', () => {
  it('chega no alvo sem passar e sem pular: começa devagar, acelera e freia', () => {
    const values = run(new Smooth(0, 0.2), 10, 2, 1 / 60)
    expect(values.at(-1)).toBeCloseTo(10, 2)
    expect(Math.max(...values)).toBeLessThanOrEqual(10 + 1e-6)
    // primeiro passo pequeno (sem tranco), depois os passos crescem antes de diminuir
    const steps = values.map((v, i) => v - (values[i - 1] ?? 0))
    expect(steps[0]).toBeLessThan(steps[3]!)
    expect(steps[0]).toBeLessThan(0.1 * 10)
  })

  it('o mesmo movimento com 30 ou 144 quadros por segundo', () => {
    const slow = run(new Smooth(0, 0.2), 10, 0.5, 1 / 30).at(-1)!
    const fast = run(new Smooth(0, 0.2), 10, 0.5, 1 / 144).at(-1)!
    expect(Math.abs(slow - fast)).toBeLessThan(0.15)
  })

  it('lerp por quadro convertido para o tempo', () => {
    expect(lerpFactor(0.08, 1 / 60)).toBeCloseTo(0.08)
    expect(lerpFactor(0.08, 1 / 30)).toBeCloseTo(1 - 0.92 ** 2)
  })
})

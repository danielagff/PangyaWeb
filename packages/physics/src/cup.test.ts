import { describe, expect, it } from 'vitest'
import { CUP_DEPTH, CUP_FALL, dropIntoCup } from './cup.ts'

const cup = { x: 0, y: 0, z: 0 }

/** Maior mudança de velocidade entre quadros seguidos (sem contar o quique no fundo). */
function maxJerk(frames: number[], until: number) {
  let worst = 0
  for (let i = 2; i * 3 + 1 < until; i++) {
    const v1 = [0, 1, 2].map((k) => frames[(i - 1) * 3 + k]! - frames[(i - 2) * 3 + k]!)
    const v2 = [0, 1, 2].map((k) => frames[i * 3 + k]! - frames[(i - 1) * 3 + k]!)
    worst = Math.max(worst, Math.hypot(v2[0]! - v1[0]!, v2[1]! - v1[1]!, v2[2]! - v1[2]!))
  }
  return worst
}

describe('bola caindo na cova', () => {
  it('continua a velocidade que trazia e termina no fundo', () => {
    // Rolando a 0,05 por quadro na direção da cova.
    const previous = { x: 0.55, y: 0, z: 0 }
    const from = { x: 0.5, y: 0, z: 0 }
    const frames = [previous.x, previous.y, previous.z, from.x, from.y, from.z]
    frames.push(...dropIntoCup(from, cup, 4, previous))
    const n = frames.length
    expect(frames.slice(n - 3)).toEqual([0, -CUP_DEPTH, 0])
    // Primeiro passo da curva perto da velocidade de chegada (sem tranco na entrada).
    expect(frames[6]! - frames[3]!).toBeCloseTo(-0.05, 1)
    // Até chegar ao fundo, a velocidade muda pouco por quadro (gravidade e curva suave).
    const firstBottom = frames.findIndex((v, i) => i % 3 === 1 && v <= -CUP_DEPTH)
    expect(maxJerk(frames, firstBottom)).toBeLessThan(CUP_FALL.gravity * 3)
    // Não sobe antes de cair (no máximo um fio).
    for (let i = 1; i < n; i += 3) expect(frames[i]!).toBeLessThanOrEqual(0.005)
  })

  it('cai mesmo parada na borda e não passa do fundo', () => {
    const frames = dropIntoCup({ x: 0.3, y: 0, z: 0 }, cup)
    for (let i = 1; i < frames.length; i += 3) expect(frames[i]!).toBeGreaterThanOrEqual(-CUP_DEPTH)
    expect(frames.length / 3).toBeLessThan(CUP_FALL.maxFrames + 10)
  })
})

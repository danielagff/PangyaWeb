/**
 * Fase no chão: quiques e rolagem depois que a bola toca o terreno.
 *
 * Modelo próprio (o jogo não publica essa parte), usando os coeficientes reais de cada piso
 * do <curso>_property.xml: `bound` = quanto da velocidade normal sobra no quique,
 * `roll` = atrito de rolagem. Constantes de ajuste em GROUND_TUNING, calibradas para que
 * voo + rolagem no fairway (bound 0.4, roll 0.2) a 100% dê o alcance do HUD de cada taco
 * (1W 228/230, 7I 131/130, SW 77/80) — a confirmar contra o jogo original. O atrito de
 * rolagem é baixo para a bola sentir as inclinações (essencial no green).
 */

import { STEP_TIME } from './flight.ts'
import type { Normal } from './terrain.ts'
import { deflect, pushOut, type Obstacles } from './obstacles.ts'
import { yardsToUnits } from './units.ts'
import type { Vec3 } from './vec3.ts'

export interface GroundSurface {
  /** Tipo de piso (ex.: 'green', 'water'), só repassado nos eventos. */
  kind: string
  bound: number
  roll: number
}

export interface GroundQuery {
  y: number
  normal: Normal
  surface: GroundSurface
}

/** Terreno visto pela fase no chão; undefined = fora do mapa. */
export type GroundAt = (x: number, z: number) => GroundQuery | undefined

/** Evento da bola no chão; `step` é o índice do quadro em `frames` (para sons/efeitos). */
export type GroundEvent = (
  | { type: 'bounce'; surface: string; at: Vec3 }
  | { type: 'roll'; surface: string; at: Vec3 }
  | { type: 'obstacle'; name: string; at: Vec3 }
  | { type: 'water'; at: Vec3 }
  | { type: 'outOfBounds'; at: Vec3 }
  | { type: 'hole'; at: Vec3 }
  | { type: 'stop'; surface: string; at: Vec3 }
) & { step?: number }

export interface GroundResult {
  /** Posições a cada passo (x, y, z intercalados), começando no ponto de pouso. */
  frames: Float32Array
  events: GroundEvent[]
  final: Vec3
  /** Último evento (como a bola terminou). */
  outcome: GroundEvent['type']
  surface: string | undefined
}

export const GROUND_TUNING = {
  gravity: 34.295295715332,
  /** Desaceleração de rolagem = roll × gravidade × este fator. */
  rollFriction: 0.5,
  /** Fração da velocidade tangencial perdida em cada quique (atrito do impacto). */
  impactFriction: 0.75,
  /** Efeito do spin no primeiro quique: backspin (> 0) freia, topspin (< 0) acelera. */
  spinOnBounce: 0.6,
  /** Abaixo desta velocidade normal (unidades/s) o quique vira rolagem. */
  minBounceSpeed: 4,
  /** Abaixo desta velocidade (unidades/s) a bola para, se a ladeira não a empurrar. */
  stopSpeed: 0.6,
  /** Raio de captura da cova (unidades) e velocidade máxima para cair nela. */
  cupRadius: 0.55,
  cupMaxSpeed: 14,
  maxSteps: 3000,
}

const dot = (a: Vec3, b: Normal) => a.x * b[0] + a.y * b[1] + a.z * b[2]
const len = (v: Vec3) => Math.hypot(v.x, v.y, v.z)

export interface GroundInput {
  position: Vec3
  velocity: Vec3
  /** Spin da tacada (-1..1), afeta só o primeiro quique. */
  spin?: number
  /** Posição da cova; se omitida, não há captura. */
  cup?: Vec3
  /** Começa rolando (putt), sem tratar o primeiro contato como quique. */
  rolling?: boolean
}

/**
 * Velocidade inicial (unidades/s) para um putt rolar `yards` em piso plano com o `roll`
 * dado: na rolagem a desaceleração é constante, então d = v² / 2a.
 */
export function puttSpeed(yards: number, roll: number): number {
  const decel = roll * GROUND_TUNING.gravity * GROUND_TUNING.rollFriction
  return Math.sqrt(2 * decel * yardsToUnits(yards))
}

export function simulateGround(
  input: GroundInput,
  groundAt: GroundAt,
  obstacles?: Obstacles,
): GroundResult {
  const k = GROUND_TUNING
  const frames: number[] = []
  const events: GroundEvent[] = []
  let p = { ...input.position }
  let v = { ...input.velocity }
  let airborne: boolean
  let firstBounce = true
  let lastSurface: string | undefined

  const push = () => frames.push(p.x, p.y, p.z)
  const finish = (event: GroundEvent): GroundResult => {
    events.push({ ...event, step: frames.length / 3 })
    push()
    return {
      frames: Float32Array.from(frames),
      events,
      final: p,
      outcome: event.type,
      surface: lastSurface,
    }
  }

  // Começa no chão onde a bola pousou (ou no ar, se o voo terminou batendo num objeto).
  let ground = groundAt(p.x, p.z)
  if (!ground) return finish({ type: 'outOfBounds', at: p })
  p.y = Math.max(p.y, ground.y)

  /** Move a bola até `next`, rebatendo se o caminho cruzar um objeto. */
  const moveTo = (next: Vec3) => {
    const hit = obstacles?.hit(p, next)
    if (!hit) {
      p = { ...next }
      return false
    }
    p = { ...pushOut(hit) }
    v = { ...deflect(v, hit.normal) }
    events.push({ type: 'obstacle', name: hit.name, at: { ...p }, step: frames.length / 3 })
    return true
  }
  // Tacada normal: o primeiro contato é tratado como impacto (quique). Putt: já rola.
  airborne = !input.rolling

  for (let step = 0; step < k.maxSteps; step++) {
    push()
    ground = groundAt(p.x, p.z)
    if (!ground) return finish({ type: 'outOfBounds', at: p })
    lastSurface = ground.surface.kind
    if (ground.surface.kind === 'water' || ground.surface.kind === 'waterPass') {
      if (p.y <= ground.y + 0.01) return finish({ type: 'water', at: p })
    }

    if (input.cup) {
      const dx = p.x - input.cup.x
      const dz = p.z - input.cup.z
      if (Math.hypot(dx, dz) < k.cupRadius && len(v) < k.cupMaxSpeed && p.y <= ground.y + 0.5) {
        p = { ...input.cup }
        return finish({ type: 'hole', at: p })
      }
    }

    if (airborne) {
      // Voo curto entre quiques: só gravidade.
      v.y -= k.gravity * STEP_TIME
      if (
        moveTo({ x: p.x + v.x * STEP_TIME, y: p.y + v.y * STEP_TIME, z: p.z + v.z * STEP_TIME })
      ) {
        continue
      }
      const below = groundAt(p.x, p.z)
      if (!below) continue
      if (p.y > below.y) continue

      // Impacto: separa a velocidade em normal e tangencial ao triângulo.
      p.y = below.y
      const n = below.normal
      const vn = dot(v, n)
      if (vn >= 0) continue
      const surface = below.surface
      let tangentScale = 1 - k.impactFriction * (1 - surface.bound)
      if (firstBounce) tangentScale *= 1 - k.spinOnBounce * (input.spin ?? 0)
      firstBounce = false
      const vt = { x: v.x - vn * n[0], y: v.y - vn * n[1], z: v.z - vn * n[2] }
      const out = -vn * surface.bound
      v = {
        x: vt.x * tangentScale + out * n[0],
        y: vt.y * tangentScale + out * n[1],
        z: vt.z * tangentScale + out * n[2],
      }
      events.push({ type: 'bounce', surface: surface.kind, at: { ...p }, step: frames.length / 3 })
      airborne = out > k.minBounceSpeed
      if (!airborne) {
        events.push({ type: 'roll', surface: surface.kind, at: { ...p }, step: frames.length / 3 })
      }
      if (!airborne) {
        // Vira rolagem: mantém só a parte tangencial.
        const vn2 = dot(v, n)
        v = { x: v.x - vn2 * n[0], y: v.y - vn2 * n[1], z: v.z - vn2 * n[2] }
      }
      continue
    }

    // Rolagem sobre o plano do triângulo: gravidade ao longo da ladeira menos atrito.
    const n = ground.normal
    const g = { x: 0, y: -k.gravity, z: 0 }
    const gn = dot(g, n)
    const slope = { x: g.x - gn * n[0], y: g.y - gn * n[1], z: g.z - gn * n[2] }
    const speed = len(v)
    const friction = ground.surface.roll * k.gravity * k.rollFriction
    if (speed < k.stopSpeed && len(slope) <= friction) {
      return finish({ type: 'stop', surface: ground.surface.kind, at: p })
    }
    v = { x: v.x + slope.x * STEP_TIME, y: v.y + slope.y * STEP_TIME, z: v.z + slope.z * STEP_TIME }
    const s = len(v)
    if (s > 0) {
      const reduced = Math.max(0, s - friction * STEP_TIME)
      v = { x: (v.x / s) * reduced, y: (v.y / s) * reduced, z: (v.z / s) * reduced }
    }
    if (moveTo({ x: p.x + v.x * STEP_TIME, y: p.y, z: p.z + v.z * STEP_TIME })) {
      v = { ...v, y: 0 }
      continue
    }
    const next = groundAt(p.x, p.z)
    if (!next) return finish({ type: 'outOfBounds', at: p })
    // Desceu um degrau grande (beirada): volta a voar; senão acompanha o chão.
    if (next.y < p.y - 1.5) airborne = true
    else p.y = next.y
  }
  return finish({ type: 'stop', surface: lastSurface ?? 'default', at: p })
}

// Simulação do voo da bola (lançamento oblíquo com arrasto, efeito Magnus, vento,
// curva, spin e tacadas especiais), em passos fixos de 0,02 s como no jogo.
// Portado de SuperSS-Dev (https://github.com/Acrisio-Filho/SuperSS-Dev),
// "Smart Calculator App/smart_calculator.js" — obtido por engenharia reversa do Pangya.
// Copyright (c) 2021 Acrisio Fragoso Vieira Filho — Licença MIT

import { CLUBS, type ClubId, type ClubPhysics } from './clubs.ts'
import {
  distanceBand,
  launchPower,
  NO_BONUS,
  powerRange,
  spinPower,
  SPIN_DEGREE_FACTOR,
  type DistanceBand,
  type PlayerPower,
  type PowerShot,
} from './power.ts'
import { cupBottom, dropIntoCup } from './cup.ts'
import { unitsToYards } from './units.ts'
import { deflect, pushOut, type Obstacles } from './obstacles.ts'
import type { Vec3 } from './vec3.ts'

export type SpecialShot = 'dunk' | 'tomahawk' | 'spike' | 'cobra'

export interface Wind {
  /** Força, de 0 a 9 (m/s no HUD). */
  speed: number
  /** Direção em graus; 0 = a favor da tacada. */
  degree: number
}

export interface ShotInput {
  club: ClubId
  player: PlayerPower
  /** Posição da barra de força: 1 = 100%. */
  percent: number
  shot?: SpecialShot
  powerShot?: PowerShot
  /** Ponto de contato na bola, de -1 a 1 (positivo = backspin / curva à direita). */
  spin?: number
  curve?: number
  /** Direção da mira em radianos (0 = +Z). */
  aim?: number
  wind?: Wind
  /** % de força do piso (100 = fairway). */
  ground?: number
  /** Distância até o alvo em jardas; define o comportamento de wedges. */
  targetDistance?: number
  /** Normal do terreno onde a bola está (inclinação). */
  lieNormal?: Vec3
  /** Direção da inclinação, em radianos. */
  slopeAim?: number
  /** Posição da linha da bola, 0..1 (no jogo é aleatória). */
  ballLine?: number
}

export interface FlightResult {
  /** Posições a cada passo, em unidades do jogo (x, y, z intercalados). */
  frames: Float32Array
  landing: Vec3
  /** Distância horizontal percorrida no ar, em jardas. */
  carry: number
  /** Desvio lateral, em jardas (positivo = esquerda da mira). */
  lateral: number
  /** Altura máxima, em unidades. */
  apex: number
  /** Alcance do HUD para esta tacada (jardas, a 100%). */
  range: number
}

export const STEP_TIME = 0.02
const GRAVITY = 34.295295715332
const BALL_MASS = 0.045926999
const DRAG = 0.00008
const CURVE_FORCE = 0.75
const SPIN_LIFT = 3
const CURVE_AIM_FACTOR = 0.349065847694874
const SPIKE_HANG_STEPS = 0x3c
const MAX_STEPS = 3000

/** Vetor mutável usado só dentro da simulação. */
class V {
  constructor(
    public x = 0,
    public y = 0,
    public z = 0,
  ) {}
  static from(v: Vec3) {
    return new V(v.x, v.y, v.z)
  }
  clone() {
    return new V(this.x, this.y, this.z)
  }
  add(v: V) {
    this.x += v.x
    this.y += v.y
    this.z += v.z
    return this
  }
  sub(v: V) {
    this.x -= v.x
    this.y -= v.y
    this.z -= v.z
    return this
  }
  scale(s: number) {
    this.x *= s
    this.y *= s
    this.z *= s
    return this
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z)
  }
  /** Como no jogo: vetor nulo continua nulo. */
  normalize() {
    const len = this.length()
    return len === 0 ? this.scale(0) : this.scale(1 / len)
  }
  cross(v: V) {
    const { x, y, z } = this
    this.x = y * v.z - z * v.y
    this.y = z * v.x - x * v.z
    this.z = x * v.y - y * v.x
    return this
  }
}

/** Matriz 3×3 em linhas (r1, r2, r3) + translação t, no formato do cliente. */
interface Mat {
  r1: V
  r2: V
  r3: V
  t: V
}

const rotationY = (angle: number): Mat => {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { r1: new V(c, 0, s), r2: new V(0, 1, 0), r3: new V(-s, 0, c), t: new V() }
}

const mulRow = (r: V, m: Mat) =>
  new V(
    r.x * m.r1.x + r.y * m.r2.x + r.z * m.r3.x,
    r.x * m.r1.y + r.y * m.r2.y + r.z * m.r3.y,
    r.x * m.r1.z + r.y * m.r2.z + r.z * m.r3.z,
  )

const multiply = (a: Mat, b: Mat): Mat => ({
  r1: mulRow(a.r1, b),
  r2: mulRow(a.r2, b),
  r3: mulRow(a.r3, b),
  t: mulRow(a.t, b).add(b.t),
})

/** Curva extra causada pela inclinação do terreno onde a bola está. */
function slopeCurve(lieNormal: V, aim: number, ballLine: number): number {
  const side = lieNormal.clone().cross(new V(0, 0, 1))
  const slope: Mat = {
    r1: side.clone().normalize(),
    r2: lieNormal.clone(),
    r3: side.clone().cross(lieNormal).normalize(),
    t: new V(),
  }
  const m = multiply(multiply(rotationY(ballLine * -2), slope), rotationY(-aim))
  return m.r2.x * 0.5
}

const WOOD_COBRA_POWER: Record<number, number> = { 230: 74, 210: 76, 190: 80 }
const WOOD_SPIKE_DROP: Record<number, [number, number, number, number]> = {
  230: [344, 112, 21.5, -8],
  210: [306, 105, 20.5, -10.3],
  190: [273, 100, 20.2, -10.8],
}

interface BallState {
  position: V
  velocity: V
  rotationCurve: number
  rotationSpin: number
  count: number
  apexStep: number
  apex: number
  spikeInit: number
  spikeMed: number
  cobraInit: number
  percentSqrt: number
}

const cloneState = (s: BallState): BallState => ({
  ...s,
  position: s.position.clone(),
  velocity: s.velocity.clone(),
})

/** Simulador de uma tacada; `step()` avança 0,02 s. */
export class FlightSimulator {
  readonly club: ClubPhysics
  readonly band: DistanceBand
  readonly range: number
  readonly shot: SpecialShot
  private readonly spin: number
  private readonly wind: V
  private readonly origin: V
  private readonly powerFactor: number
  private readonly powerFactorShot: number
  state: BallState

  constructor(input: ShotInput, origin: Vec3 = { x: 0, y: 0, z: 0 }) {
    const club = CLUBS[input.club]
    const ps = input.powerShot ?? 'none'
    const spin = input.spin ?? 0
    const percent = input.percent
    const aim = input.aim ?? 0
    const band = distanceBand(input.targetDistance ?? Infinity)
    const shot = input.shot ?? 'dunk'

    this.club = club
    this.band = band
    this.shot = shot
    this.spin = spin
    this.origin = V.from(origin)
    this.range = powerRange(club, band, input.player, ps)

    const windDeg = ((input.wind?.degree ?? 0) * Math.PI) / 180
    const windSpeed = input.wind?.speed ?? 0
    this.wind = new V(-windSpeed * Math.sin(windDeg), 0, windSpeed * Math.cos(windDeg))

    let power = launchPower(club, band, input.player, ps, spin)
    this.powerFactor = power
    power *= Math.sqrt(percent)
    if (shot === 'tomahawk' || shot === 'spike') power *= 1.3
    power *= Math.sqrt((input.ground ?? 100) * 0.01)
    this.powerFactorShot = power

    let curve = input.curve ?? 0
    const loft = (club.degree * Math.PI) / 180
    const launchAngle = band === 'ge58' ? loft : loft + spin * SPIN_DEGREE_FACTOR
    const yaw = aim - curve * CURVE_AIM_FACTOR

    const lie = input.lieNormal ? V.from(input.lieNormal) : new V(0, 1, 0)
    curve -= slopeCurve(lie, aim - (input.slopeAim ?? 0), input.ballLine ?? 0)
    power *= Math.abs(curve) * 0.1 + 1

    const forward = power * Math.cos(launchAngle)
    const velocity = new V(
      -Math.sin(yaw) * forward,
      power * Math.sin(launchAngle),
      Math.cos(yaw) * forward,
    )

    this.state = {
      position: this.origin.clone(),
      velocity,
      rotationCurve: curve * percent,
      rotationSpin: band === 'ge58' ? spinPower(input.player, ps) * percent * percent : 0,
      count: 0,
      apexStep: -1,
      apex: origin.y,
      spikeInit: -1,
      spikeMed: -1,
      cobraInit: -1,
      percentSqrt: Math.sqrt(percent),
    }
  }

  private force(): V {
    const s = this.state
    const out = new V()

    if (s.rotationCurve !== 0) {
      const side = new V(-s.velocity.z, 0, s.velocity.x).normalize()
      if (s.cobraInit < 0 || s.spikeInit < 0) {
        side.scale(CURVE_FORCE * s.rotationCurve * this.club.rotationCurve)
      }
      out.add(side)
    }

    if (this.shot === 'spike' && s.spikeInit < 0) return new V()
    if (this.shot === 'cobra' && s.cobraInit < 0) return out

    out.add(this.wind.clone().scale(this.shot === 'spike' ? 0.01 : STEP_TIME))
    out.y -= GRAVITY * BALL_MASS
    if (s.rotationSpin !== 0) out.y += this.club.rotationSpin * SPIN_LIFT * s.rotationSpin
    out.sub(s.velocity.clone().scale(s.velocity.length() * DRAG))
    return out
  }

  private integrate(dt: number, moveDt: number) {
    const s = this.state
    if (this.shot === 'spike' && s.apexStep >= 0 && s.apexStep + SPIKE_HANG_STEPS > s.count) {
      return // Spike: a bola "segura" no ponto mais alto
    }
    s.velocity.add(this.force().scale(dt / BALL_MASS))
    s.position.add(s.velocity.clone().scale(moveDt))
  }

  step(moveDt = STEP_TIME): void {
    const s = this.state
    this.integrate(STEP_TIME, moveDt)

    if (this.shot === 'cobra' && s.cobraInit < 0) {
      if (s.percentSqrt < Math.sqrt(0.8)) s.percentSqrt = Math.sqrt(0.8)
      if (s.count === 0) {
        s.velocity.y = 0
        s.velocity.normalize().scale(this.powerFactorShot)
      }
      const travelled = s.position.clone().sub(this.origin).length()
      const riseAt = (this.range * s.percentSqrt - 100) * 3.2
      if (travelled >= riseAt) {
        const mult =
          this.club.category === 'wood' ? (WOOD_COBRA_POWER[this.club.powerBase] ?? 0) : 0
        s.cobraInit = s.count
        s.velocity.normalize().scale(mult * s.percentSqrt)
        s.rotationSpin = 2.5
      }
    } else {
      if (s.spikeInit < 0 && s.cobraInit < 0 && this.band === 'ge58') {
        s.rotationSpin -= (0.5 - this.spin * 0.1) * STEP_TIME
      } else if (
        (this.shot === 'spike' && s.spikeInit >= 0) ||
        (this.shot === 'cobra' && s.cobraInit >= 0)
      ) {
        s.rotationSpin -= STEP_TIME
      }

      if (this.shot === 'spike' && s.count === 0) {
        s.velocity.y = 0
        s.velocity.normalize().scale(72.5 * s.percentSqrt * 2)
        s.rotationSpin = 3.1
        s.spikeInit = s.count
      }

      if (
        this.shot === 'spike' &&
        s.apexStep >= 0 &&
        s.apexStep + SPIKE_HANG_STEPS < s.count &&
        s.spikeMed < 0
      ) {
        s.spikeMed = s.count
        const drop =
          this.club.category === 'wood' ? WOOD_SPIKE_DROP[this.club.powerBase] : undefined
        if (drop) {
          const [cap, div, mul, offset] = drop
          const current = this.powerFactor * s.percentSqrt
          const extra = current < cap ? cap - current : 0
          s.velocity.y = offset - (extra / div) * mul
        }
        s.velocity.scale(s.percentSqrt * 7)
        s.rotationSpin = this.spin
      }
    }

    if (s.position.y > s.apex) s.apex = s.position.y
    if (s.velocity.y < 0 && s.apexStep < 0) s.apexStep = s.count
    s.count++
  }

  /**
   * Simula até a bola descer à altura `landingY` (unidades), interpolando o último
   * passo como o jogo faz.
   */
  flyTo(landingY: number): FlightResult {
    const frames: number[] = []
    const push = () =>
      frames.push(this.state.position.x, this.state.position.y, this.state.position.z)
    push()

    let previous: BallState
    let steps = 0
    do {
      previous = cloneState(this.state)
      this.step()
      push()
    } while (
      (this.state.position.y > landingY || this.state.apexStep === -1) &&
      steps++ < MAX_STEPS
    )

    // Refaz o último passo só até cruzar a altura de pouso.
    const dy = this.state.position.y - previous.position.y
    const fraction = dy === 0 ? 1 : Math.abs((landingY - previous.position.y) / dy)
    this.state = previous
    this.step(STEP_TIME * fraction)
    frames.splice(frames.length - 3, 3)
    push()

    const p = this.state.position
    const dx = p.x - this.origin.x
    const dz = p.z - this.origin.z
    return {
      frames: Float32Array.from(frames),
      landing: { x: p.x, y: p.y, z: p.z },
      carry: unitsToYards(Math.sqrt(dx * dx + dz * dz)),
      lateral: unitsToYards(dx),
      apex: this.state.apex,
      range: this.range,
    }
  }
  /**
   * Simula até a bola descer e tocar o chão dado por `groundAt(x, z)` (altura em
   * unidades; undefined = fora do terreno, segue caindo até `floor`). Com `obstacles`,
   * o voo também termina ao bater num objeto: a bola sai rebatida (`obstacle` = nome da
   * caixa) e a fase no chão continua dali, ainda no ar.
   */
  flyOverGround(
    groundAt: (x: number, z: number) => number | undefined,
    floor = -1000,
    obstacles?: Obstacles,
    cup?: Vec3,
  ): FlightResult & {
    landed: boolean
    velocity: Vec3
    spin: number
    obstacle?: string
    /** A bola passou pela luz da cova baixo o bastante e foi puxada para dentro. */
    holed?: boolean
  } {
    const frames: number[] = []
    const push = () =>
      frames.push(this.state.position.x, this.state.position.y, this.state.position.z)
    push()

    const ground = () => groundAt(this.state.position.x, this.state.position.z) ?? floor
    let previous: BallState
    let steps = 0
    let landed = false
    let obstacle: string | undefined
    do {
      previous = cloneState(this.state)
      this.step()
      const hit = obstacles?.hit(previous.position, this.state.position)
      if (hit) {
        this.state.position = V.from(pushOut(hit))
        this.state.velocity = V.from(deflect(this.state.velocity, hit.normal))
        obstacle = hit.name
        push()
        break
      }
      if (cup && this.state.apexStep !== -1) {
        const at = beamCapture(previous.position, this.state.position, cup)
        if (at) {
          // Puxada pela luz: vai até a cova e cai lá dentro.
          frames.push(...dropIntoCup(at, cup, CUP_BEAM.pullFrames))
          this.state.position = V.from(cupBottom(cup))
          return { ...this.result(frames), landed: true, holed: true }
        }
      }
      push()
      landed = this.state.apexStep !== -1 && this.state.position.y <= ground()
    } while (!landed && this.state.position.y > floor && steps++ < MAX_STEPS)
    if (obstacle) landed = true

    if (landed && !obstacle) {
      // Refaz o último passo só até cruzar o chão (altura do ponto de chegada).
      const target = ground()
      const dy = this.state.position.y - previous.position.y
      const fraction = dy === 0 ? 1 : Math.min(1, Math.abs((target - previous.position.y) / dy))
      this.state = previous
      this.step(STEP_TIME * fraction)
      frames.splice(frames.length - 3, 3)
      push()
    }

    return { ...this.result(frames), landed, ...(obstacle !== undefined && { obstacle }) }
  }

  private result(frames: number[]) {
    const p = this.state.position
    const dx = p.x - this.origin.x
    const dz = p.z - this.origin.z
    return {
      frames: Float32Array.from(frames),
      landing: { x: p.x, y: p.y, z: p.z },
      carry: unitsToYards(Math.sqrt(dx * dx + dz * dz)),
      lateral: unitsToYards(dx),
      apex: this.state.apex,
      range: this.range,
      velocity: { x: this.state.velocity.x, y: this.state.velocity.y, z: this.state.velocity.z },
      spin: this.spin,
    }
  }
}

/**
 * Luz da cova (o feixe que "puxa" a bola no Pangya): se a bola, descendo, passa por cima da
 * cova dentro do raio e abaixo da altura, cai dentro. Não faz milagre: alta demais, passa.
 * Valores a calibrar com o jogo original.
 */
export const CUP_BEAM = {
  /** Raio horizontal da luz (unidades; a cova tem ~0,55). */
  radius: 0.8,
  /** Altura máxima acima da cova em que a luz ainda pega a bola (unidades; 1,75 ≈ 0,5 m). */
  height: 1.75,
  /** Quadros da animação da bola sendo puxada. */
  pullFrames: 8,
}

/** Ponto do trecho a→b (descendo) onde a bola passa pela luz da cova, ou undefined. */
export function beamCapture(a: Vec3, b: Vec3, cup: Vec3): Vec3 | undefined {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const length2 = dx * dx + dz * dz
  // Ponto do trecho mais perto da cova (no plano), com a altura nesse ponto.
  const t =
    length2 === 0
      ? 0
      : Math.max(0, Math.min(1, ((cup.x - a.x) * dx + (cup.z - a.z) * dz) / length2))
  const p = { x: a.x + dx * t, y: a.y + (b.y - a.y) * t, z: a.z + dz * t }
  if (Math.hypot(p.x - cup.x, p.z - cup.z) > CUP_BEAM.radius) return undefined
  const above = p.y - cup.y
  return above <= CUP_BEAM.height && above >= -0.5 ? p : undefined
}

/** Atalho: simula o voo de uma tacada até o chão na altura `landingY` (unidades). */
export function simulateFlight(input: ShotInput, landingY = 0): FlightResult {
  return new FlightSimulator(input).flyTo(landingY)
}

/** Jogador padrão para testes e demonstração. */
export const DEFAULT_PLAYER: PlayerPower = { power: 15, bonus: NO_BONUS }

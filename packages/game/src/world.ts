import type { SurfaceClass } from '@pangya/formats'
import {
  CLUB_IDS,
  CLUBS,
  DEFAULT_PLAYER,
  FlightSimulator,
  Obstacles,
  puttSpeed,
  simulateGround,
  TerrainGrid,
  unitsToYards,
  yardsToUnits,
  type ClubId,
  type GroundAt,
  type GroundResult,
  type PowerShot,
  type ShotInput,
  type SpecialShot,
  type Wind,
} from '@pangya/physics'
import type { HoleState, Point, ShotOutcome } from './hole.ts'
import type { HoleData } from './hole-data.ts'

/** Alcance do putter (PT1) a 100% da barra, em jardas. */
export const PUTT_RANGE = 30

const WATER = new Set(['water', 'waterPass'])

/** O que o jogador escolhe para uma tacada (o resto vem do buraco e do servidor). */
export interface ShotRequest {
  club: ClubId
  /** Barra de força, 0..1. */
  percent: number
  shot?: SpecialShot
  powerShot?: PowerShot
  /** Ponto de contato, -1..1. */
  spin?: number
  curve?: number
  /** Mira em radianos (0 = +Z do Pangya, positivo = esquerda). */
  aim: number
  /**
   * Onde a barra parou em relação à zona de impacto, em meias-larguras da zona
   * (0 = centro, ±1 = borda). Omitido = tacada perfeita (sem barra).
   */
  impact?: number
}

/**
 * Efeito do erro de impacto da barra (estimativa — a calibrar com o original):
 * dentro de PANGYA_ZONE é "Pangya!" (perfeito); fora disso a bola curva para o lado do
 * erro e, fora da zona, perde força.
 */
export const IMPACT_TUNING = {
  pangyaZone: 0.2,
  curvePerZone: 0.35,
  missPowerLoss: 0.1,
}

export const isPangya = (impact: number | undefined) =>
  impact === undefined || Math.abs(impact) <= IMPACT_TUNING.pangyaZone

/** Resultado completo de uma tacada, pronto para animar e aplicar às regras. */
export interface PlayedShot {
  /** Posições a cada 0,02 s (x, y, z intercalados). */
  frames: Float32Array
  /** Distância no ar, em jardas (0 no putt). */
  carry: number
  outcome: ShotOutcome
  /** Quantas vezes bateu em objetos. */
  hits: number
  /** Força do piso aplicada (%). */
  groundPower: number
  /** Erro de impacto da barra (ver ShotRequest.impact). */
  impact?: number
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** Valida e normaliza um pedido de tacada vindo da rede. */
export function sanitizeRequest(request: ShotRequest): ShotRequest {
  if (!(request.club in CLUBS)) throw new Error(`taco inválido: ${String(request.club)}`)
  const shots: SpecialShot[] = ['dunk', 'tomahawk', 'spike', 'cobra']
  const powerShots: PowerShot[] = ['none', 'one', 'two']
  const finite = (v: unknown, fallback = 0) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback
  return {
    club: request.club,
    percent: clamp(finite(request.percent, 1), 0.01, 1),
    shot: shots.includes(request.shot!) ? request.shot! : 'dunk',
    powerShot: powerShots.includes(request.powerShot!) ? request.powerShot! : 'none',
    spin: clamp(finite(request.spin), -1, 1),
    curve: clamp(finite(request.curve), -1, 1),
    aim: finite(request.aim),
    ...(typeof request.impact === 'number' &&
      Number.isFinite(request.impact) && { impact: clamp(request.impact, -4, 4) }),
  }
}

/** Física de um buraco carregado: terreno, objetos, cova e a tacada completa. */
export class HoleWorld {
  readonly grid: TerrainGrid
  readonly obstacles: Obstacles
  readonly cup: Point
  readonly tee: Point
  readonly par: number

  constructor(readonly data: HoleData) {
    this.grid = new TerrainGrid(data.collision.triangles)
    this.obstacles = new Obstacles(data.obstacles)
    const [px, py, pz] = data.pin
    this.cup = { x: px, y: this.grid.groundAt(px, pz)?.y ?? py, z: pz }
    this.tee = this.onGround({ x: data.tee[0], y: data.tee[1], z: data.tee[2] })
    this.par = data.par
  }

  surfaceAt(x: number, z: number): SurfaceClass | undefined {
    const hit = this.grid.groundAt(x, z)
    return hit && this.data.collision.surfaces[hit.triangle]
  }

  /** Terreno visto pela física do chão: altura, normal e piso (bound/roll do property.xml). */
  readonly groundAt: GroundAt = (x, z) => {
    const hit = this.grid.groundAt(x, z)
    if (!hit) return undefined
    return {
      y: hit.y,
      normal: this.grid.normalOf(hit.triangle),
      surface: this.data.collision.surfaces[hit.triangle]!,
    }
  }

  onGround(p: Point): Point {
    return { ...p, y: this.grid.groundAt(p.x, p.z)?.y ?? p.y }
  }

  distanceToPin(p: Point) {
    return unitsToYards(Math.hypot(this.cup.x - p.x, this.cup.z - p.z))
  }

  /** Piso onde a bola está ("tee" na saída). */
  lieKind(state: HoleState) {
    return state.lie === 'tee'
      ? 'tee'
      : (this.surfaceAt(state.ball.x, state.ball.z)?.kind ?? state.lie)
  }

  /** Mira que aponta da bola para o pin. */
  aimAtPin(p: Point) {
    return Math.atan2(-(this.cup.x - p.x), this.cup.z - p.z)
  }

  /** Taco sugerido: o menor alcance (a 100%) que chega à distância; no green, o putter. */
  suggestClub(state: HoleState): { club: ClubId; percent: number } {
    const distance = this.distanceToPin(state.ball)
    if (this.lieKind(state) === 'green') {
      return { club: 'PT1', percent: Math.min(1, distance / PUTT_RANGE) }
    }
    const ranked = CLUB_IDS.filter((c) => CLUBS[c].category !== 'putter')
      .map((club) => ({
        club,
        range: new FlightSimulator({ club, player: DEFAULT_PLAYER, percent: 1 }).range,
      }))
      .sort((a, b) => a.range - b.range)
    return { club: ranked.find((c) => c.range >= distance)?.club ?? '1W', percent: 1 }
  }

  /**
   * Entrada completa da física para o pedido do jogador na posição atual. A força do piso
   * é sorteada entre o mínimo e o máximo do property.xml (verificar no original).
   */
  shotInput(state: HoleState, request: ShotRequest, wind: Wind, random = Math.random): ShotInput {
    const lie = state.lie === 'tee' ? undefined : this.surfaceAt(state.ball.x, state.ball.z)
    const ground = lie ? lie.power.min + random() * (lie.power.max - lie.power.min) : 100
    const hit = this.grid.groundAt(state.ball.x, state.ball.z)
    const normal = hit && state.lie !== 'tee' ? this.grid.normalOf(hit.triangle) : undefined
    // Erro da barra: curva para o lado do erro (no putt, desvia a mira); fora da zona, perde força.
    const impact = isPangya(request.impact) ? 0 : request.impact!
    const miss = Math.min(1, Math.max(0, Math.abs(impact) - 1))
    const putter = CLUBS[request.club].category === 'putter'
    return {
      club: request.club,
      player: DEFAULT_PLAYER,
      percent: request.percent * (1 - IMPACT_TUNING.missPowerLoss * miss),
      shot: request.shot ?? 'dunk',
      powerShot: request.powerShot ?? 'none',
      spin: request.spin ?? 0,
      curve: (request.curve ?? 0) + (putter ? 0 : impact * IMPACT_TUNING.curvePerZone),
      aim: request.aim + (putter ? impact * 0.015 : 0),
      wind,
      targetDistance: this.distanceToPin(state.ball),
      ground,
      ...(normal && { lieNormal: { x: normal[0], y: normal[1], z: normal[2] } }),
    }
  }

  /** Simula a trajetória: voo + chão (ou só rolagem, no putt). */
  private trajectory(origin: Point, input: ShotInput, withGround: boolean) {
    const aim = input.aim ?? 0
    if (CLUBS[input.club].category === 'putter') {
      const roll = this.surfaceAt(origin.x, origin.z)?.roll ?? 0.18
      const speed = puttSpeed(input.percent * PUTT_RANGE, roll)
      const ground = simulateGround(
        {
          position: origin,
          velocity: { x: -Math.sin(aim) * speed, y: 0, z: Math.cos(aim) * speed },
          rolling: true,
          cup: this.cup,
        },
        this.groundAt,
        this.obstacles,
      )
      return { frames: ground.frames, carry: 0, ground, hitObject: false }
    }
    const flight = new FlightSimulator(input, origin).flyOverGround(
      (x, z) => this.grid.groundAt(x, z)?.y,
      -1000,
      this.obstacles,
    )
    const hitObject = flight.obstacle !== undefined
    if (!withGround || !flight.landed) {
      return { frames: flight.frames, carry: flight.carry, ground: undefined, hitObject }
    }
    const ground: GroundResult = simulateGround(
      { position: flight.landing, velocity: flight.velocity, spin: flight.spin, cup: this.cup },
      this.groundAt,
      this.obstacles,
    )
    const frames = new Float32Array(flight.frames.length + ground.frames.length)
    frames.set(flight.frames)
    frames.set(ground.frames, flight.frames.length)
    return { frames, carry: flight.carry, ground, hitObject }
  }

  /** Ponto onde a tacada cai (sem vento, piso 100%), como o anel de mira do jogo. */
  predictLanding(state: HoleState, request: ShotRequest): Point {
    const input = { ...this.shotInput(state, request, { speed: 0, degree: 0 }), ground: 100 }
    let x: number
    let z: number
    if (CLUBS[input.club].category === 'putter') {
      const d = yardsToUnits(input.percent * PUTT_RANGE)
      x = state.ball.x - Math.sin(request.aim) * d
      z = state.ball.z + Math.cos(request.aim) * d
    } else {
      const { frames } = this.trajectory(state.ball, input, false)
      x = frames[frames.length - 3]!
      z = frames[frames.length - 1]!
    }
    return { x, y: this.grid.groundAt(x, z)?.y ?? state.ball.y, z }
  }

  /** Onde recolocar a bola que caiu na água: último ponto da trajetória sobre chão seco. */
  private waterDrop(frames: Float32Array, fallback: Point): Point {
    for (let i = frames.length / 3 - 1; i >= 0; i--) {
      const x = frames[i * 3]!
      const z = frames[i * 3 + 2]!
      const surface = this.surfaceAt(x, z)
      if (surface && !WATER.has(surface.kind)) return this.onGround({ x, y: 0, z })
    }
    return fallback
  }

  /** Joga a tacada inteira e classifica o resultado para as regras (`applyShot`). */
  play(state: HoleState, request: ShotRequest, wind: Wind, random = Math.random): PlayedShot {
    const input = this.shotInput(state, request, wind, random)
    const result = this.trajectory(state.ball, input, true)
    if (result.frames.some((v) => !Number.isFinite(v))) {
      throw new Error(`tacada gerou posição inválida (NaN): ${JSON.stringify(input)}`)
    }
    const n = result.frames.length
    const end = result.ground?.final ?? {
      x: result.frames[n - 3]!,
      y: result.frames[n - 2]!,
      z: result.frames[n - 1]!,
    }
    const how = result.ground?.outcome ?? 'outOfBounds'
    let outcome: ShotOutcome
    if (how === 'hole') outcome = { type: 'hole', at: this.cup }
    else if (how === 'water') {
      const dropAt = this.waterDrop(result.frames, state.ball)
      outcome = {
        type: 'water',
        at: end,
        dropAt,
        dropSurface: this.surfaceAt(dropAt.x, dropAt.z)?.kind ?? 'rough',
      }
    } else if (how === 'outOfBounds') outcome = { type: 'outOfBounds', at: end }
    else outcome = { type: 'stop', at: end, surface: result.ground?.surface ?? 'default' }

    const hits =
      (result.hitObject ? 1 : 0) +
      (result.ground?.events.filter((e) => e.type === 'obstacle').length ?? 0)
    return {
      frames: result.frames,
      carry: result.carry,
      outcome,
      hits,
      groundPower: input.ground ?? 100,
      ...(request.impact !== undefined && { impact: request.impact }),
    }
  }
}

/** Texto curto do resultado da tacada ("voo 200y + rolagem 30y · 💧 Água!"). */
export function describeShot(from: Point, shot: PlayedShot): string {
  const at = shot.outcome.at
  const total = unitsToYards(Math.hypot(at.x - from.x, at.z - from.z))
  const travel =
    shot.carry > 0
      ? `voo ${shot.carry.toFixed(1)}y + rolagem ${Math.max(0, total - shot.carry).toFixed(1)}y`
      : `${total.toFixed(1)}y`
  const endings: Record<ShotOutcome['type'], string> = {
    hole: '⛳ NA COVA!',
    water: '💧 Água! +1 de penalidade',
    outOfBounds: '🚫 O.B.! +1 de penalidade, volta para onde bateu',
    stop: '',
  }
  const pangya = shot.impact === undefined ? '' : isPangya(shot.impact) ? '✨ PANGYA! · ' : ''
  const missed = shot.impact !== undefined && Math.abs(shot.impact) > 1 ? ' · errou a zona' : ''
  return (
    pangya +
    travel +
    missed +
    (shot.hits ? ' · 🌳 bateu em objeto' : '') +
    (endings[shot.outcome.type] ? ' · ' + endings[shot.outcome.type] : '')
  )
}

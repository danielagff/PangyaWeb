/**
 * Calculadora (ferramenta de desenvolvimento: tecla G no modo sozinho): a mira e a força
 * para a bola cair direto na cova ("de dunk"), com a física de verdade do jogo — vento,
 * desnível e terreno. A tacada é a normal (bola acertada no centro, sem spin nem curva) com
 * impacto perfeito (PANGYA).
 *
 * Acha (mira, força) pelo método de Newton com derivadas numéricas sobre o primeiro toque
 * da bola no chão, e confere jogando a tacada inteira (com a luz da cova e a rolagem).
 * Usa o taco escolhido; se ele não alcança, o primeiro taco mais longo que alcança.
 */
import {
  BAR_CARRY_SHARE,
  CLUB_IDS,
  CLUBS,
  unitsToYards,
  type ClubId,
  type PowerShot,
  type Wind,
} from '@pangya/physics'
import type { HoleState } from './hole.ts'
import type { HoleWorld, ShotRequest } from './world.ts'

export interface ShotSolution {
  club: ClubId
  powerShot: PowerShot
  /** Mira (radianos, como em ShotRequest). */
  aim: number
  /** Força da barra, 0..1. */
  percent: number
  /** Distância (jardas) do primeiro toque no chão calculado até o pin. */
  miss: number
  /** A tacada jogada de verdade (impacto perfeito) entrou na cova. */
  holed: boolean
}

export interface SolveFailure {
  /**
   * putter: no green (por enquanto só tacadas no ar); outOfReach: nenhum taco alcança;
   * obstacle: a bola bate em algo no caminho (árvore, casa…); noSolution: não convergiu.
   */
  reason: 'putter' | 'outOfReach' | 'obstacle' | 'noSolution'
  club: ClubId
  /** Quanto falta (jardas) com o taco mais longo, quando não alcança. */
  shortBy?: number
  /** Distância (jardas) da bola até onde ela bate no obstáculo. */
  obstacleAt?: number
}

export interface SolveInput {
  club: ClubId
  powerShot: PowerShot
  /** Força do personagem. */
  power: number
}

/** Erro aceito no ponto de queda (unidades; a luz da cova pega até 0,8). */
const TOLERANCE = 0.01

/** Tacos para tentar: o escolhido e, se não alcançar, os mais longos (do menor alcance). */
function clubsToTry(world: HoleWorld, state: HoleState, input: SolveInput): ClubId[] {
  const range = (club: ClubId) =>
    world.shotRange(state, {
      club,
      aim: 0,
      percent: 1,
      powerShot: input.powerShot,
      power: input.power,
    })
  const longer = CLUB_IDS.filter(
    (c) => CLUBS[c].category !== 'putter' && c !== input.club && range(c) > range(input.club),
  ).sort((a, b) => range(a) - range(b))
  return [input.club, ...longer]
}

function solveClub(
  world: HoleWorld,
  state: HoleState,
  wind: Wind,
  club: ClubId,
  input: SolveInput,
): ShotSolution | SolveFailure {
  const cup = world.cup
  const request = (aim: number, percent: number): ShotRequest => ({
    club,
    aim,
    percent,
    powerShot: input.powerShot,
    power: input.power,
    spin: 0,
    curve: 0,
    impact: 0,
  })
  /** Onde a bola bateu num obstáculo (o último visto durante a busca). */
  let obstacleAt: number | undefined
  const residual = (aim: number, percent: number): [number, number] => {
    const landing = world.flightLanding(state, request(aim, percent), wind)
    const { at } = landing
    if (landing.obstacle) {
      obstacleAt = unitsToYards(Math.hypot(at.x - state.ball.x, at.z - state.ball.z))
    }
    return [at.x - cup.x, at.z - cup.z]
  }
  const range = world.shotRange(state, request(0, 1))
  let aim = world.aimAtPin(state.ball)
  // Começa pela conta do plano: a barra voa BAR_CARRY_SHARE do número dela.
  const carry = range * BAR_CARRY_SHARE
  let percent = Math.min(1, Math.max(0.02, world.distanceToPin(state.ball) / carry))
  let r = residual(aim, percent)
  for (let i = 0; i < 30 && Math.hypot(r[0], r[1]) > TOLERANCE; i++) {
    const da = 2e-4
    const dp = percent > 0.5 ? -1e-3 : 1e-3
    const ra = residual(aim + da, percent)
    const rp = residual(aim, percent + dp)
    const j00 = (ra[0] - r[0]) / da
    const j10 = (ra[1] - r[1]) / da
    const j01 = (rp[0] - r[0]) / dp
    const j11 = (rp[1] - r[1]) / dp
    const det = j00 * j11 - j01 * j10
    if (!Number.isFinite(det) || Math.abs(det) < 1e-9) break
    let stepAim = (-r[0] * j11 + j01 * r[1]) / det
    let stepPercent = (-j00 * r[1] + j10 * r[0]) / det
    // Passos limitados (obstáculos e quinas do terreno deixam a conta irregular).
    stepAim = Math.max(-0.2, Math.min(0.2, stepAim))
    stepPercent = Math.max(-0.3, Math.min(0.3, stepPercent))
    aim += stepAim
    percent = Math.max(0.005, Math.min(1.5, percent + stepPercent))
    r = residual(aim, percent)
  }
  const miss = unitsToYards(Math.hypot(r[0], r[1]))
  if (percent > 1 + 1e-6) return { reason: 'outOfReach', club, shortBy: (percent - 1) * range }
  if (miss > unitsToYards(0.3)) {
    return obstacleAt === undefined
      ? { reason: 'noSolution', club }
      : { reason: 'obstacle', club, obstacleAt }
  }
  // Confere jogando a tacada inteira (luz da cova, quique e rolagem).
  const played = world.play(state, request(aim, percent), wind, () => 0.5)
  return {
    club,
    powerShot: input.powerShot,
    aim,
    percent,
    miss,
    holed: played.outcome.type === 'hole',
  }
}

export function solveShot(
  world: HoleWorld,
  state: HoleState,
  wind: Wind,
  input: SolveInput,
): ShotSolution | SolveFailure {
  if (CLUBS[input.club].category === 'putter') return { reason: 'putter', club: input.club }
  let last: SolveFailure | undefined
  for (const club of clubsToTry(world, state, input)) {
    const result = solveClub(world, state, wind, club, input)
    if (!('reason' in result)) return result
    last = result
    if (result.reason !== 'outOfReach') break
  }
  return last!
}

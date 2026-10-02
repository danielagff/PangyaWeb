/**
 * Partida multiplayer em Stroke Play (spec 17): vários jogadores no mesmo buraco, um de
 * cada vez. Estado puro e serializável — o servidor guarda e transmite; o cliente só exibe.
 *
 * Ordem das tacadas (regra do golfe; confirmar no modo Versus do original):
 * - no tee: quem fez menos tacadas no buraco anterior começa (honra); no 1º, ordem de entrada;
 * - depois: joga quem está mais longe do pin.
 */

import type { Wind } from '@pangya/physics'
import { applyShot, startHole, type HoleState, type Point, type ShotOutcome } from './hole.ts'

export interface Course {
  round: string
  prefix: string
  /** Números dos buracos a jogar, em ordem. */
  holes: number[]
}

export interface MatchPlayer {
  id: string
  name: string
  color: number
  connected: boolean
  /** Tacadas e par de cada buraco já terminado. */
  card: { hole: number; strokes: number; par: number }[]
  /** Estado no buraco atual (undefined no lobby). */
  state: HoleState | undefined
}

export interface MatchState {
  phase: 'lobby' | 'playing' | 'holeEnd' | 'finished'
  course: Course | undefined
  /** Índice em `course.holes`. */
  holeIndex: number
  wind: Wind
  players: MatchPlayer[]
  /** Quem joga agora (só em 'playing'). */
  turn: string | undefined
  /** Primeiro jogador conectado: escolhe o curso e começa a partida. */
  host: string | undefined
}

const COLORS = [0xffffff, 0xffeb3b, 0xff7043, 0x42a5f5, 0xab47bc, 0x66bb6a, 0xec407a, 0x26c6da]

export function createMatch(): MatchState {
  return {
    phase: 'lobby',
    course: undefined,
    holeIndex: 0,
    wind: { speed: 0, degree: 0 },
    players: [],
    turn: undefined,
    host: undefined,
  }
}

const hostOf = (players: MatchPlayer[]) => players.find((p) => p.connected)?.id

/** Entra na sala; um jogador desconectado com o mesmo nome é retomado (mantém o placar). */
export function joinMatch(match: MatchState, id: string, name: string): MatchState {
  const back = match.players.find((p) => !p.connected && p.name === name)
  const players = back
    ? match.players.map((p) => (p === back ? { ...p, id, connected: true } : p))
    : [
        ...match.players,
        {
          id,
          name,
          color: COLORS[match.players.length % COLORS.length]!,
          connected: true,
          card: [],
          state: undefined,
        },
      ]
  const turn = back && match.turn === back.id ? id : match.turn
  return { ...match, players, turn, host: hostOf(players) }
}

/** Saiu (conexão caiu): fica na lista como desconectado e perde a vez. */
export function leaveMatch(match: MatchState, id: string): MatchState {
  const players =
    match.phase === 'lobby'
      ? match.players.filter((p) => p.id !== id)
      : match.players.map((p) => (p.id === id ? { ...p, connected: false } : p))
  const next = { ...match, players, host: hostOf(players) }
  return match.turn === id ? { ...next, turn: nextTurn(next) } : next
}

export interface HoleSetup {
  par: number
  tee: Point
  wind: Wind
}

/** Começa a partida (ou o próximo buraco) com todos no tee. */
export function startMatchHole(match: MatchState, course: Course, setup: HoleSetup): MatchState {
  const players = match.players.map((p) => ({ ...p, state: startHole(setup.par, setup.tee) }))
  const next: MatchState = { ...match, course, phase: 'playing', players, wind: setup.wind }
  return { ...next, turn: nextTurn(next) }
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)

/** Próximo a jogar: honra no tee, depois o mais longe do pin. */
export function nextTurn(match: MatchState, pin?: Point): string | undefined {
  const active = match.players.filter((p) => p.connected && p.state && !p.state.finished)
  if (active.length === 0) return undefined
  const onTee = active.filter((p) => p.state!.strokes === 0)
  if (onTee.length > 0) {
    const last = (p: MatchPlayer) => p.card.at(-1)?.strokes ?? 0
    return [...onTee].sort((a, b) => last(a) - last(b))[0]!.id
  }
  if (!pin) return active[0]!.id
  return [...active].sort((a, b) => distance(b.state!.ball, pin) - distance(a.state!.ball, pin))[0]!
    .id
}

/** Aplica a tacada de quem está na vez e passa a vez. */
export function applyMatchShot(
  match: MatchState,
  playerId: string,
  outcome: ShotOutcome,
  pin: Point,
): MatchState {
  if (match.phase !== 'playing') throw new Error('a partida não está em andamento')
  if (match.turn !== playerId) throw new Error('não é a sua vez')
  const players = match.players.map((p) =>
    p.id === playerId ? { ...p, state: applyShot(p.state!, outcome) } : p,
  )
  const next = { ...match, players }
  const turn = nextTurn(next, pin)
  if (turn) return { ...next, turn }
  // Todos terminaram: fecha o buraco no cartão.
  const hole = match.course!.holes[match.holeIndex]!
  const closed = players.map((p) =>
    p.state ? { ...p, card: [...p.card, { hole, strokes: p.state.strokes, par: p.state.par }] } : p,
  )
  const last = match.holeIndex >= match.course!.holes.length - 1
  return { ...next, players: closed, turn: undefined, phase: last ? 'finished' : 'holeEnd' }
}

/** Avança para o próximo buraco (depois de 'holeEnd'). */
export function advanceHole(match: MatchState, setup: HoleSetup): MatchState {
  return startMatchHole({ ...match, holeIndex: match.holeIndex + 1 }, match.course!, setup)
}

/** Total de tacadas e diferença para o par. */
export function totals(player: MatchPlayer) {
  const strokes = player.card.reduce((n, c) => n + c.strokes, 0)
  const par = player.card.reduce((n, c) => n + c.par, 0)
  return { strokes, par, diff: strokes - par }
}

/** Vento sorteado por buraco: 0–9 m, qualquer direção. */
export const randomWind = (random = Math.random): Wind => ({
  speed: Math.floor(random() * 10),
  degree: Math.floor(random() * 360),
})

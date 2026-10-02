/**
 * Estado de um buraco em Stroke Play, single-player (spec 14). Puro e serializável:
 * o cliente simula a tacada e entrega só o resultado; o servidor poderá reaproveitar.
 *
 * Regras de penalidade a confirmar contra o original (verificar):
 * - água: +1 tacada, bola recolocada no último ponto seco antes da água;
 * - fora do mapa (O.B.): +1 tacada, bola volta para onde a tacada saiu;
 * - limite de tacadas: 3× o par (depois disso o buraco termina como desistência).
 */

export interface Point {
  x: number
  y: number
  z: number
}

export type ShotOutcome =
  | { type: 'stop'; at: Point; surface: string }
  | { type: 'hole'; at: Point }
  /** `dropAt`/`dropSurface`: onde a bola é recolocada (calculado por quem simulou). */
  | { type: 'water'; at: Point; dropAt: Point; dropSurface: string }
  | { type: 'outOfBounds'; at: Point }

export interface HoleState {
  par: number
  maxStrokes: number
  /** Tacadas já contadas, incluindo penalidades. */
  strokes: number
  penalties: number
  ball: Point
  /** Piso onde a bola está (tipo de superfície do property.xml; "tee" na saída). */
  lie: string
  finished: boolean
  /** Como o buraco terminou. */
  result?: 'holed' | 'gaveUp'
  /** Piso de onde saiu a tacada que entrou (chip-in = fora do green). */
  holedFrom?: string
  /** Histórico de tacadas: origem, piso de origem e resultado. */
  shots: { from: Point; lie: string; outcome: ShotOutcome }[]
}

export function startHole(par: number, tee: Point, maxStrokes = par * 3): HoleState {
  return {
    par,
    maxStrokes,
    strokes: 0,
    penalties: 0,
    ball: { ...tee },
    lie: 'tee',
    finished: false,
    shots: [],
  }
}

export function applyShot(state: HoleState, outcome: ShotOutcome): HoleState {
  if (state.finished) throw new Error('o buraco já terminou')
  const next: HoleState = {
    ...state,
    strokes: state.strokes + 1,
    shots: [...state.shots, { from: state.ball, lie: state.lie, outcome }],
  }
  switch (outcome.type) {
    case 'hole':
      return { ...next, ball: outcome.at, finished: true, result: 'holed', holedFrom: state.lie }
    case 'stop':
      next.ball = outcome.at
      next.lie = outcome.surface
      break
    case 'water':
      next.strokes++
      next.penalties++
      next.ball = outcome.dropAt
      next.lie = outcome.dropSurface
      break
    case 'outOfBounds':
      next.strokes++
      next.penalties++
      break
  }
  if (next.strokes >= next.maxStrokes) return { ...next, finished: true, result: 'gaveUp' }
  return next
}

/** Nome do resultado (como no placar do jogo). */
export function scoreName(strokes: number, par: number): string {
  if (strokes === 1) return 'Hole in One'
  const diff = strokes - par
  const names: Record<number, string> = {
    [-4]: 'Condor',
    [-3]: 'Albatross',
    [-2]: 'Eagle',
    [-1]: 'Birdie',
    0: 'Par',
    1: 'Bogey',
    2: 'Double Bogey',
    3: 'Triple Bogey',
  }
  return names[diff] ?? (diff > 0 ? `+${diff}` : `${diff}`)
}

/** Texto do placar relativo ao par: "-1", "E", "+2". */
export function scoreToPar(strokes: number, par: number): string {
  const diff = strokes - par
  return diff === 0 ? 'E' : diff > 0 ? `+${diff}` : String(diff)
}

/** Chip-in: entrou na cova numa tacada que não saiu do green. */
export const isChipIn = (state: HoleState) =>
  state.result === 'holed' && state.holedFrom !== 'green' && state.strokes > 1

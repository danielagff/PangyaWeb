/**
 * Melhor resultado de cada curso + plano de buracos (guardado neste navegador), para o
 * "Novo recorde!" no fim da rodada sozinho e o recorde na escolha do curso.
 */
import { formatHoles } from './courses.ts'

export interface RoundRecord {
  strokes: number
  par: number
  /** Data (AAAA-MM-DD) em que foi feito. */
  date: string
}

const recordKey = (round: string, holes: number[]) =>
  `pangyaweb.recorde.${round}.${formatHoles(holes)}`

/** Menos tacadas no mesmo plano é melhor (mesmo plano = mesmo par). */
export const isBetter = (result: RoundRecord, previous: RoundRecord | undefined) =>
  !previous || result.strokes < previous.strokes

export function readRecord(round: string, holes: number[]): RoundRecord | undefined {
  try {
    const raw = localStorage.getItem(recordKey(round, holes))
    if (!raw) return undefined
    const value = JSON.parse(raw) as Partial<RoundRecord>
    return typeof value.strokes === 'number' && typeof value.par === 'number'
      ? { strokes: value.strokes, par: value.par, date: String(value.date ?? '') }
      : undefined
  } catch {
    return undefined
  }
}

/** Grava se for melhor; devolve o recorde anterior e se este é o novo. */
export function saveRecord(round: string, holes: number[], result: RoundRecord) {
  const previous = readRecord(round, holes)
  const isNew = isBetter(result, previous)
  if (isNew) {
    try {
      localStorage.setItem(recordKey(round, holes), JSON.stringify(result))
    } catch {
      // sem armazenamento: só não lembra
    }
  }
  return { previous, isNew }
}

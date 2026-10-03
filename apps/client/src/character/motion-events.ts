/**
 * Eventos dos quadros das animações (bloco FRAM do .apet), por movimento: sons
 * (`*snd("f-점프")`), passos (`*stepsnd()`), efeitos (`*fx(...)`), taco escondido/mostrado
 * (`*hideclub` / `*showclub`) e o quadro em que o taco acerta a bola (`*shot`).
 */
import { parseFrameCommands, type FrameCommand, type PetFrameEvent } from '@pangya/formats'

export interface MotionEvent {
  /** Segundos desde o começo do movimento. */
  time: number
  commands: FrameCommand[]
}

interface MotionRange {
  name: string
  frameStart: number
  frameEnd: number
}

const FPS = 30

/** Eventos de cada movimento (os movimentos podem dividir quadros: cada um recebe os seus). */
export function motionEvents(
  motions: MotionRange[],
  events: PetFrameEvent[],
): Map<string, MotionEvent[]> {
  const parsed = events
    .map((e) => ({ frame: e.frame, commands: parseFrameCommands(e.text) }))
    .filter((e) => e.commands.length > 0)
    .sort((a, b) => a.frame - b.frame)
  const out = new Map<string, MotionEvent[]>()
  for (const m of motions) {
    const list = parsed
      .filter((e) => e.frame >= m.frameStart && e.frame <= m.frameEnd)
      .map((e) => ({ time: (e.frame - m.frameStart) / FPS, commands: e.commands }))
    if (list.length) out.set(m.name, list)
  }
  return out
}

/** Eventos com tempo em (from, to]; `from` < 0 inclui o quadro 0. */
export function eventsBetween(list: MotionEvent[] | undefined, from: number, to: number) {
  return (list ?? []).filter((e) => e.time > from && e.time <= to)
}

/** Quadro (relativo) do `*shot` do movimento: onde o taco acerta a bola. */
export function shotFrame(list: MotionEvent[] | undefined): number | undefined {
  const e = list?.find((x) => x.commands.some((c) => c.name === 'shot'))
  return e && Math.round(e.time * FPS)
}

/**
 * Próximo movimento quando o jogo encadeia dois em ciclo (ex.: 우드샷준비 → 우드샷디폴트 →
 * 우드샷준비: a espera com a variação no meio). Sem ciclo de dois, nada (laço simples).
 */
export function chainNext(motions: { name: string; next?: string }[], name: string) {
  const byName = new Map(motions.map((m) => [m.name, m]))
  const next = byName.get(name)?.next
  if (!next || next === name || !byName.has(next)) return undefined
  return byName.get(next)?.next === name ? next : undefined
}

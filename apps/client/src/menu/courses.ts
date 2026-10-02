/**
 * Cursos no menu: nome para mostrar, plano de buracos (quais e em que ordem) e o formato
 * desse plano na URL do modo sozinho (`buracos=10-18,1-9`).
 */
import type { Course } from '@pangya/game'

/**
 * Nome do curso pelo prefixo dos arquivos do buraco (o nome da pasta do .pak nem sempre é
 * o do jogo: o Pink Wind fica em "round10_spring wind"). Conferidos com os arquivos.
 */
const COURSE_NAMES: Record<string, string> = {
  blue: 'Blue Lagoon',
  pink: 'Pink Wind',
}

/** "round10_spring wind" → "Spring Wind" (quando o prefixo não está na tabela). */
function nameFromFolder(round: string) {
  const words = round
    .replace(/^round\d*_?/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
  if (!words) return round
  return words.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
}

export function courseName(course: Pick<Course, 'round' | 'prefix'>): string {
  return COURSE_NAMES[course.prefix.toLowerCase()] ?? nameFromFolder(course.round)
}

/** Quantidades de buracos oferecidas (como no jogo: 18, ida/volta de 9, rodadas curtas). */
export const HOLE_COUNTS = [1, 3, 9, 18] as const

/**
 * Buracos a jogar: `count` buracos a partir de `first`, na ordem do curso, voltando ao
 * começo se passar do último (começar no 10 com 18 buracos = 10…18 e 1…9).
 */
export function planHoles(courseHoles: number[], first: number, count: number): number[] {
  if (courseHoles.length === 0) return []
  const start = Math.max(0, courseHoles.indexOf(first))
  const ordered = [...courseHoles.slice(start), ...courseHoles.slice(0, start)]
  return ordered.slice(0, Math.max(1, Math.min(count, ordered.length)))
}

/** [10,11,…,18,1,2,3] → "10-18,1-3". */
export function formatHoles(holes: number[]): string {
  const runs: [number, number][] = []
  for (const hole of holes) {
    const last = runs.at(-1)
    if (last && hole === last[1] + 1) last[1] = hole
    else runs.push([hole, hole])
  }
  return runs.map(([a, b]) => (a === b ? String(a) : `${a}-${b}`)).join(',')
}

/** "10-18,1-3" → [10,…,18,1,2,3]; texto inválido → []. */
export function parseHoles(text: string | null | undefined): number[] {
  if (!text) return []
  const holes: number[] = []
  for (const item of text.split(',')) {
    const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(item)
    if (!m) return []
    const a = Number(m[1])
    const b = Number(m[2] ?? m[1])
    if (a < 1 || b < a || b - a > 36) return []
    for (let h = a; h <= b; h++) holes.push(h)
  }
  return holes
}

/** Descrição curta do plano: "18 buracos", "Buracos 10–18", "Buraco 7". */
export function describePlan(holes: number[]): string {
  if (holes.length === 0) return ''
  if (holes.length === 1) return `Buraco ${holes[0]}`
  if (holes.length === 18) return '18 buracos'
  const text = formatHoles(holes).replace(/-/g, '–').replace(/,/g, ', ')
  return `Buracos ${text}`
}

/** URL do modo sozinho para um plano (`cartao` vazio = começo da rodada). */
export function soloUrl(course: Pick<Course, 'round' | 'prefix'>, holes: number[]): string {
  const params = new URLSearchParams({
    curso: course.round,
    prefixo: course.prefix,
    buraco: String(holes[0] ?? 1),
    buracos: formatHoles(holes),
  })
  return `?${params}`
}

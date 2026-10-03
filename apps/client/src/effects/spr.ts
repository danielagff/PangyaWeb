/**
 * Efeitos do jogo em texto (o formato vem comentado em coreano nos próprios arquivos):
 * - `.seq` (sequência): em que instante (ms) solta qual "spray", de onde e com que
 *   velocidade (`0000: Spray = arquivo.spr, (x,y,z), (vx,vy,vz)[, strongbond]`), e quando
 *   termina (`5000: stop`).
 * - `.spr` (spray): um sistema de partículas — textura (ou modelo .pet), mistura, cor e
 *   tamanho pela idade, quantas nascem e quando, velocidade, gravidade, atrito, chão, giro,
 *   quadros de animação, rastro, tremida de câmera e clarão.
 * Unidades: tempos em ms (ou quadros com "f", a 30 por segundo), ângulos em radianos (ou
 * graus com "d"), porcentagens com "%"; velocidades e gravidade por quadro.
 */

export const SPR_FPS = 30

export type Vec3 = [number, number, number]
/** Cor ARGB, cada canal 0..1. */
export type Argb = [number, number, number, number]
export type Blend = 'normal' | 'add' | 'multiply' | 'invmultiply'

/** Trecho de uma curva pela idade (0..1) ou pelo tempo (ms): de `from` a `to`. */
export interface Segment<T> {
  from: number
  to: number
  a: T
  b: T
}

export interface SprDef {
  /** Textura (com o tamanho de cada quadro em pixels) ou modelo .pet. */
  texture?: { file: string; cellWidth: number; cellHeight: number; billboard: boolean }
  pet?: string
  blend: Blend
  tailBlend: Blend
  fade: Segment<Argb>[]
  size: [number, number]
  sizeCurve: Segment<number>[]
  genPos:
    | { sphere: false; min: Vec3; max: Vec3 }
    | { sphere: true; center: Vec3; near: number; far: number; cone: number }
  generation: { start: number; end: number; count: number; cone: number }[]
  /** Vida em ms (0 = infinita). */
  life: [number, number]
  velocity: [Vec3, Vec3]
  /** Velocidade (fração da inicial) pelo tempo de vida (ms). */
  velocityCurve: Segment<number>[]
  angle: [Vec3, Vec3]
  /** Giro (rad por quadro) e o fator pela idade. */
  rotation: [Vec3, Vec3]
  rotationCurve: Segment<number>[]
  gravity: Vec3
  friction: number
  groundFriction: number
  /** Chão relativo ao ponto de origem e quanto quica (0..1). */
  ground?: { y: number; bounce: number }
  gravityPoint?: { center: Vec3; strength: number; range: number; outside: number }
  frame: [number, number]
  frames?: { from: number; to: number; first: number; last: number; interval: number }
  tail?: { length: number; interval: number; end: Argb; file: string; width: number }
  quake?: { start: number; end: number; from: Vec3; to: Vec3; interval: number }
  flash?: { start: number; peak: number; end: number }
}

export interface SeqEvent {
  time: number
  file: string
  position: Vec3
  velocity: Vec3
  attached: boolean
}

export interface SeqDef {
  events: SeqEvent[]
  /** Fim da sequência (ms). */
  stop: number
}

type Token = number | string

/** "(0, 2d, 50f), ~arq.jpg" → [0, 0.0349, 1666.7, '~arq.jpg'] com as unidades convertidas. */
export function tokens(value: string): Token[] {
  return value
    .split(/[(),]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => {
      const m = /^(-?\d*\.?\d+(?:e-?\d+)?)\s*(ms|frm|f|d|r|%)?$/i.exec(t)
      if (!m) return t
      const n = Number(m[1])
      switch (m[2]?.toLowerCase()) {
        case 'f':
        case 'frm':
          return (n * 1000) / SPR_FPS
        case 'd':
          return (n * Math.PI) / 180
        case '%':
          return n / 100
        default:
          return n
      }
    })
}

const nums = (list: Token[]) => list.filter((t): t is number => typeof t === 'number')
const words = (list: Token[]) => list.filter((t): t is string => typeof t === 'string')
const v3 = (n: number[], i: number): Vec3 => [n[i] ?? 0, n[i + 1] ?? 0, n[i + 2] ?? 0]
const argb = (n: number[], i: number): Argb => [
  (n[i] ?? 255) / 255,
  (n[i + 1] ?? 255) / 255,
  (n[i + 2] ?? 255) / 255,
  (n[i + 3] ?? 255) / 255,
]
const blendOf = (word: string | undefined): Blend => {
  const w = (word ?? '').toLowerCase()
  return w === 'add' || w === 'multiply' || w === 'invmultiply' ? w : 'normal'
}

/** Linhas "Chave = valor" sem os comentários (";" até o fim da linha). */
function entries(text: string): [string, string][] {
  const out: [string, string][] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/;.*$/, '').trim()
    const m = /^([A-Za-z_]+)\s*=\s*(.*)$/.exec(line)
    if (m) out.push([m[1]!.toLowerCase(), m[2]!])
  }
  return out
}

export function parseSpr(text: string): SprDef {
  const def: SprDef = {
    blend: 'normal',
    tailBlend: 'normal',
    fade: [],
    size: [1, 1],
    sizeCurve: [],
    genPos: { sphere: false, min: [0, 0, 0], max: [0, 0, 0] },
    generation: [],
    life: [1000, 1000],
    velocity: [
      [0, 0, 0],
      [0, 0, 0],
    ],
    velocityCurve: [],
    angle: [
      [0, 0, 0],
      [0, 0, 0],
    ],
    rotation: [
      [0, 0, 0],
      [0, 0, 0],
    ],
    rotationCurve: [],
    gravity: [0, 0, 0],
    friction: 0,
    groundFriction: 0,
    frame: [0, 0],
  }
  let sphere = false
  let genPos: number[] = []
  for (const [key, value] of entries(text)) {
    const t = tokens(value)
    const n = nums(t)
    switch (key) {
      case 'source': {
        const file = words(t)[0] ?? ''
        if (file.startsWith('*')) def.pet = file.replace(/^\*\s*pet\s*/i, '').trim()
        else if (file)
          def.texture = {
            file,
            cellWidth: n[0] ?? 0,
            cellHeight: n[1] ?? 0,
            billboard: !/^off$/i.test(words(t)[1] ?? 'on'),
          }
        break
      }
      case 'blend': {
        const w = words(t)
        def.blend = blendOf(w[0])
        def.tailBlend = blendOf(w[1] ?? w[0])
        break
      }
      case 'add_fade':
        def.fade.push({ from: n[0] ?? 0, a: argb(n, 1), to: n[5] ?? 1, b: argb(n, 6) })
        break
      case 'init_size':
        def.size = [n[0] ?? 1, n[1] ?? n[0] ?? 1]
        break
      case 'add_size':
        def.sizeCurve.push({ from: n[0] ?? 0, a: n[1] ?? 1, to: n[2] ?? 1, b: n[3] ?? 1 })
        break
      case 'issphere':
        sphere = (n[0] ?? 0) === 1
        break
      case 'genpos':
        genPos = n
        break
      case 'add_generation':
        def.generation.push({
          start: n[0] ?? 0,
          end: n[1] ?? 0,
          count: Math.round(n[2] ?? 1),
          cone: n[3] ?? 0,
        })
        break
      case 'lifetime':
        def.life = [n[0] ?? 0, n[1] ?? n[0] ?? 0]
        break
      case 'init_velocity':
        def.velocity = [v3(n, 0), v3(n, 3)]
        break
      case 'add_velocity':
        def.velocityCurve.push({ from: n[0] ?? 0, a: n[1] ?? 1, to: n[2] ?? 0, b: n[3] ?? 1 })
        break
      case 'init_angle':
        def.angle = [v3(n, 0), v3(n, 3)]
        break
      case 'init_rotation':
        def.rotation = [v3(n, 0), v3(n, 3)]
        break
      case 'add_rotation':
        def.rotationCurve.push({ from: n[0] ?? 0, a: n[1] ?? 1, to: n[2] ?? 1, b: n[3] ?? 1 })
        break
      case 'gravity':
        def.gravity = v3(n, 0)
        break
      case 'friction':
        def.friction = n[0] ?? 0
        break
      case 'groundfriction':
        def.groundFriction = n[0] ?? 0
        break
      case 'ground':
        def.ground = { y: n[0] ?? 0, bounce: n[1] ?? 0 }
        break
      case 'add_gravitypoint':
        def.gravityPoint = {
          center: v3(n, 0),
          strength: n[3] ?? 0,
          range: n[4] ?? 0,
          outside: n[5] ?? 0,
        }
        break
      case 'init_frame':
        def.frame = [Math.round(n[0] ?? 0), Math.round(n[1] ?? n[0] ?? 0)]
        break
      case 'add_frame':
        def.frames = {
          from: n[0] ?? 0,
          to: n[1] ?? 1,
          first: Math.round(n[2] ?? 0),
          last: Math.round(n[3] ?? 0),
          interval: n[4] ?? 100,
        }
        break
      case 'tail':
        def.tail = {
          length: Math.round(n[0] ?? 0),
          interval: n[1] ?? 10,
          end: argb(n, 2),
          file: words(t)[0] ?? '',
          width: n[6] ?? 100,
        }
        break
      case 'add_quake':
        def.quake = {
          start: n[3] ?? 0,
          from: v3(n, 4),
          end: n[7] ?? 0,
          to: v3(n, 8),
          interval: n[11] ?? 33,
        }
        break
      case 'add_flash':
        def.flash = { start: n[0] ?? 0, peak: n[1] ?? 0, end: n[2] ?? 0 }
        break
    }
  }
  def.genPos = sphere
    ? {
        sphere: true,
        center: v3(genPos, 0),
        near: genPos[3] ?? 0,
        far: genPos[4] ?? genPos[3] ?? 0,
        cone: genPos[5] ?? Math.PI * 2,
      }
    : { sphere: false, min: v3(genPos, 0), max: v3(genPos, 3) }
  return def
}

export function parseSeq(text: string): SeqDef {
  const events: SeqEvent[] = []
  let stop = 0
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/;.*$/, '').trim()
    const m = /^(\d+)\s*:\s*(\w+)\s*(?:=\s*(.*))?$/.exec(line)
    if (!m) continue
    const time = Number(m[1])
    const what = m[2]!.toLowerCase()
    if (what === 'stop') stop = Math.max(stop, time)
    if (what !== 'spray' || !m[3]) continue
    const t = tokens(m[3])
    const n = nums(t)
    const w = words(t)
    events.push({
      time,
      file: w[0] ?? '',
      position: v3(n, 0),
      velocity: v3(n, 3),
      attached: w.some((x) => /^strongbond$/i.test(x)),
    })
  }
  return { events, stop: stop || Math.max(1000, ...events.map((e) => e.time + 1000)) }
}

/** Valor de uma curva por segmentos no ponto `x` (fora dos segmentos, o mais próximo). */
export function curve(segments: Segment<number>[], x: number, fallback = 1): number {
  if (segments.length === 0) return fallback
  for (const s of segments) {
    if (x >= s.from && x <= s.to) {
      const f = s.to > s.from ? (x - s.from) / (s.to - s.from) : 1
      return s.a + (s.b - s.a) * f
    }
  }
  const first = segments[0]!
  const last = segments.reduce((a, b) => (b.to > a.to ? b : a))
  return x < first.from ? first.a : last.b
}

/** Cor ARGB pela idade (0..1), pelos segmentos de Add_Fade. */
export function fadeAt(segments: Segment<Argb>[], x: number): Argb {
  if (segments.length === 0) return [1, 1, 1, 1]
  for (const s of segments) {
    if (x >= s.from && x <= s.to) {
      const f = s.to > s.from ? (x - s.from) / (s.to - s.from) : 1
      return s.a.map((v, i) => v + (s.b[i]! - v) * f) as Argb
    }
  }
  const last = segments.reduce((a, b) => (b.to > a.to ? b : a))
  return x < segments[0]!.from ? segments[0]!.a : last.b
}

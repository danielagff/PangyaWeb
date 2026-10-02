/**
 * Movimentos dos personagens do Pangya pelos nomes reais do .apet (coreano), conferidos no
 * diagnóstico do cliente JP: 기본자세 (postura básica), <taco>샷준비 (preparando a tacada),
 * <taco>샷 (a tacada), <taco>샷파워준비 (backswing: começa junto com a tacada e para no
 * topo), <taco>샷게걸음 (andar de lado ao mirar), poses de resultado (버디승리포즈…).
 * Tacos: 우드 madeira, 아이언 ferro, 샌드웻지 wedge, 퍼팅 putter.
 */

export interface MotionInfo {
  name: string
  frameStart: number
  frameEnd: number
}

export type ClubCategory = 'wood' | 'iron' | 'wedge' | 'putter'

const CLUB_KO: Record<ClubCategory, string[]> = {
  wood: ['우드'],
  iron: ['아이언'],
  wedge: ['샌드웻지', '아이언'],
  putter: ['퍼팅'],
}

/** Fração do downswing (do topo ao fim da tacada) em que o taco acerta a bola (estimativa). */
export const IMPACT_AFTER_TOP = 0.3

export interface GolfMotions {
  /** Parado, preparando a tacada (laço). */
  idle: string | undefined
  /** Andando de lado enquanto gira a mira (laço). */
  walk: string | undefined
  /** Backswing até o topo (segura no fim), enquanto a barra corre. */
  backswing: string | undefined
  swing: string | undefined
  /** Segundos do início da tacada até o topo do backswing (onde a barra solta). */
  top: number
  /** Segundos do início da tacada até o impacto na bola. */
  impact: number
}

const FPS = 30

export function golfMotions(motions: MotionInfo[], club: ClubCategory): GolfMotions {
  const byName = new Map(motions.map((m) => [m.name, m]))
  const find = (suffix: string) => {
    for (const ko of CLUB_KO[club]) {
      const m = byName.get(`${ko}${suffix}`)
      if (m) return m
    }
    return undefined
  }
  const swing = find('샷')
  const backswing = find('샷파워준비')
  const duration = swing ? (swing.frameEnd - swing.frameStart) / FPS : 0
  let top = 0
  let impact = duration * 0.55
  if (swing && backswing && backswing.frameStart === swing.frameStart) {
    const topFrame = backswing.frameEnd
    top = (topFrame - swing.frameStart) / FPS
    impact = top + ((swing.frameEnd - topFrame) / FPS) * IMPACT_AFTER_TOP
  }
  return {
    idle: (find('샷준비') ?? byName.get('기본자세'))?.name,
    walk: find('샷게걸음')?.name,
    backswing: backswing?.name,
    swing: swing?.name,
    top,
    impact,
  }
}

export type Reaction = 'albatross' | 'eagle' | 'birdie' | 'par' | 'bogey' | 'trouble' | 'putt'

const REACTIONS: Record<Reaction, string[]> = {
  albatross: ['알바홀인승리포즈', '이글승리포즈'],
  eagle: ['이글승리포즈', '버디승리포즈'],
  birdie: ['버디승리포즈'],
  par: ['세이브파승리포즈', '퍼팅성공'],
  bogey: ['보기실격실망포즈', '퍼팅후실망포즈'],
  trouble: ['타임오버벙커OB실망포즈', '보기실격실망포즈'],
  putt: ['퍼팅성공'],
}

/** Pose de reação ao resultado (comemoração/decepção). */
export function reactionMotion(motions: MotionInfo[], reaction: Reaction) {
  const names = new Set(motions.map((m) => m.name))
  return REACTIONS[reaction].find((n) => names.has(n))
}

/** Reação pelo resultado do buraco (tacadas − par). */
export function reactionForScore(strokes: number, par: number): Reaction {
  const diff = strokes - par
  if (strokes === 1 || diff <= -3) return 'albatross'
  if (diff === -2) return 'eagle'
  if (diff === -1) return 'birdie'
  if (diff === 0) return 'par'
  return 'bogey'
}

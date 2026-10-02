/**
 * Colisão da bola com os objetos do cenário (árvores, casas…), usando as caixas
 * orientadas do jogo (`.pycb` / blocos COLL dos .pet, ver @pangya/formats).
 *
 * A detecção é exata (segmento do passo × caixa). A resposta é um modelo próprio — a
 * componente normal volta com `restitution` e a tangencial perde parte da velocidade —
 * a calibrar contra o original junto com o quique no chão (spec 08).
 */

import { vec3, type Vec3 } from './vec3.ts'

export const OBSTACLE_TUNING = {
  /** Fração da velocidade normal que volta no choque. */
  restitution: 0.3,
  /** Fração da velocidade tangencial que sobra no choque. */
  tangentKeep: 0.5,
  /** Afastamento da superfície depois do choque (unidades). */
  separation: 0.05,
}

export type Corners = readonly (readonly [number, number, number])[]

interface Obb {
  center: Vec3
  axes: [Vec3, Vec3, Vec3]
  half: [number, number, number]
  name: string
}

export interface ObstacleHit {
  /** Fração do segmento (0..1) onde a bola encosta na caixa. */
  t: number
  point: Vec3
  /** Normal da face atingida, apontando para fora da caixa. */
  normal: Vec3
  name: string
}

const CELL = 64

/** Caixa orientada a partir dos 8 cantos (0–3 embaixo, 4–7 em cima, como no .pycb). */
function toObb(corners: Corners, name: string): Obb | undefined {
  const p = corners.map(([x, y, z]) => vec3.of(x, y, z))
  if (p.length !== 8) return undefined
  const center = vec3.scale(p.reduce(vec3.add), 1 / 8)
  const edges = [vec3.sub(p[1]!, p[0]!), vec3.sub(p[4]!, p[0]!), vec3.sub(p[3]!, p[0]!)]
  const lengths = edges.map(vec3.length)
  if (lengths.some((l) => l < 1e-4)) return undefined
  return {
    center,
    axes: edges.map((e, i) => vec3.scale(e, 1 / lengths[i]!)) as Obb['axes'],
    half: lengths.map((l) => l / 2) as Obb['half'],
    name,
  }
}

export class Obstacles {
  private readonly boxes: Obb[] = []
  private readonly grid = new Map<string, number[]>()

  constructor(boxes: { corners: Corners; name?: string }[]) {
    for (const box of boxes) {
      const obb = toObb(box.corners, box.name ?? '')
      if (!obb) continue
      const index = this.boxes.push(obb) - 1
      const xs = box.corners.map((c) => c[0])
      const zs = box.corners.map((c) => c[2])
      this.cells(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), (key) => {
        const list = this.grid.get(key)
        if (list) list.push(index)
        else this.grid.set(key, [index])
      })
    }
  }

  get size() {
    return this.boxes.length
  }

  private cells(x0: number, z0: number, x1: number, z1: number, visit: (key: string) => void) {
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
      for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) visit(`${cx},${cz}`)
    }
  }

  /** Primeira caixa que o segmento a→b atravessa entrando por fora (undefined = livre). */
  hit(a: Vec3, b: Vec3): ObstacleHit | undefined {
    const candidates = new Set<number>()
    this.cells(
      Math.min(a.x, b.x),
      Math.min(a.z, b.z),
      Math.max(a.x, b.x),
      Math.max(a.z, b.z),
      (key) => {
        for (const i of this.grid.get(key) ?? []) candidates.add(i)
      },
    )
    let best: ObstacleHit | undefined
    for (const i of candidates) {
      const hit = segmentObb(a, b, this.boxes[i]!)
      if (hit && (!best || hit.t < best.t)) best = hit
    }
    return best
  }
}

/** Teste de "slabs" no referencial da caixa. Ignora segmentos que já começam dentro. */
function segmentObb(a: Vec3, b: Vec3, box: Obb): ObstacleHit | undefined {
  const d = vec3.sub(b, a)
  const rel = vec3.sub(a, box.center)
  let tEnter = 0
  let tExit = 1
  let axisHit = -1
  let sign = 1
  let inside = true
  for (let k = 0; k < 3; k++) {
    const axis = box.axes[k]!
    const origin = vec3.dot(rel, axis)
    const dir = vec3.dot(d, axis)
    const h = box.half[k]!
    if (Math.abs(origin) > h) inside = false
    if (Math.abs(dir) < 1e-9) {
      if (Math.abs(origin) > h) return undefined
      continue
    }
    let t0 = (-h - origin) / dir
    let t1 = (h - origin) / dir
    let s = -1
    if (t0 > t1) {
      ;[t0, t1] = [t1, t0]
      s = 1
    }
    if (t0 > tEnter) {
      tEnter = t0
      axisHit = k
      sign = s
    }
    tExit = Math.min(tExit, t1)
    if (tEnter > tExit) return undefined
  }
  if (inside || axisHit < 0) return undefined
  return {
    t: tEnter,
    point: vec3.add(a, vec3.scale(d, tEnter)),
    normal: vec3.scale(box.axes[axisHit]!, sign),
    name: box.name,
  }
}

/** Velocidade depois do choque com a face de normal `n`. */
export function deflect(v: Vec3, n: Vec3, k = OBSTACLE_TUNING): Vec3 {
  const vn = vec3.dot(v, n)
  if (vn >= 0) return v
  const normal = vec3.scale(n, vn)
  const tangent = vec3.sub(v, normal)
  return vec3.add(vec3.scale(tangent, k.tangentKeep), vec3.scale(normal, -k.restitution))
}

/** Ponto logo fora da caixa, para a bola não ficar presa na superfície. */
export const pushOut = (hit: ObstacleHit, k = OBSTACLE_TUNING): Vec3 =>
  vec3.add(hit.point, vec3.scale(hit.normal, k.separation))

import type { Vec3 } from './vec3.ts'

/**
 * A bola entrando na cova: desliza até o centro e cai lá dentro (a cova é um buraco de
 * verdade, com fundo `CUP_DEPTH` abaixo do green). Quadros a cada STEP_TIME.
 */
export const CUP_DEPTH = 0.75

/** Quadros (x, y, z) de `from` até o centro da cova e depois até o fundo. */
export function dropIntoCup(from: Vec3, cup: Vec3, slideFrames = 4, fallFrames = 8): number[] {
  const frames: number[] = []
  for (let i = 1; i <= slideFrames; i++) {
    const f = i / slideFrames
    frames.push(
      from.x + (cup.x - from.x) * f,
      from.y + (cup.y - from.y) * f,
      from.z + (cup.z - from.z) * f,
    )
  }
  // Queda acelerada (f²) até o fundo.
  for (let i = 1; i <= fallFrames; i++) {
    const f = i / fallFrames
    frames.push(cup.x, cup.y - CUP_DEPTH * f * f, cup.z)
  }
  return frames
}

/** Fundo da cova (onde a bola fica depois de cair). */
export const cupBottom = (cup: Vec3): Vec3 => ({ x: cup.x, y: cup.y - CUP_DEPTH, z: cup.z })

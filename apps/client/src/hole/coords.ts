import type { Mat4x3 } from '@pangya/formats'
import { Matrix4, Vector3 } from 'three'

/** O Pangya usa Z invertido em relação ao Three.js. */
export const toScene = (x: number, y: number, z: number) => new Vector3(x, y, -z)

export const flipZ = (positions: Float32Array) => {
  const out = positions.slice()
  for (let i = 2; i < out.length; i += 3) out[i] = -out[i]!
  return out
}

/** Matriz 4×3 do Pangya → Matrix4 do Three.js já com o Z invertido. */
export const sceneMatrix = (m: Mat4x3) =>
  new Matrix4().set(
    m[0]!,
    m[3]!,
    m[6]!,
    m[9]!,
    m[1]!,
    m[4]!,
    m[7]!,
    m[10]!,
    -m[2]!,
    -m[5]!,
    -m[8]!,
    -m[11]!,
    0,
    0,
    0,
    1,
  )

/** Direção da mira (radianos, 0 = +Z do Pangya, positivo = esquerda) na cena. */
export const aimDirection = (aim: number) => toScene(-Math.sin(aim), 0, Math.cos(aim)).normalize()

/** Mira (radianos) que aponta de (x1, z1) para (x2, z2), em coordenadas do Pangya. */
export const aimTowards = (x1: number, z1: number, x2: number, z2: number) =>
  Math.atan2(-(x2 - x1), z2 - z1)

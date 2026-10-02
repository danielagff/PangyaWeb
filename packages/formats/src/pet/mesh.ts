import { applyMat4x3, boneWorldMatrix, type Pet } from './pet.ts'

/** Submalha de um .pet com uma única textura, pronta para a GPU (não indexada). */
export interface PetSubMesh {
  texture: string | undefined
  /** Texturas com "]" nos 5 primeiros caracteres usam transparência no jogo. */
  blend: boolean
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
  /** Cor RGB (0–1) por vértice, quando há iluminação pré-calculada (terreno). */
  colors?: Float32Array
}

/**
 * Distribui as cores pré-calculadas do terreno (`Gbin.baseColors`) pelos cantos dos
 * triângulos do .pet, devolvendo RGB (0–1) por canto, na ordem dos triângulos.
 *
 * Ordem do arquivo (GhostMapEditor, viewer_core.cpp ComputeBaseVertexColors): só os
 * triângulos presos ao osso raiz, agrupados por textura na ordem da primeira aparição,
 * com os grupos percorridos do último para o primeiro. Sem dados compatíveis, devolve
 * undefined (o terreno fica sem sombreamento).
 */
export function baseCornerColors(
  pet: Pet,
  colors: Uint32Array | undefined,
): Float32Array | undefined {
  if (!colors || colors.length !== pet.triangles.length * 3 || pet.bones.length === 0) {
    return undefined
  }
  const out = new Float32Array(pet.triangles.length * 9).fill(1)
  const rootBone = pet.bones[0]!.name
  const groups = new Map<number, number[]>()
  pet.triangles.forEach((triangle, i) => {
    const bone = pet.vertices[triangle[0].index]?.mainBone ?? -1
    if (pet.bones[bone]?.name !== rootBone) return
    const texture = pet.triangleTexture[i] ?? -1
    const group = groups.get(texture)
    if (group) group.push(i)
    else groups.set(texture, [i])
  })
  let next = 0
  for (const group of [...groups.values()].reverse()) {
    for (const triangle of group) {
      for (let k = 0; k < 3; k++) {
        const c = colors[next++]!
        const at = (triangle * 3 + k) * 3
        out[at] = ((c >>> 16) & 0xff) / 255
        out[at + 1] = ((c >>> 8) & 0xff) / 255
        out[at + 2] = (c & 0xff) / 255
      }
    }
  }
  return out
}

/**
 * Monta a malha na pose de repouso (cada vértice posicionado pelo seu osso principal),
 * agrupada por textura. Coordenadas do Pangya; a ordem dos cantos é preservada.
 * `cornerColors` (de `baseCornerColors`) vira o atributo `colors` das submalhas.
 */
export function petToSubMeshes(pet: Pet, cornerColors?: Float32Array): PetSubMesh[] {
  const boneMatrices = pet.bones.map((_, i) => boneWorldMatrix(pet, i))
  const posed = pet.vertices.map((v) => applyMat4x3(boneMatrices[v.mainBone]!, v.x, v.y, v.z))

  const groups = Map.groupBy(
    pet.triangles.map((_, i) => i),
    (i) => pet.triangleTexture[i] ?? -1,
  )

  return [...groups].map(([textureIndex, triangles]) => {
    const n = triangles.length * 3
    const positions = new Float32Array(n * 3)
    const normals = new Float32Array(n * 3)
    const uvs = new Float32Array(n * 2)
    const colors = cornerColors ? new Float32Array(n * 3) : undefined
    let w = 0
    for (const t of triangles) {
      pet.triangles[t]!.forEach((corner, k) => {
        positions.set(posed[corner.index]!, w * 3)
        normals.set(corner.normal, w * 3)
        uvs.set(corner.uv, w * 2)
        colors?.set(cornerColors!.subarray((t * 3 + k) * 3, (t * 3 + k) * 3 + 3), w * 3)
        w++
      })
    }
    const texture = pet.textures[textureIndex]?.name
    return {
      texture,
      blend: (texture ?? '').slice(0, 5).includes(']'),
      positions,
      normals,
      uvs,
      ...(colors && { colors }),
    }
  })
}

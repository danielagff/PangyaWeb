import { applyMat4x3, boneWorldMatrix, type Pet } from './pet.ts'

/** Submalha de um .pet com uma única textura, pronta para a GPU (não indexada). */
export interface PetSubMesh {
  texture: string | undefined
  /** Texturas com "]" nos 5 primeiros caracteres usam transparência no jogo. */
  blend: boolean
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
}

/**
 * Monta a malha na pose de repouso (cada vértice posicionado pelo seu osso principal),
 * agrupada por textura. Coordenadas do Pangya; a ordem dos cantos é preservada.
 */
export function petToSubMeshes(pet: Pet): PetSubMesh[] {
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
    let w = 0
    for (const t of triangles) {
      for (const corner of pet.triangles[t]!) {
        positions.set(posed[corner.index]!, w * 3)
        normals.set(corner.normal, w * 3)
        uvs.set(corner.uv, w * 2)
        w++
      }
    }
    const texture = pet.textures[textureIndex]?.name
    return {
      texture,
      blend: (texture ?? '').slice(0, 5).includes(']'),
      positions,
      normals,
      uvs,
    }
  })
}

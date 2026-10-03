import { describe, expect, it } from 'vitest'
import { baseCornerColors, petToSubMeshes } from './mesh.ts'
import type { Pet, PetCorner } from './pet.ts'

const corner = (index: number): PetCorner => ({ index, normal: [0, 1, 0], uv: [0, 0] })

/** 3 triângulos: texturas 0, 1, 0; o terceiro preso a um osso que não é a raiz. */
function terrain(): Pet {
  return {
    version: { major: 1, minor: 3 },
    textures: ['a.dds', 'b.dds'].map((name) => ({ name, flag: 0, group: 0, diffuse: 0 })),
    faceAnimations: [],
    bones: [
      { name: 'root', parent: -1, matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
      { name: 'other', parent: 0, matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
    ],
    vertices: [0, 0, 1].map((mainBone) => ({ x: 0, y: 0, z: 0, mainBone, bones: [], weights: [] })),
    triangles: [
      [corner(0), corner(1), corner(1)],
      [corner(1), corner(0), corner(0)],
      [corner(2), corner(0), corner(1)],
    ],
    triangleTexture: [0, 1, 0],
    animations: [],
    motions: [],
    collisions: [],
    frameEvents: [],
  }
}

describe('baseCornerColors', () => {
  it('segue a ordem do arquivo: grupos de textura do último para o primeiro, só o osso raiz', () => {
    // 9 cores (3 por face): 3 para o grupo b (triângulo 1) e 3 para o grupo a (triângulo 0).
    const colors = Uint32Array.from([
      0x00ff00, 0x00ff00, 0x00ff00, 0xff0000, 0x800000, 0x0000ff, 0, 0, 0,
    ])
    const out = baseCornerColors(terrain(), colors)!
    expect(Array.from(out.subarray(0, 3))).toEqual([1, 0, 0])
    expect(out[3]).toBeCloseTo(128 / 255)
    expect(Array.from(out.subarray(6, 9))).toEqual([0, 0, 1])
    expect(Array.from(out.subarray(9, 12))).toEqual([0, 1, 0])
    // Triângulo fora do osso raiz fica branco.
    expect(Array.from(out.subarray(18, 27))).toEqual(Array(9).fill(1))
  })

  it('devolve undefined quando a quantidade não bate com o .pet', () => {
    expect(baseCornerColors(terrain(), new Uint32Array(3))).toBeUndefined()
    expect(baseCornerColors(terrain(), undefined)).toBeUndefined()
  })

  it('petToSubMeshes leva as cores para cada submalha', () => {
    const colors = baseCornerColors(terrain(), new Uint32Array(9).fill(0x336699))!
    const [a, b] = petToSubMeshes(terrain(), colors)
    expect(a!.colors).toHaveLength(2 * 3 * 3)
    expect(b!.colors![0]).toBeCloseTo(0x33 / 255)
    expect(petToSubMeshes(terrain())[0]!.colors).toBeUndefined()
  })
})

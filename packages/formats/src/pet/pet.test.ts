import { describe, expect, it } from 'vitest'
import { petToSubMeshes } from './mesh.ts'
import { boneWorldMatrix, petKindFromPath, readPet } from './pet.ts'
import { Writer } from '../test-writer.ts'

const corner = (w: Writer, index: number, u: number) =>
  w
    .u32(index)
    .f32(0, 1, 0)
    .u8(1)
    .f32(u, 1 - u)

function samplePet() {
  const mesh = new Writer().u32(3)
  // Vértice 0: um osso (peso 255) + 2 bytes extras; vértices 1 e 2 divididos entre 2 ossos.
  mesh.f32(1, 0, 0).u8(255).u8(1).u16(0)
  mesh.f32(0, 1, 0).u8(128).u8(0).u8(127).u8(1)
  mesh.f32(0, 0, 1).u8(200).u8(1).u8(55).u8(0)
  mesh.u32(1)
  corner(mesh, 0, 0)
  corner(mesh, 1, 0.5)
  corner(mesh, 2, 1)
  mesh.u8(0) // textura do triângulo

  return new Writer()
    .block('VERS', new Writer().u8(3).u8(1).u16(0))
    .block(
      'TEXT',
      new Writer().u32(1).fixed('grass.jpg', 32).u8(0).u8(0).u16(0).u32(0xffffffff).u32(0),
    )
    .block(
      'BONE',
      new Writer()
        .u8(2)
        .cstr('root')
        .u8(0xff)
        .f32(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
        .f32(0)
        .cstr('arm')
        .u8(0)
        .f32(1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 0, 0)
        .f32(0),
    )
    .block('MESH', mesh)
    .block(
      'ANIM',
      new Writer().u8(1).u32(1).f32(0, 1, 2, 3).u32(1).f32(0, 0, 0, 0, 1).u32(0).u32(0).u8(0xff),
    )
    .block(
      'MOTI',
      new Writer().u32(1).lstr('swing').u32(0).u32(30).lstr('idle').lstr('').f32(0).lstr('root'),
    )
    .block(
      'COLL',
      new Writer()
        .u32(1)
        .u32(1)
        .u32(0)
        .lstr('box01')
        .lstr('root')
        .lstr('')
        .lstr('')
        .f32(-1, -2, -3, 1, 2, 3),
    )
    .block('XXXX', new Writer().u32(123)) // bloco desconhecido é ignorado
    .done()
}

describe('readPet', () => {
  const pet = readPet(samplePet())

  it('lê versão, texturas e ossos', () => {
    expect(pet.version).toEqual({ major: 1, minor: 3 })
    expect(pet.textures).toEqual([{ name: 'grass.jpg', flag: 0, group: 0, diffuse: 0xffffffff }])
    expect(pet.bones.map((b) => [b.name, b.parent])).toEqual([
      ['root', -1],
      ['arm', 0],
    ])
  })

  it('lê vértices com pesos normalizados', () => {
    expect(pet.vertices[0]).toMatchObject({ mainBone: 1, bones: [1], weights: [1] })
    expect(pet.vertices[1]!.bones).toEqual([0, 1])
    expect(pet.vertices[1]!.weights[0]! + pet.vertices[1]!.weights[1]!).toBeCloseTo(1)
  })

  it('lê triângulos preservando a ordem dos cantos', () => {
    expect(pet.triangles[0]!.map((c) => c.index)).toEqual([0, 1, 2])
    expect(pet.triangles[0]![1]!.uv).toEqual([0.5, 0.5])
    expect(pet.triangleTexture).toEqual([0])
  })

  it('lê animações, motions e caixas de colisão', () => {
    expect(pet.animations[0]).toMatchObject({ bone: 1, position: [{ time: 0, value: [1, 2, 3] }] })
    expect(pet.motions[0]).toMatchObject({ name: 'swing', frameEnd: 30, next: 'idle' })
    expect(pet.collisions[0]).toMatchObject({ boxName: 'box01', min: [-1, -2, -3], max: [1, 2, 3] })
  })

  it('compõe a matriz de mundo pela cadeia de ossos', () => {
    expect(boneWorldMatrix(pet, 1).slice(9)).toEqual([10, 0, 0])
  })

  it('monta a malha na pose de repouso, agrupada por textura', () => {
    const [sub] = petToSubMeshes(pet)
    expect(sub?.texture).toBe('grass.jpg')
    // Vértice 0 está no osso "arm" (deslocado 10 em x).
    expect(Array.from(sub!.positions.slice(0, 3))).toEqual([11, 0, 0])
    expect(sub!.positions).toHaveLength(9)
  })

  it('rejeita bloco truncado', () => {
    const bytes = samplePet()
    expect(() => readPet(bytes.subarray(0, 30))).toThrow(/truncado/)
  })
})

describe('petKindFromPath', () => {
  it('identifica pelo sufixo', () => {
    expect(petKindFromPath('model/Nuri.MPET')).toBe('mpet')
    expect(petKindFromPath('map/pink_01.pet')).toBe('pet')
  })
})

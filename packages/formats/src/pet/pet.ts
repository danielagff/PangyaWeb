// Leitor dos modelos .pet / .apet / .bpet / .mpet do Pangya.
// Portado de GhostMapEditor (https://github.com/lbarceloss/GhostMapEditor, MIT,
// src/shared/pangya_pet.cpp); bloco COLL segundo pet-source_tools (Acrisio Filho).
//
// Arquivo = sequência de blocos [id: 4 bytes][tamanho: u32][dados]. Nomes em CP949.

import { BinaryReader } from '../binary-reader.ts'

export type PetKind = 'pet' | 'apet' | 'bpet' | 'mpet'

export interface PetTexture {
  name: string
  flag: number
  group: number
  diffuse: number
}

/** Matriz 4×3 em colunas: [xx, xy, xz, yx, yy, yz, zx, zy, zz, tx, ty, tz]. */
export type Mat4x3 = number[]

export interface PetBone {
  name: string
  parent: number
  matrix: Mat4x3
}

export interface PetVertex {
  x: number
  y: number
  z: number
  /** Osso usado para posicionar o vértice na pose de repouso. */
  mainBone: number
  bones: number[]
  weights: number[]
}

export interface PetCorner {
  index: number
  normal: [number, number, number]
  uv: [number, number]
}

export interface PetKey3 {
  time: number
  value: [number, number, number]
}

export interface PetKeyQuat {
  time: number
  value: [number, number, number, number]
}

export interface PetBoneAnimation {
  bone: number
  position: PetKey3[]
  rotation: PetKeyQuat[]
  scale: PetKey3[]
}

export interface PetMotion {
  name: string
  frameStart: number
  frameEnd: number
  next: string
  rootBone: string
}

/** Caixa de colisão (usada pela bola contra objetos do cenário). */
export interface PetCollision {
  shape: number
  show: number
  boxName: string
  boneName: string
  options: [string, string]
  min: [number, number, number]
  max: [number, number, number]
}

export interface Pet {
  version: { major: number; minor: number }
  textures: PetTexture[]
  bones: PetBone[]
  vertices: PetVertex[]
  /** Triângulos: 3 cantos cada, na ordem original (o jogo depende dela). */
  triangles: [PetCorner, PetCorner, PetCorner][]
  /** Índice da textura de cada triângulo (-1 = sem textura). */
  triangleTexture: number[]
  animations: PetBoneAnimation[]
  motions: PetMotion[]
  collisions: PetCollision[]
}

const IDENTITY: Mat4x3 = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]

export function petKindFromPath(path: string): PetKind {
  const ext = path.toLowerCase().split('.').pop()
  return ext === 'apet' || ext === 'bpet' || ext === 'mpet' ? ext : 'pet'
}

const atLeast = (v: Pet['version'], major: number, minor: number) =>
  v.major !== major ? v.major > major : v.minor >= minor

/** Id de osso: u8; 0xFF = nenhum; 0xFE = segue i16. */
function boneId(r: BinaryReader): number {
  const id = r.u8()
  if (id === 0xff) return -1
  if (id === 0xfe) {
    const wide = r.i16()
    return wide === -1 ? -1 : wide
  }
  return id
}

const vec3 = (r: BinaryReader): [number, number, number] => [r.f32(), r.f32(), r.f32()]

export function readPet(bytes: Uint8Array, kind: PetKind = 'pet'): Pet {
  const pet: Pet = {
    version: { major: 1, minor: 0 },
    textures: [],
    bones: [],
    vertices: [],
    triangles: [],
    triangleTexture: [],
    animations: [],
    motions: [],
    collisions: [],
  }
  const file = new BinaryReader(bytes)

  while (file.remaining >= 8) {
    const id = new TextDecoder('latin1').decode(file.bytesN(4))
    const size = file.u32()
    if (size > file.remaining) throw new Error(`bloco ${id} truncado (${size} bytes)`)
    const b = new BinaryReader(file.bytesN(size))

    switch (id) {
      case 'VERS':
        pet.version.minor = b.u8()
        pet.version.major = b.u8()
        break
      case 'TEXT':
        readTextures(b, pet)
        break
      case 'BONE':
        readBones(b, pet, kind)
        break
      case 'MESH':
        readMesh(b, pet, kind)
        break
      case 'ANIM':
        readAnimations(b, pet)
        break
      case 'MOTI':
        readMotions(b, pet)
        break
      case 'COLL':
        readCollisions(b, pet)
        break
      // SMTL, FANM, FRAM, EXTR: ainda não usados
    }
  }

  if (pet.bones.length === 0) pet.bones.push({ name: 'root', parent: -1, matrix: [...IDENTITY] })
  sanitize(pet)
  return pet
}

function readTextures(b: BinaryReader, pet: Pet) {
  const count = b.u32()
  if (count > 4096) throw new Error(`TEXT com ${count} texturas`)
  for (let i = 0; i < count; i++) {
    const name = b.fixedString(32, 'euc-kr')
    const flag = b.i8()
    const group = b.u8()
    b.skip(2)
    const diffuse = b.u32()
    b.skip(4)
    pet.textures.push({ name, flag, group, diffuse })
  }
}

function readBones(b: BinaryReader, pet: Pet, kind: PetKind) {
  let count = b.u8()
  if (count === 0) count = b.u16()
  const hasMatrix = kind !== 'apet'
  for (let i = 0; i < count; i++) {
    const name = b.cString()
    const parent = boneId(b)
    let matrix = [...IDENTITY]
    if (hasMatrix) {
      matrix = b.f32n(12)
      if (atLeast(pet.version, 1, 3)) b.skip(4)
    }
    pet.bones.push({ name, parent, matrix })
  }
}

function readMesh(b: BinaryReader, pet: Pet, kind: PetKind) {
  if (kind === 'mpet') {
    const extra = b.u8()
    b.skip(extra * (1 + 3 + 16))
  }

  const vertexCount = b.u32()
  if (vertexCount > 4_000_000) throw new Error(`MESH com ${vertexCount} vértices`)
  for (let i = 0; i < vertexCount; i++) {
    const [x, y, z] = vec3(b)
    if (kind === 'mpet') b.skip(4)
    const bones: number[] = []
    const weights: number[] = []
    let total = 0
    let count = 0
    // Pesos em u8 que somam 255; cada peso vem com o osso.
    while (total < 0xff) {
      const weight = b.u8()
      const bone = Math.max(0, boneId(b))
      if (bones.length < 4) {
        bones.push(bone)
        weights.push(weight / 255)
      }
      total += weight
      if (++count > 64) throw new Error(`vértice ${i} com pesos inválidos`)
    }
    if (count < 2) b.skip(2)
    const sum = weights.reduce((s, w) => s + w, 0)
    pet.vertices.push({
      x,
      y,
      z,
      mainBone: bones[0] ?? 0,
      bones: bones.length > 0 ? bones : [0],
      weights: sum > 0.0001 ? weights.map((w) => w / sum) : [1],
    })
  }

  const triangleCount = b.u32()
  if (triangleCount > 4_000_000) throw new Error(`MESH com ${triangleCount} triângulos`)
  const multiUv = atLeast(pet.version, 1, 2)
  for (let i = 0; i < triangleCount; i++) {
    const corner = (): PetCorner => {
      const index = b.u32()
      const normal = vec3(b)
      const uvCount = multiUv ? b.u8() : 1
      let uv: [number, number] = [0, 0]
      for (let u = 0; u < uvCount; u++) {
        const pair: [number, number] = [b.f32(), b.f32()]
        if (u === 0) uv = pair
      }
      return { index, normal, uv }
    }
    pet.triangles.push([corner(), corner(), corner()])
  }
  for (let i = 0; i < triangleCount; i++) pet.triangleTexture.push(b.i8())
}

function readAnimations(b: BinaryReader, pet: Pet) {
  const hasOrientation = atLeast(pet.version, 1, 3)
  const keys3 = (): PetKey3[] =>
    Array.from({ length: b.u32() }, () => ({ time: b.f32(), value: vec3(b) }))
  while (b.remaining > 0) {
    const bone = boneId(b)
    if (bone < 0) break
    const position = keys3()
    const rotation = Array.from({ length: b.u32() }, () => ({
      time: b.f32(),
      value: [b.f32(), b.f32(), b.f32(), b.f32()] as [number, number, number, number],
    }))
    const scale = keys3()
    if (hasOrientation) b.skip(b.u32() * 8)
    pet.animations.push({ bone, position, rotation, scale })
  }
}

function readMotions(b: BinaryReader, pet: Pet) {
  const count = b.u32()
  for (let i = 0; i < count; i++) {
    const name = b.lengthString()
    const frameStart = b.u32()
    const frameEnd = b.u32()
    const next = b.lengthString()
    b.lengthString() // método de conexão
    b.skip(4) // tempo de conexão
    const rootBone = b.lengthString()
    pet.motions.push({ name, frameStart, frameEnd, next, rootBone })
  }
}

function readCollisions(b: BinaryReader, pet: Pet) {
  const count = b.u32()
  for (let i = 0; i < count; i++) {
    const shape = b.u32()
    const show = b.u32()
    const [boxName = '', boneName = '', opt1 = '', opt2 = ''] = Array.from({ length: 4 }, () =>
      b.lengthString(),
    )
    pet.collisions.push({
      shape,
      show,
      boxName,
      boneName,
      options: [opt1, opt2],
      min: vec3(b),
      max: vec3(b),
    })
  }
}

/** Corrige índices fora do intervalo, como o cliente tolera. */
function sanitize(pet: Pet) {
  const nv = pet.vertices.length
  const nb = pet.bones.length
  for (const tri of pet.triangles) for (const c of tri) if (c.index >= nv) c.index = 0
  pet.triangleTexture = pet.triangleTexture.map((t) => (t >= 0 && t < pet.textures.length ? t : -1))
  for (const v of pet.vertices) {
    if (v.mainBone >= nb) v.mainBone = 0
    v.bones = v.bones.map((bone) => (bone < nb ? bone : v.mainBone))
  }
}

// --- Pose de repouso -------------------------------------------------------

export function applyMat4x3(m: Mat4x3, x: number, y: number, z: number): [number, number, number] {
  return [
    m[0]! * x + m[3]! * y + m[6]! * z + m[9]!,
    m[1]! * x + m[4]! * y + m[7]! * z + m[10]!,
    m[2]! * x + m[5]! * y + m[8]! * z + m[11]!,
  ]
}

export function multiplyMat4x3(a: Mat4x3, b: Mat4x3): Mat4x3 {
  const c: number[] = []
  for (let col = 0; col < 3; col++) {
    const [x, y, z] = [b[col * 3]!, b[col * 3 + 1]!, b[col * 3 + 2]!]
    c.push(
      a[0]! * x + a[3]! * y + a[6]! * z,
      a[1]! * x + a[4]! * y + a[7]! * z,
      a[2]! * x + a[5]! * y + a[8]! * z,
    )
  }
  c.push(...applyMat4x3(a, b[9]!, b[10]!, b[11]!))
  return c
}

/** Matriz de mundo do osso: produto da cadeia raiz → osso. */
export function boneWorldMatrix(pet: Pet, index: number): Mat4x3 {
  const chain: number[] = []
  for (let b = index; b >= 0 && b < pet.bones.length && chain.length < 256;) {
    chain.push(b)
    const parent = pet.bones[b]!.parent
    if (parent === b) break
    b = parent
  }
  return chain.reduceRight((acc, b) => multiplyMat4x3(acc, pet.bones[b]!.matrix), [...IDENTITY])
}

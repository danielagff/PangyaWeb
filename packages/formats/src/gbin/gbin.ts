// Leitor das cenas de buraco .gbin (também .aibin/.sgbin) do Pangya, magic "WEPX".
// Portado de GhostMapEditor (https://github.com/lbarceloss/GhostMapEditor, MIT,
// src/shared/pangya_gbin.cpp). Nomes em CP949.

import { BinaryReader } from '../binary-reader.ts'
import type { Mat4x3 } from '../pet/pet.ts'

export type SpecialPoint = 'tee' | 'pin' | 'grid' | 'lobbySpawn' | 'sun'

export interface Aabb {
  min: [number, number, number]
  max: [number, number, number]
}

export interface GbinCamera {
  name: string
  position: [number, number, number]
  target: [number, number, number]
  fov: number
  bank: number
}

export interface GbinLight {
  type: number
  name: string
  position: [number, number, number]
  data: string
  special: SpecialPoint | undefined
}

export interface GbinSoundBox {
  type: number
  name: string
  box: Aabb
}

export interface GbinNode {
  name: string
  type: number
  points: [number, number, number][]
}

export interface GbinElement {
  /** Modelo .pet do elemento. */
  name: string
  animFlag: number
  collisionFlag: number
  faceCount: number
  bounds: Aabb
  baseBounds: Aabb
  /** Matriz de mundo 4×3 (coordenadas do Pangya). */
  matrix: Mat4x3
  courseType: number
  script: string
}

export interface GbinNewElement {
  name: string
  /** 1 = green/pin, 2 = tee. */
  type: number
  matrix: Mat4x3
}

export interface GbinMapCheck {
  par: number
  /** Posições XZ: 2 tees e 2×3 pins (só versões até 0x71). */
  tees?: [number, number][]
  pins?: [number, number][][]
}

export interface Gbin {
  version: number
  cameras: GbinCamera[]
  lights: GbinLight[]
  soundBoxes: GbinSoundBox[]
  textures: string[]
  nodes: GbinNode[]
  /** Elemento base: a malha do terreno do buraco. */
  base: GbinElement | undefined
  elements: GbinElement[]
  newElements: GbinNewElement[]
  mapCheck: GbinMapCheck | undefined
}

const V70 = 0x70
const V71 = 0x71
const V72 = 0x72
const LIMIT = 1_000_000

const decodeCp949 = (bytes: number[]) => new TextDecoder('euc-kr').decode(Uint8Array.from(bytes))

/** Prefixos (CP949) dos nomes de luz que marcam pontos especiais do buraco. */
const SPECIAL_PREFIXES: [string, SpecialPoint][] = [
  [decodeCp949([0xb4, 0xeb, 0xc8, 0xad, 0xb9, 0xe6, 0xbd, 0xc3, 0xc0, 0xdb]), 'lobbySpawn'],
  [decodeCp949([0xbd, 0xc3, 0xc0, 0xdb, 0xc1, 0xa1]), 'tee'],
  [decodeCp949([0xb3, 0xa1, 0xc1, 0xa1]), 'pin'],
  [decodeCp949([0xb1, 0xd7, 0xb8, 0xae, 0xb5, 0xe5]), 'grid'],
  [decodeCp949([0xc5, 0xc2, 0xbe, 0xe7]), 'sun'],
]

export function classifySpecialPoint(name: string): SpecialPoint | undefined {
  return SPECIAL_PREFIXES.find(([prefix]) => name.startsWith(prefix))?.[1]
}

const str = (r: BinaryReader, size: number) => r.fixedString(size, 'euc-kr')
const vec3 = (r: BinaryReader): [number, number, number] => [r.f32(), r.f32(), r.f32()]
const aabb = (r: BinaryReader): Aabb => ({ min: vec3(r), max: vec3(r) })

function readElement(r: BinaryReader, version: number): GbinElement {
  const options = r.u8()
  r.skip(3)
  const faceCount = r.u32()
  const name = str(r, 32)
  const bounds = aabb(r)
  const baseBounds = aabb(r)
  const matrix = r.f32n(12)
  const courseType = r.i32()
  const script = version > V70 ? str(r, 32) : ''
  if (version > V71) r.skip(12 * 4 + 8)
  return {
    name,
    animFlag: options & 7,
    collisionFlag: (options >> 3) & 0x1f,
    faceCount,
    bounds,
    baseBounds,
    matrix,
    courseType,
    script,
  }
}

const checkCount = (what: string, n: number) => {
  if (n > LIMIT) throw new Error(`${what}: contagem absurda (${n}) — arquivo corrompido?`)
  return n
}

/** `aibin` muda o tamanho do nome dos nós (32 em vez de 16). */
export function readGbin(bytes: Uint8Array, options: { aibin?: boolean } = {}): Gbin {
  const r = new BinaryReader(bytes)
  if (new TextDecoder('latin1').decode(r.bytesN(4)) !== 'WEPX') {
    throw new Error('não é um .gbin (falta o magic WEPX)')
  }
  const version = r.u32()
  if (version < V70 || version > V72) {
    throw new Error(`versão de .gbin desconhecida: 0x${version.toString(16)}`)
  }

  const counts = {
    global: r.u32(),
    type0: r.u32(),
    type1: r.u32(),
    camera: r.u32(),
    light: r.u32(),
    sound: r.u32(),
    texture: r.u32(),
    node: r.u32(),
    newElement: version > V71 ? r.u32() : 0,
  }
  for (const [what, n] of Object.entries(counts)) checkCount(what, n)

  const cameras = Array.from({ length: counts.camera }, (): GbinCamera => {
    const camera = {
      name: str(r, 32),
      position: vec3(r),
      target: vec3(r),
      fov: r.f32(),
      bank: r.f32(),
    }
    if (version > V71) r.skip(6 * 4 + 8)
    return camera
  })

  const lights = Array.from({ length: counts.light }, (): GbinLight => {
    const type = r.u8()
    const name = str(r, 32)
    const position = vec3(r)
    const data = type !== 0 ? str(r, 64) : ''
    if (version > V71) r.skip(3 * 4 + 8)
    return { type, name, position, data, special: classifySpecialPoint(name) }
  })

  const soundBoxes = Array.from({ length: counts.sound }, (): GbinSoundBox => {
    const sound = { type: r.u8(), name: str(r, 64), box: aabb(r) }
    if (version > V71) r.skip(6 * 4 + 8)
    return sound
  })

  const textures = Array.from({ length: counts.texture }, () => str(r, 32))

  const nodes = Array.from({ length: counts.node }, (): GbinNode => {
    const name = str(r, options.aibin ? 32 : 16)
    const count = checkCount('node', r.u32())
    const type = r.u32()
    return { name, type, points: Array.from({ length: count }, () => vec3(r)) }
  })

  const elementCount = counts.global + counts.type0 + counts.type1
  let base: GbinElement | undefined
  if (elementCount > 0) {
    base = readElement(r, version)
    if (version < V72) {
      r.skip(checkCount('base', base.faceCount) * 3 * 4) // cor por vértice da base
    } else {
      const maps = r.u32()
      for (let i = 0; i < maps; i++) {
        r.lengthString()
        const faces = checkCount('map_color_vtx', r.u32())
        for (let f = 0; f < faces; f++) r.skip(checkCount('map_color_vtx', r.u32()) * 4)
      }
    }
  }

  const elements = Array.from({ length: elementCount }, () => readElement(r, version))

  const newElements = Array.from({ length: counts.newElement }, (): GbinNewElement => {
    r.skip(8)
    const name = str(r, 64)
    const matrix = r.f32n(12)
    r.skip(12 * 4)
    return { name, matrix, type: r.u32() }
  })

  let mapCheck: GbinMapCheck | undefined
  if (elementCount > 0 && r.remaining > 0) {
    mapCheck = { par: r.u8() }
    if (version < V72 && r.remaining >= 16 * 4) {
      const xz = (): [number, number] => [r.f32(), r.f32()]
      mapCheck.tees = [xz(), xz()]
      mapCheck.pins = [
        [xz(), xz(), xz()],
        [xz(), xz(), xz()],
      ]
    }
  }

  return {
    version,
    cameras,
    lights,
    soundBoxes,
    textures,
    nodes,
    base,
    elements,
    newElements,
    mapCheck,
  }
}

/** Pontos de tee e pin do buraco (luzes especiais e "new elements"). */
export function holePoints(gbin: Gbin) {
  const pos = (m: Mat4x3): [number, number, number] => [m[9]!, m[10]!, m[11]!]
  return {
    tees: [
      ...gbin.lights.filter((l) => l.special === 'tee').map((l) => l.position),
      ...gbin.newElements.filter((e) => e.type === 2).map((e) => pos(e.matrix)),
    ],
    pins: [
      ...gbin.lights.filter((l) => l.special === 'pin').map((l) => l.position),
      ...gbin.newElements.filter((e) => e.type === 1).map((e) => pos(e.matrix)),
    ],
  }
}

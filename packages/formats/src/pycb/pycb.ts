// Caixas de colisão de objetos de um buraco: map/_coll/<prefixo>_NN.pycb.
// Formato deduzido dos arquivos do Blue Lagoon (verificado: tamanho = 24 + n × 132 em todos
// os 18 buracos, e as caixas coincidem com os blocos COLL dos .pet de cada objeto já
// transformados pela matriz do .gbin):
//
//   "PYCB" | u32 versão (1) | f32 x, y, z (desconhecido; parece uma posição de referência)
//   u32 n | n × { nome[32] | u32 flag | 8 cantos × (f32 x, y, z) }
//
// Bit 0 do flag: 0 = caixa do objeto inteiro (abre um grupo), 1 = sub-caixa do objeto
// anterior (blocos COLL). Os bits 8–9 aparecem em poucos objetos (significado desconhecido).
// Cantos em coordenadas de mundo do Pangya: 0–3 embaixo (x-, x+/z-, x+/z+, x-/z+), 4–7 em cima.

import { BinaryReader } from '../binary-reader.ts'
import { applyMat4x3, boneWorldMatrix, multiplyMat4x3, type Mat4x3, type Pet } from '../pet/pet.ts'

export type Vec3Tuple = [number, number, number]

export interface CollisionBox {
  name: string
  flag: number
  /** Modelo (.pet) a que a caixa pertence. */
  model: string
  corners: Vec3Tuple[]
}

export function readPycb(bytes: Uint8Array): CollisionBox[] {
  const r = new BinaryReader(bytes)
  if (new TextDecoder('latin1').decode(r.bytesN(4)) !== 'PYCB') {
    throw new Error('não é um .pycb (falta o magic PYCB)')
  }
  const version = r.u32()
  if (version !== 1) throw new Error(`versão de .pycb desconhecida: ${version}`)
  r.skip(12)
  const count = r.u32()
  if (24 + count * 132 > bytes.byteLength) throw new Error(`.pycb truncado (${count} caixas)`)
  const boxes: CollisionBox[] = []
  let model = ''
  for (let i = 0; i < count; i++) {
    const name = r.fixedString(32, 'euc-kr')
    const flag = r.u32()
    const corners = Array.from({ length: 8 }, (): Vec3Tuple => [r.f32(), r.f32(), r.f32()])
    if ((flag & 1) === 0) model = name
    boxes.push({ name, flag, model, corners })
  }
  return boxes
}

/** Caixas de efeitos (luz de dia/noite, brilho de janela) que não bloqueiam a bola. */
const EFFECT_BOX = /^(day|night|window_glow|lamp_day)/i

/**
 * Caixas que a bola deve tratar como sólidas: as sub-caixas (blocos COLL) de cada objeto,
 * sem as de efeito e sem as degeneradas (alguns modelos usam ±99999 como "infinito").
 */
export function solidBoxes(boxes: CollisionBox[]): CollisionBox[] {
  return boxes.filter((box) => {
    if ((box.flag & 1) === 0 || EFFECT_BOX.test(box.name)) return false
    const xs = box.corners.map((c) => c[0])
    const ys = box.corners.map((c) => c[1])
    const zs = box.corners.map((c) => c[2])
    const extent = (v: number[]) => Math.max(...v) - Math.min(...v)
    const sizes = [extent(xs), extent(ys), extent(zs)]
    return sizes.every((s) => s < 2000) && sizes.filter((s) => s > 0.01).length === 3
  })
}

/**
 * Plano B quando o buraco não tem .pycb: gera as mesmas caixas a partir dos blocos COLL
 * dos modelos, transformados pela matriz de cada instância.
 */
export function boxesFromModels(
  instances: { model: string; matrix: Mat4x3 }[],
  pets: Map<string, Pet>,
): CollisionBox[] {
  const boxes: CollisionBox[] = []
  for (const { model, matrix } of instances) {
    const pet = pets.get(model)
    if (!pet) continue
    for (const c of pet.collisions) {
      // A caixa é relativa ao osso indicado (boneName); sem osso, ao modelo.
      const bone = pet.bones.findIndex((b) => b.name === c.boneName)
      const world = bone >= 0 ? multiplyMat4x3(matrix, boneWorldMatrix(pet, bone)) : matrix
      const [x0, y0, z0] = c.min
      const [x1, y1, z1] = c.max
      const local: Vec3Tuple[] = [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
      ]
      boxes.push({
        name: c.boxName,
        flag: 1,
        model,
        corners: local.map(([x, y, z]) => applyMat4x3(world, x, y, z) as Vec3Tuple),
      })
    }
  }
  return boxes
}

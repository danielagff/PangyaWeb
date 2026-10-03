/**
 * Personagem de teste sintético (`pnpm assets:teste`): esqueleto, animações, peças e taco
 * gerados do zero, para testar personagens, mapeador e swing sem os arquivos do jogo
 * (na nuvem, por exemplo). Fica em assets/original/data/avatar/teste/ (fora do git).
 *
 * Boneco de caixas com ~6 unidades de altura: rosto com textura pelo bloco FANM
 * (t_fc_01_!fc), acessório de rosto (t_fc_a_z01), cabelo, camisa, calça, sapato, mãos
 * (t_hn_01 e t_hn_28) e um taco preso ao Bone01. Movimentos com os nomes coreanos reais
 * (CP949): 우드샷준비, 우드샷파워준비, 우드샷, 기본자세 e mais alguns (resultado, chat…) para o
 * catálogo de animações.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deflateSync } from 'node:zlib'
import { Writer } from '@pangya/formats'
import { convertedDir, originalDir } from './config.ts'

type V3 = [number, number, number]

/** Ossos: nome, pai, posição local (sem rotação). */
const BONES: [string, number, V3][] = [
  ['Bip01', -1, [0, 0, 0]],
  ['Bip01 Pelvis', 0, [0, 3, 0]],
  ['Bip01 Spine', 1, [0, 0.4, 0]],
  ['Bip01 Head', 2, [0, 1.6, 0]],
  ['Bip01 R Hand', 2, [-0.7, 1.3, 0]],
  ['Bip01 L Arm', 2, [0.7, 1.3, 0]],
  ['Bip01 R Leg', 1, [-0.35, 0, 0]],
  ['Bip01 L Leg', 1, [0.35, 0, 0]],
  ['Bone01', 4, [0, -1.8, 0]],
]

/** Nomes coreanos em CP949 (o .apet grava assim). */
const CP949: Record<string, number[]> = {
  우드샷준비: [191, 236, 181, 229, 188, 166, 193, 216, 186, 241],
  우드샷디폴트: [191, 236, 181, 229, 188, 166, 181, 240, 198, 250, 198, 174],
  우드샷파워준비: [191, 236, 181, 229, 188, 166, 198, 196, 191, 246, 193, 216, 186, 241],
  우드샷파워준비끝: [
    191, 236, 181, 229, 188, 166, 198, 196, 191, 246, 193, 216, 186, 241, 179, 161,
  ],
  우드샷: [191, 236, 181, 229, 188, 166],
  우드샷끝: [191, 236, 181, 229, 188, 166, 179, 161],
  기본자세: [177, 226, 186, 187, 192, 218, 188, 188],
  // Mais nomes reais, para o catálogo de animações do mapeador ter o que mostrar.
  아이언샷: [190, 198, 192, 204, 190, 240, 188, 166],
  퍼팅샷: [198, 219, 198, 195, 188, 166],
  우드샷게걸음: [191, 236, 181, 229, 188, 166, 176, 212, 176, 201, 192, 189],
  버디승리포즈: [185, 246, 181, 240, 189, 194, 184, 174, 198, 247, 193, 238],
  퍼팅성공: [198, 219, 198, 195, 188, 186, 176, 248],
  chat_박수: [99, 104, 97, 116, 95, 185, 218, 188, 246],
  chat_댄스: [99, 104, 97, 116, 95, 180, 237, 189, 186],
  '1등모션': [49, 181, 238, 184, 240, 188, 199],
}

const version = () => new Writer().u8(2).u8(1).u16(0) // 1.2

function boneBlock(withMatrix: boolean) {
  const w = new Writer().u8(BONES.length)
  for (const [name, parent, [x, y, z]] of BONES) {
    w.cstr(name).u8(parent < 0 ? 0xff : parent)
    if (withMatrix) w.f32(1, 0, 0, 0, 1, 0, 0, 0, 1, x, y, z)
  }
  return w
}

const textBlock = (texture: string) =>
  new Writer().u32(1).fixed(texture, 32).u8(0).u8(0).u16(0).u32(0xffffffff).u32(0)

const QUADS = [
  [0, 1, 2, 3],
  [4, 7, 6, 5],
  [0, 4, 5, 1],
  [1, 5, 6, 2],
  [2, 6, 7, 3],
  [3, 7, 4, 0],
]

/** Caixa entre a e b (espaço do osso); pesos por altura: [osso, peso 0..255][]. */
function boxMesh(a: V3, b: V3, weightsOf: (y: number) => [number, number][]) {
  const corners: V3[] = []
  for (const y of [a[1], b[1]]) {
    for (const [x, z] of [
      [a[0], a[2]],
      [b[0], a[2]],
      [b[0], b[2]],
      [a[0], b[2]],
    ] as [number, number][]) {
      corners.push([x, y, z])
    }
  }
  const mesh = new Writer().u8(0).u32(8)
  for (const [x, y, z] of corners) {
    mesh.f32(x, y, z).f32(1)
    const weights = weightsOf(y)
    for (const [bone, weight] of weights) mesh.u8(weight).u8(bone)
    if (weights.length < 2) mesh.u16(0)
  }
  mesh.u32(12)
  for (const [p, q, r, s] of QUADS) {
    for (const tri of [
      [p!, q!, r!],
      [p!, r!, s!],
    ]) {
      for (const i of tri)
        mesh
          .u32(i)
          .f32(0, 1, 0)
          .u8(1)
          .f32(i % 2, i > 3 ? 1 : 0)
    }
  }
  for (let i = 0; i < 12; i++) mesh.u8(0)
  return mesh
}

/** PNG RGB xadrez simples (as "texturas" do boneco). */
function png(width: number, height: number, rgb: V3) {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (bytes: Buffer) => {
    let c = 0xffffffff
    for (const x of bytes) c = table[(c ^ x) & 255]! ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const sum = Buffer.alloc(4)
    sum.writeUInt32BE(crc(body))
    return Buffer.concat([length, body, sum])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const shade = (x + y) % 2 ? 1 : 0.85
      raw.set(
        rgb.map((c) => c * shade),
        y * (width * 3 + 1) + 1 + x * 3,
      )
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

export function installTestCharacter(log: (msg: string) => void = console.log) {
  const out = resolve(originalDir, 'data/avatar/teste')
  mkdirSync(out, { recursive: true })
  const write = (file: string, bytes: Uint8Array) => writeFileSync(resolve(out, file), bytes)

  const part = (file: string, texture: string, mesh: Writer, face?: string) => {
    const w = new Writer()
      .block('VERS', version())
      .block('TEXT', textBlock(texture))
      .block('BONE', boneBlock(true))
      .block('MESH', mesh)
    // Rosto: o material "face" usa a imagem da expressão (bloco FANM).
    if (face) w.block('FANM', new Writer().u32(1).u8(0).fixed(face, 32).fixed(texture, 32))
    write(file, w.done())
  }
  const head = boxMesh([-0.45, 0, -0.45], [0.45, 1.0, 0.45], () => [[3, 255]])
  part('t_fc_01_!fc.mpet', 'face', head, 't_rosto.png')
  part(
    't_fc_a_z01.mpet',
    't_pele.jpg',
    boxMesh([-0.5, 0.8, -0.5], [0.5, 1.1, 0.5], () => [[3, 255]]),
  )
  part(
    't_ha_01.mpet',
    't_pele.jpg',
    boxMesh([-0.2, -1.8, -0.2], [0.2, 0, 0.2], () => [[5, 255]]),
  )
  part(
    't_ts_01.mpet',
    't_camisa.jpg',
    boxMesh([-0.6, -0.4, -0.35], [0.6, 1.6, 0.35], (y) =>
      y < 0
        ? [
            [2, 128],
            [1, 127],
          ]
        : [[2, 255]],
    ),
  )
  const hand = boxMesh([-0.2, -1.8, -0.2], [0.2, 0, 0.2], () => [[4, 255]])
  part('t_hn_01.mpet', 't_pele.jpg', hand)
  part('t_hn_28.mpet', 't_pele.jpg', hand)
  part(
    't_pv_01.mpet',
    't_calca.jpg',
    boxMesh([-0.25, -3, -0.25], [0.25, 0, 0.25], () => [[6, 255]]),
  )
  part(
    't_ft_01.mpet',
    't_calca.jpg',
    boxMesh([-0.25, -3, -0.25], [0.25, 0, 0.25], () => [[7, 255]]),
  )
  write('t_def.bpet', new Writer().block('VERS', version()).block('BONE', boneBlock(true)).done())

  // Animação a 30 quadros/s: parado 0–30, tacada 31–90 (topo do backswing no 55).
  // Rotação gravada INVERTIDA (x, y, z, w), como no jogo.
  const anim = new Writer()
  const rotY = (deg: number) => {
    const h = (deg * Math.PI) / 360
    return [0, -Math.sin(h), 0, Math.cos(h)]
  }
  const rotZ = (deg: number) => {
    const h = (deg * Math.PI) / 360
    return [0, 0, -Math.sin(h), Math.cos(h)]
  }
  const track = (bone: number, keys: [number, number[]][]) => {
    anim.u8(bone)
    anim.u32(1).f32(0, ...BONES[bone]![2])
    anim.u32(keys.length)
    for (const [frame, q] of keys) anim.f32(frame / 30, ...q)
    anim.u32(0)
  }
  track(1, [
    [0, rotY(0)],
    [31, rotY(0)],
    [55, rotY(-70)],
    [70, rotY(80)],
    [90, rotY(0)],
  ])
  track(4, [
    [0, rotZ(-5)],
    [15, rotZ(-12)],
    [30, rotZ(-5)],
    [31, rotZ(-10)],
    [55, rotZ(-120)],
    [70, rotZ(-40)],
    [90, rotZ(-10)],
  ])
  track(5, [
    [0, rotZ(5)],
    [15, rotZ(12)],
    [30, rotZ(5)],
    [31, rotZ(10)],
    [55, rotZ(60)],
    [70, rotZ(120)],
    [90, rotZ(10)],
  ])
  anim.u8(0xff)
  const korean = (w: Writer, text: string) => {
    const bytes = CP949[text]!
    return w
      .u32(bytes.length + 1)
      .bytes(bytes)
      .u8(0)
  }
  const list: [string, number, number, string][] = [
    ['우드샷준비', 0, 30, '우드샷디폴트'],
    ['우드샷파워준비', 31, 55, '우드샷파워준비끝'],
    ['우드샷', 31, 90, '우드샷끝'],
    ['기본자세', 0, 30, '기본자세'],
    // Os outros reaproveitam trechos da mesma animação (só os nomes importam aqui).
    ['아이언샷', 31, 90, '기본자세'],
    ['퍼팅샷', 31, 60, '기본자세'],
    ['우드샷게걸음', 0, 30, '우드샷게걸음'],
    ['버디승리포즈', 40, 90, '기본자세'],
    ['퍼팅성공', 0, 45, '기본자세'],
    ['chat_박수', 0, 15, 'chat_박수'],
    ['chat_댄스', 0, 90, 'chat_댄스'],
    ['1등모션', 55, 90, '기본자세'],
  ]
  const motions = new Writer().u32(list.length)
  for (const [name, start, end, next] of list) {
    korean(motions, name).u32(start).u32(end)
    korean(motions, next).lstr('').f32(0).lstr('Bip01')
  }
  write(
    't_def.apet',
    new Writer()
      .block('VERS', version())
      .block('BONE', boneBlock(false))
      .block('ANIM', anim)
      .block('MOTI', motions)
      .done(),
  )

  write('t_rosto.png', png(8, 8, [250, 230, 40]))
  write('t_pele.jpg', png(8, 8, [240, 200, 160]))
  write('t_camisa.jpg', png(8, 8, [220, 60, 60]))
  write('t_calca.jpg', png(8, 8, [50, 70, 160]))

  // Taco: .pet de um osso, pendurado no Bone01; e a tabela de tacos convertida.
  const stick = new Writer().u32(8)
  for (const y of [0, -2.8]) {
    for (const [x, z] of [
      [-0.05, -0.05],
      [0.05, -0.05],
      [0.05, 0.05],
      [-0.05, 0.05],
    ] as [number, number][]) {
      stick.f32(x, y, z).u8(255).u8(0).u16(0)
    }
  }
  stick.u32(12)
  for (const [p, q, r, s] of QUADS) {
    for (const tri of [
      [p!, q!, r!],
      [p!, r!, s!],
    ]) {
      for (const i of tri) stick.u32(i).f32(0, 1, 0).u8(1).f32(0, 0)
    }
  }
  for (let i = 0; i < 12; i++) stick.u8(0)
  const clubBone = new Writer().u8(1).cstr('club').u8(0xff).f32(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
  write(
    't_club01.pet',
    new Writer()
      .block('VERS', version())
      .block('TEXT', textBlock('t_calca.jpg'))
      .block('BONE', clubBone)
      .block('MESH', stick)
      .done(),
  )
  // Só sem a tabela real (no PC com o jogo extraído, clubs.json já existe e fica intacto).
  const data = resolve(convertedDir, 'data')
  mkdirSync(data, { recursive: true })
  const clubs = resolve(data, 'clubs.json')
  if (!existsSync(clubs))
    writeFileSync(
      clubs,
      JSON.stringify([
        { name: 'Taco teste', model: 't_club01', kind: 'wood' },
        { name: 'Putter teste', model: 't_club01', kind: 'putter' },
      ]),
    )
  log(`personagem de teste em ${out}`)
}

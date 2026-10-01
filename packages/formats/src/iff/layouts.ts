// Layouts dos registros .iff (cliente JP, temporada R7 ~962–995).
// Portado de SuperSS-Dev (https://github.com/Acrisio-Filho/SuperSS-Dev),
// "Server Lib/Projeto IOCP/TYPE/data_iff.h"
// Copyright (c) 2021 Acrisio Fragoso Vieira Filho — Licença MIT

import { array, f32, i32, pad, str, struct, u16, u32, u8, type CodecValue } from '../codec.ts'

/** Atributos na ordem do jogo: power, control, accuracy (impact), spin, curve. */
const stats = array(u16, 5)

/** Campos comuns a quase todas as tabelas (192 bytes). */
const base = {
  active: u32,
  typeId: u32,
  name: str(64),
  level: u8, // bits 0–6 nível, bit 7 = nível máximo
  icon: str(43),
  // Loja
  price: u32,
  salePrice: u32,
  sellPrice: u32,
  shopFlags: u16,
  timeShop: array(u8, 2), // [ativo, dias]
  tiki: pad(24),
  dateActive: u32,
  dates: pad(32), // 2× SYSTEMTIME (início, fim)
}

export const characterLayout = struct({
  ...base,
  model: str(40),
  hairTexture: str(40),
  shirtTexture: str(40),
  faceTexture: str(40),
  stats,
  partCount: u8,
  accessoryCount: u8,
  clubType: u32,
  clubScale: f32,
  statLimits: array(u8, 5),
  tourneyWinnerMotion: str(43),
})

/** 0 madeira, 1 ferro, 2 wedge (SW), 3 putter. */
export const clubLayout = struct({
  ...base,
  model: str(40),
  kind: u16,
  stats,
})

export const clubSetLayout = struct({
  ...base,
  clubs: array(u32, 4), // typeIds em Club.iff: madeira, ferro, wedge, putter
  stats,
  slots: array(u16, 5),
  workshopType: i32,
  workshopRankSStat: u32,
  workshopRecovery: u32,
  workshopMasteryRate: f32,
  workshopRankSType: u32,
  workshopCanTransform: u32,
  unknown: u32,
  pangyaTextId: u32,
})

export const ballLayout = struct({
  ...base,
  consumable: u32, // 0 consumível, 1 permanente
  model: str(40),
  bound: u32,
  roll: u32,
  fx: array(str(40), 7),
  fxBone: array(str(40), 7),
  stats,
  point: u16,
})

export const courseLayout = struct({
  ...base,
  model: str(40),
  ambientSound: str(40),
  star: u8, // bits 0–3 dificuldade (estrelas), bits 4–7 flag
  textureProps: str(43),
  pangRate: f32,
  skyFx: str(40),
  bonusNormal: array(u32, 6), // hio, albatross, eagle, birdie, par, overpar
  bonusNatural: array(u32, 6),
  par: array(u8, 18),
  minScore: array(u8, 18),
  maxScore: array(u8, 18),
  unknown: u16,
})

export type CharacterRecord = CodecValue<typeof characterLayout>
export type ClubRecord = CodecValue<typeof clubLayout>
export type ClubSetRecord = CodecValue<typeof clubSetLayout>
export type BallRecord = CodecValue<typeof ballLayout>
export type CourseRecord = CodecValue<typeof courseLayout>

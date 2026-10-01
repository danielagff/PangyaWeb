import type { Codec } from '../codec.ts'
import {
  ballLayout,
  characterLayout,
  clubLayout,
  clubSetLayout,
  courseLayout,
  type BallRecord,
  type CharacterRecord,
  type ClubRecord,
  type ClubSetRecord,
  type CourseRecord,
} from './layouts.ts'
import { parseIffTable, readIffArchive } from './table.ts'

/** Atributos de tacada, na ordem usada pelo jogo. */
export interface Stats {
  power: number
  control: number
  accuracy: number
  spin: number
  curve: number
}

export type ClubKind = 'wood' | 'iron' | 'wedge' | 'putter'

export interface CharacterData {
  id: number
  name: string
  active: boolean
  model: string
  textures: { hair: string; shirt: string; face: string }
  stats: Stats
  statLimits: number[]
  clubScale: number
}

export interface ClubData {
  id: number
  name: string
  model: string
  kind: ClubKind
  stats: Stats
}

export interface ClubSetData {
  id: number
  name: string
  active: boolean
  icon: string
  clubIds: number[]
  stats: Stats
  slots: Stats
}

export interface BallData {
  id: number
  name: string
  active: boolean
  model: string
  consumable: boolean
  stats: Stats
}

export interface CourseData {
  id: number
  name: string
  active: boolean
  model: string
  stars: number
  pangRate: number
  holes: { par: number; minScore: number; maxScore: number }[]
}

export interface GameData {
  version: number
  characters: CharacterData[]
  clubs: ClubData[]
  clubSets: ClubSetData[]
  balls: BallData[]
  courses: CourseData[]
}

const toStats = ([power = 0, control = 0, accuracy = 0, spin = 0, curve = 0]: number[]): Stats => ({
  power,
  control,
  accuracy,
  spin,
  curve,
})

const CLUB_KINDS: ClubKind[] = ['wood', 'iron', 'wedge', 'putter']

export const toCharacter = (r: CharacterRecord): CharacterData => ({
  id: r.typeId,
  name: r.name,
  active: r.active !== 0,
  model: r.model,
  textures: { hair: r.hairTexture, shirt: r.shirtTexture, face: r.faceTexture },
  stats: toStats(r.stats),
  statLimits: r.statLimits,
  clubScale: r.clubScale,
})

export const toClub = (r: ClubRecord): ClubData => ({
  id: r.typeId,
  name: r.name,
  model: r.model,
  kind: CLUB_KINDS[r.kind] ?? 'iron',
  stats: toStats(r.stats),
})

export const toClubSet = (r: ClubSetRecord): ClubSetData => ({
  id: r.typeId,
  name: r.name,
  active: r.active !== 0,
  icon: r.icon,
  clubIds: r.clubs,
  stats: toStats(r.stats),
  slots: toStats(r.slots),
})

export const toBall = (r: BallRecord): BallData => ({
  id: r.typeId,
  name: r.name,
  active: r.active !== 0,
  model: r.model,
  consumable: r.consumable === 0,
  stats: toStats(r.stats),
})

export const toCourse = (r: CourseRecord): CourseData => ({
  id: r.typeId,
  name: r.name,
  active: r.active !== 0,
  model: r.model,
  stars: r.star & 0x0f,
  pangRate: r.pangRate,
  holes: r.par.map((par, i) => ({
    par,
    minScore: r.minScore[i] ?? 0,
    maxScore: r.maxScore[i] ?? 0,
  })),
})

/** Converte o pangya_<região>.iff (zip) nas tabelas usadas pelo jogo. */
export function readGameData(zipBytes: Uint8Array): GameData {
  const files = readIffArchive(zipBytes)
  let version = 0

  const table = <R, T>(file: string, layout: Codec<R>, map: (r: R) => T): T[] => {
    const bytes = files.get(file)
    if (!bytes) throw new Error(`${file} não encontrado no arquivo .iff`)
    const parsed = parseIffTable(bytes, layout, file)
    version = parsed.version
    return parsed.records.map(map)
  }

  return {
    characters: table('Character.iff', characterLayout, toCharacter),
    clubs: table('Club.iff', clubLayout, toClub),
    clubSets: table('ClubSet.iff', clubSetLayout, toClubSet),
    balls: table('Ball.iff', ballLayout, toBall),
    courses: table('Course.iff', courseLayout, toCourse),
    version,
  }
}

/**
 * Conjuntos de tacos do jogo: ClubSet.iff (clubSets.json) com os 4 tacos de cada um
 * (Club.iff → clubs.json: madeira, ferro, wedge, putter), o ícone da loja
 * (data/ui/shop_myroom/clubs/<ícone>.tga) e os atributos. A força total do jogador é a do
 * personagem (Character.iff) mais a dos tacos, como no jogo; os outros atributos (controle,
 * precisão, spin, curva) ainda não entram na física. A escolha fica no navegador.
 */
import { readTga } from '@pangya/formats'
import type { ClubCategory } from '../character/motions.ts'
import { findAsset, tryFetchBytes } from '../hole/assets.ts'

export interface Stats {
  power: number
  control: number
  accuracy: number
  spin: number
  curve: number
}

export interface ClubSetEntry {
  id: number
  name: string
  label: string
  icon: string
  stats: Stats
  /** Arquivo do modelo de cada taco (achado na extração), por categoria. */
  models: Partial<Record<ClubCategory, string>>
}

interface ClubRow {
  id: number
  name?: string
  model?: string
  kind?: string | number
}

const KIND_NUMBER: Record<number, ClubCategory> = { 0: 'wood', 1: 'iron', 2: 'wedge', 3: 'putter' }

/** Palavras dos nomes do cliente japonês (o resto fica como no jogo). */
const WORDS: [string, string][] = [
  ['セット', ''],
  ['エアーナイト', 'Air Knight'],
  ['アフターバーナー', 'Afterburner'],
  ['クラシック', 'Clássico'],
  ['プレミアム', 'Premium'],
  ['ゴールド', 'Gold'],
  ['シルバー', 'Silver'],
  ['ブラック', 'Black'],
  ['ホワイト', 'White'],
  ['レッド', 'Red'],
  ['ブルー', 'Blue'],
  ['ピンク', 'Pink'],
  ['グリーン', 'Green'],
  ['ドラゴン', 'Dragon'],
  ['ウィング', 'Wing'],
  ['エンジェル', 'Angel'],
  ['デビル', 'Devil'],
]

export function clubSetLabel(name: string) {
  let label = name
  for (const [jp, pt] of WORDS) label = label.split(jp).join(pt ? ` ${pt} ` : ' ')
  return label.replace(/\s+/g, ' ').trim() || name
}

const json = <T>(file: string) =>
  fetch(`/game-assets/converted/data/${file}`, { cache: 'no-cache' })
    .then((r) => (r.ok ? (r.json() as Promise<T>) : undefined))
    .catch(() => undefined)

let list: Promise<ClubSetEntry[]> | undefined

/** Conjuntos com os tacos na extração (pelo menos a madeira), na ordem do jogo. */
export function loadClubSets(): Promise<ClubSetEntry[]> {
  list ??= (async () => {
    const [sets, clubs] = await Promise.all([
      json<{ id: number; name: string; icon: string; clubIds: number[]; stats: Stats }[]>(
        'clubSets.json',
      ),
      json<ClubRow[]>('clubs.json'),
    ])
    if (!sets || !clubs) return []
    const byId = new Map(clubs.map((c) => [c.id, c]))
    const out: ClubSetEntry[] = []
    for (const set of sets) {
      const models: Partial<Record<ClubCategory, string>> = {}
      for (const id of set.clubIds) {
        const club = byId.get(id)
        if (!club?.model) continue
        const kind =
          typeof club.kind === 'number' ? KIND_NUMBER[club.kind] : (club.kind as ClubCategory)
        if (!kind || models[kind]) continue
        for (const name of [`${club.model}.mpet`, `${club.model}.pet`]) {
          const found = await findAsset(name, '')
          if (found) {
            models[kind] = found
            break
          }
        }
      }
      if (!models.wood) continue
      out.push({
        id: set.id,
        name: set.name,
        label: clubSetLabel(set.name),
        icon: set.icon,
        stats: set.stats,
        models,
      })
    }
    return out
  })()
  return list
}

const CHOICE_KEY = 'pangyaweb.tacos'

/** Conjunto escolhido neste navegador (ou o primeiro da tabela). */
export async function chosenClubSet(): Promise<ClubSetEntry | undefined> {
  const sets = await loadClubSets()
  let saved: string | null = null
  try {
    saved = localStorage.getItem(CHOICE_KEY)
  } catch {
    // sem armazenamento
  }
  return sets.find((s) => String(s.id) === saved) ?? sets[0]
}

export function rememberClubSet(id: number) {
  try {
    localStorage.setItem(CHOICE_KEY, String(id))
  } catch {
    // sem armazenamento: só não lembra
  }
}

let characterStats: Promise<Map<string, Stats>> | undefined

/** Atributos de base do personagem (Character.iff), pelo arquivo do esqueleto (a_def…). */
export async function characterBaseStats(skeleton: string): Promise<Stats | undefined> {
  characterStats ??= json<{ model: string; stats: Stats }[]>('characters.json').then(
    (rows) => new Map((rows ?? []).map((r) => [r.model.toLowerCase(), r.stats])),
  )
  const base = skeleton
    .split('/')
    .pop()!
    .replace(/\.bpet$/i, '')
    .toLowerCase()
  return (await characterStats).get(base)
}

const icons = new Map<string, Promise<string | undefined>>()

/** Ícone da loja (TGA do jogo) como endereço de imagem para a tela. */
export function clubSetIcon(icon: string): Promise<string | undefined> {
  let url = icons.get(icon)
  if (!url) {
    url = (async () => {
      const path = await findAsset(`${icon}.tga`, '')
      const bytes = path && (await tryFetchBytes(path))
      if (!bytes) return undefined
      const image = readTga(bytes)
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')!
      context.putImageData(
        new ImageData(new Uint8ClampedArray(image.rgba), image.width, image.height),
        0,
        0,
      )
      return canvas.toDataURL()
    })().catch(() => undefined)
    icons.set(icon, url)
  }
  return url
}

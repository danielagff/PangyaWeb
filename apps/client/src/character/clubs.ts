/**
 * Modelos de taco: a tabela Club.iff convertida pelo pipeline
 * (assets/converted/data/clubs.json, campo `model`) e o arquivo achado pelo índice.
 * Tipo do registro: 0 madeira, 1 ferro, 2 wedge, 3 putter.
 */
import { chosenClubSet } from '../equipment/clubsets.ts'
import { findAsset } from '../hole/assets.ts'

import type { ClubCategory } from './motions.ts'

export type { ClubCategory }

const KIND: Record<ClubCategory, number> = { wood: 0, iron: 1, wedge: 2, putter: 3 }

let table: Promise<{ name?: string; model?: string; kind?: number | string }[]> | undefined
const chosen = new Map<ClubCategory, Promise<string | undefined>>()

/** Categoria pelo id do taco da física (1W, 5I, PW, PT1…). */
export const categoryOfClub = (club: string): ClubCategory =>
  club.startsWith('PT')
    ? 'putter'
    : club.endsWith('W')
      ? 'wood'
      : /^(PW|SW)$/.test(club)
        ? 'wedge'
        : 'iron'

/** Caminho do modelo de taco dessa categoria (do conjunto escolhido ou o primeiro que existe). */
export function clubModelFor(category: ClubCategory): Promise<string | undefined> {
  let path = chosen.get(category)
  if (!path) {
    // O taco do conjunto escolhido na tela do personagem; sem ele, o primeiro da tabela.
    path = chosenClubSet().then((set) => set?.models[category] ?? firstModel(category))
    chosen.set(category, path)
  }
  return path
}

function firstModel(category: ClubCategory): Promise<string | undefined> {
  table ??= fetch('/game-assets/converted/data/clubs.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
  return table.then(async (clubs) => {
    for (const club of clubs) {
      // O pipeline grava o tipo como texto ("wood"); versões antigas, como número.
      if ((club.kind !== KIND[category] && club.kind !== category) || !club.model) continue
      const model = club.model
      for (const name of [`${model}.mpet`, `${model}.pet`, model]) {
        const found = await findAsset(name, '')
        if (found) {
          console.info(`taco (${category}): ${club.name ?? ''} → ${found}`)
          return found
        }
      }
    }
    return undefined
  })
}

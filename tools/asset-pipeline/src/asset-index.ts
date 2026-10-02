import { readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { buildCharacterCatalog } from './characters.ts'

export const INDEX_FILE = '_index.json'
export const CHARACTERS_FILE = '_characters.json'

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else yield path
  }
}

/**
 * Índice nome-do-arquivo (minúsculo) → caminho relativo, para achar modelos e texturas
 * referenciados só pelo nome. Nomes repetidos (ex.: grass10.dds em vários cursos) viram
 * uma lista ordenada do caminho mais curto ao mais longo; o cliente prefere o da pasta
 * do curso e, sem ela, o mais curto (mesmo critério do GhostMapEditor).
 */
export function buildAssetIndex(root: string): Record<string, string | string[]> {
  const all = new Map<string, string[]>()
  for (const path of walk(root)) {
    const rel = relative(root, path).replaceAll('\\', '/')
    if (rel.startsWith('_') || rel.startsWith('.')) continue
    const name = rel.split('/').pop()!.toLowerCase()
    all.set(name, [...(all.get(name) ?? []), rel])
  }
  const index: Record<string, string | string[]> = {}
  for (const [name, paths] of all) {
    paths.sort((a, b) => a.length - b.length || a.localeCompare(b))
    index[name] = paths.length === 1 ? paths[0]! : paths
  }
  return index
}

/** Grava o índice de nomes e o catálogo de personagens; devolve quantos nomes indexou. */
export function writeAssetIndex(root: string): number {
  const index = buildAssetIndex(root)
  writeFileSync(join(root, INDEX_FILE), JSON.stringify(index))
  const paths = Object.values(index).flat()
  const characters = buildCharacterCatalog(paths)
  writeFileSync(join(root, CHARACTERS_FILE), JSON.stringify(characters, null, 1))
  if (characters.length > 0) {
    console.log(
      `personagens: ${characters.map((c) => `${c.name} (${c.defaults.length} peças)`).join(', ')}`,
    )
  }
  return Object.keys(index).length
}

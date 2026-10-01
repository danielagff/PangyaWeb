import { readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

export const INDEX_FILE = '_index.json'

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else yield path
  }
}

/**
 * Índice nome-do-arquivo (minúsculo) → caminho relativo, para achar modelos e texturas
 * referenciados só pelo nome. Em caso de nome repetido vence o caminho mais curto
 * (mesmo critério do GhostMapEditor).
 */
export function buildAssetIndex(root: string): Record<string, string> {
  const index: Record<string, string> = {}
  for (const path of walk(root)) {
    const rel = relative(root, path).replaceAll('\\', '/')
    if (rel === INDEX_FILE || rel.startsWith('.')) continue
    const name = rel.split('/').pop()!.toLowerCase()
    const current = index[name]
    if (current === undefined || rel.length < current.length) index[name] = rel
  }
  return index
}

export function writeAssetIndex(root: string): number {
  const index = buildAssetIndex(root)
  writeFileSync(join(root, INDEX_FILE), JSON.stringify(index))
  return Object.keys(index).length
}

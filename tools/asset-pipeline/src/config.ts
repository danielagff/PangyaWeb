import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

export const repoRoot = resolve(import.meta.dirname, '../../..')
export const originalDir = resolve(repoRoot, 'assets/original')
export const convertedDir = resolve(repoRoot, 'assets/converted')

/** Pasta padrão do cliente: `cliente-jp` ao lado do repositório. */
export const defaultPangyaDir = resolve(repoRoot, '../cliente-jp')

const isDir = (dir: string) => existsSync(dir) && statSync(dir).isDirectory()

/**
 * Pasta do cliente original: PANGYA_DIR (ambiente ou .env) ou, se não definido,
 * `../cliente-jp` ao lado do repositório.
 */
export function resolvePangyaDir(
  env: NodeJS.ProcessEnv = process.env,
  fallback: string = defaultPangyaDir,
): string {
  const dir = env['PANGYA_DIR']?.trim()
  if (!dir) {
    if (isDir(fallback)) return fallback
    throw new Error(
      `Cliente não encontrado. Coloque-o em ${fallback} ou defina PANGYA_DIR no .env.`,
    )
  }
  if (!isDir(dir)) {
    throw new Error(`PANGYA_DIR aponta para uma pasta que não existe: ${dir}`)
  }
  return dir
}

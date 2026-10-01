import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

export const repoRoot = resolve(import.meta.dirname, '../../..')
export const originalDir = resolve(repoRoot, 'assets/original')
export const convertedDir = resolve(repoRoot, 'assets/converted')

/** Lê e valida PANGYA_DIR (do ambiente ou do .env na raiz do repositório). */
export function resolvePangyaDir(env: NodeJS.ProcessEnv = process.env): string {
  const dir = env['PANGYA_DIR']?.trim()
  if (!dir) {
    throw new Error(
      'PANGYA_DIR não definido. Copie .env.example para .env e aponte para a pasta do cliente.',
    )
  }
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`PANGYA_DIR aponta para uma pasta que não existe: ${dir}`)
  }
  return dir
}

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe } from 'vitest'

const repoRoot = resolve(import.meta.dirname, '../../..')

/**
 * Pasta do cliente original: PANGYA_DIR ou `../cliente-jp` ao lado do repositório.
 * Retorna undefined se nenhuma existir (CI, nuvem).
 */
export function pangyaDir(): string | undefined {
  const dir = process.env['PANGYA_DIR']?.trim() || resolve(repoRoot, '../cliente-jp')
  return existsSync(dir) ? dir : undefined
}

/**
 * Testes de integração que dependem dos assets reais do jogo.
 * São pulados automaticamente quando o cliente não está disponível.
 */
export function describeWithAssets(name: string, fn: (dir: string) => void): void {
  const dir = pangyaDir()
  if (dir) {
    describe(`[assets] ${name}`, () => fn(dir))
  } else {
    describe.skip(`[assets] ${name} (cliente não encontrado)`, () => {})
  }
}

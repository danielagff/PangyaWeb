import { describe } from 'vitest'

/** Caminho da instalação local do cliente, ou undefined se não configurado. */
export function pangyaDir(): string | undefined {
  const dir = process.env['PANGYA_DIR']?.trim()
  return dir ? dir : undefined
}

/**
 * Testes de integração que dependem dos assets reais do jogo.
 * São pulados automaticamente quando PANGYA_DIR não está definido (CI, nuvem).
 */
export function describeWithAssets(name: string, fn: (dir: string) => void): void {
  const dir = pangyaDir()
  if (dir) {
    describe(`[assets] ${name}`, () => fn(dir))
  } else {
    describe.skip(`[assets] ${name} (defina PANGYA_DIR para rodar)`, () => {})
  }
}

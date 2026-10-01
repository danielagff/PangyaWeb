import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['{packages,apps,tools}/*/src/**/*.test.ts'],
    // Carrega PANGYA_DIR do .env para os testes de integração com assets reais.
    env: loadEnv('test', process.cwd(), ''),
  },
})

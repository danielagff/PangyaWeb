import { execSync } from 'node:child_process'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

const assetsDir = resolve(import.meta.dirname, '../../assets')

const mimeTypes: Record<string, string> = {
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.xml': 'application/xml',
  '.dds': 'application/octet-stream',
}

/**
 * Serve a pasta assets/ (local, fora do git) em /game-assets/ durante o dev:
 * /game-assets/original/... (extraído dos .pak) e /game-assets/converted/....
 */
function gameAssets(): Plugin {
  return {
    name: 'pangya-game-assets',
    configureServer(server) {
      server.middlewares.use('/game-assets', (req, res) => {
        const path = normalize(join(assetsDir, decodeURIComponent((req.url ?? '/').split('?')[0]!)))
        if (!path.startsWith(assetsDir) || !existsSync(path) || !statSync(path).isFile()) {
          // 404 de verdade (sem cair na página do app), para o cliente tentar outro caminho.
          res.statusCode = 404
          res.end()
          return
        }
        res.setHeader('Content-Type', mimeTypes[extname(path)] ?? 'application/octet-stream')
        createReadStream(path).pipe(res)
      })
    },
  }
}

/** Versão mostrada no menu (commit e data), para saber se o PC está atualizado. */
function version() {
  try {
    return execSync('git log -1 --format="%h %cd" --date=format:"%d/%m %H:%M"').toString().trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  plugins: [gameAssets()],
  define: { __PANGYA_VERSION__: JSON.stringify(version()) },
  // No desenvolvimento, a sala multiplayer e a lista de cursos vêm do servidor da partida
  // (pnpm server, porta 7777).
  server: {
    proxy: {
      '/ws': { target: 'ws://localhost:7777', ws: true },
      '/api': 'http://localhost:7777',
    },
  },
  build: { chunkSizeWarningLimit: 1000 }, // three.js sozinho passa de 500 kB
})

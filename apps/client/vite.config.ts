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
      server.middlewares.use('/game-assets', (req, res, next) => {
        const path = normalize(join(assetsDir, decodeURIComponent((req.url ?? '/').split('?')[0]!)))
        if (!path.startsWith(assetsDir) || !existsSync(path) || !statSync(path).isFile()) {
          return next()
        }
        res.setHeader('Content-Type', mimeTypes[extname(path)] ?? 'application/octet-stream')
        createReadStream(path).pipe(res)
      })
    },
  }
}

export default defineConfig({
  plugins: [gameAssets()],
  build: { chunkSizeWarningLimit: 1000 }, // three.js sozinho passa de 500 kB
})

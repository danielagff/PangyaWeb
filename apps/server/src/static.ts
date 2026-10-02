import { createReadStream, existsSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, join } from 'node:path'
import { safeJoin } from './files.ts'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'text/xml; charset=utf-8',
}

/** Envia um arquivo de `root`; devolve false se não existir. */
export function sendFile(root: string, path: string, res: ServerResponse, cache = false): boolean {
  const full = safeJoin(root, path)
  if (!full || !existsSync(full) || !statSync(full).isFile()) return false
  res.writeHead(200, {
    'Content-Type': TYPES[extname(full).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': statSync(full).size,
    'Cache-Control': cache ? 'public, max-age=3600' : 'no-cache',
  })
  createReadStream(full).pipe(res)
  return true
}

/**
 * Rotas estáticas: /game-assets/* (pasta assets, só no PC do anfitrião) e o cliente
 * compilado (apps/client/dist), com a página inicial (index.html, ou a do mapeador) para
 * as demais rotas.
 */
export function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  dirs: { assets: string; client: string; page?: string },
): boolean {
  const url = new URL(req.url ?? '/', 'http://x')
  if (url.pathname.startsWith('/game-assets/')) {
    if (!sendFile(dirs.assets, url.pathname.slice('/game-assets/'.length), res, true)) {
      res.writeHead(404).end()
    }
    return true
  }
  if (!existsSync(dirs.client)) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Cliente não compilado: rode "pnpm build" (ou use servidor.cmd).')
    return true
  }
  const page = dirs.page ?? 'index.html'
  const path = url.pathname === '/' ? page : url.pathname
  return sendFile(dirs.client, path, res) || sendFile(dirs.client, join(page), res)
}

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

/**
 * Envia um arquivo de `root`; devolve false se não existir.
 *
 * Cache: o navegador sempre confere se o arquivo mudou (no-cache + Last-Modified/ETag),
 * então uma atualização (git pull, nova extração dos assets) aparece no próximo
 * carregamento, sem precisar limpar o cache; sem mudança, a resposta é um 304 vazio.
 * Só os arquivos do build com hash no nome (/assets/…-abc123.js) ficam guardados de vez.
 */
export function sendFile(
  root: string,
  path: string,
  req: IncomingMessage,
  res: ServerResponse,
  immutable = false,
): boolean {
  const full = safeJoin(root, path)
  if (!full || !existsSync(full)) return false
  const stat = statSync(full)
  if (!stat.isFile()) return false
  const etag = `"${stat.size.toString(36)}-${Math.floor(stat.mtimeMs).toString(36)}"`
  const headers = {
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'Last-Modified': stat.mtime.toUTCString(),
    ETag: etag,
  }
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers).end()
    return true
  }
  res.writeHead(200, {
    ...headers,
    'Content-Type': TYPES[extname(full).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': stat.size,
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
    if (!sendFile(dirs.assets, url.pathname.slice('/game-assets/'.length), req, res)) {
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
  const hashed = /^\/assets\/.+-[\w-]{6,}\.\w+$/.test(path)
  return (
    sendFile(dirs.client, path, req, res, hashed) || sendFile(dirs.client, join(page), req, res)
  )
}

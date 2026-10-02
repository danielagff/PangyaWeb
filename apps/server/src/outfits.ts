import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname } from 'node:path'

/**
 * Roupas padrão escolhidas no mapeador ("usar como roupa padrão"), por personagem:
 * { "data/avatar/h_kaz/h_def": ["data/avatar/h_kaz/h_fc_01_!fc.mpet", …] }.
 * Ficam em assets/converted/data/roupas-padrao.json (no PC, fora do git) e valem para o
 * jogo todo, inclusive para os amigos.
 */
export type Outfits = Record<string, string[]>

const PART = /^data\/avatar\/[^\\]+\.mpet$/i

export function readOutfits(file: string): Outfits {
  try {
    return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Outfits) : {}
  } catch {
    return {}
  }
}

/** Só o próprio PC pode gravar (não amigos na rede nem pelo link do cloudflared). */
function isLocal(req: IncomingMessage) {
  const address = req.socket.remoteAddress ?? ''
  const local = address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
  return local && !req.headers['cf-connecting-ip'] && !req.headers['x-forwarded-for']
}

/** GET devolve as roupas; POST {id, parts} grava (parts vazio = volta à regra automática). */
export function handleOutfits(req: IncomingMessage, res: ServerResponse, file: string) {
  const json = (status: number, body: unknown) =>
    res
      .writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
      })
      .end(JSON.stringify(body))
  if (req.method === 'GET') return json(200, readOutfits(file))
  if (req.method !== 'POST') return json(405, { error: 'método não suportado' })
  if (!isLocal(req)) return json(403, { error: 'só o PC do servidor pode mudar a roupa padrão' })
  let body = ''
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString('utf8')
    if (body.length > 64_000) req.destroy()
  })
  req.on('end', () => {
    let input: { id?: unknown; parts?: unknown }
    try {
      input = JSON.parse(body) as typeof input
    } catch {
      return json(400, { error: 'JSON inválido' })
    }
    const { id, parts } = input
    if (
      typeof id !== 'string' ||
      !id.startsWith('data/avatar/') ||
      !Array.isArray(parts) ||
      !parts.every((p) => typeof p === 'string' && PART.test(p) && !p.includes('..'))
    ) {
      return json(400, { error: 'dados inválidos' })
    }
    const outfits = readOutfits(file)
    if (parts.length) outfits[id] = parts as string[]
    else delete outfits[id]
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(outfits, null, 1))
    json(200, outfits)
  })
}

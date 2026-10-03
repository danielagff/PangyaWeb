import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import { resolve } from 'node:path'
import type { ClientMessage } from '@pangya/game'
import { WebSocketServer } from 'ws'
import { DiskFiles, listCourses } from './files.ts'
import { handleOutfits } from './outfits.ts'
import { Room } from './room.ts'
import { handleSoundChoices } from './sounds.ts'
import { serveStatic } from './static.ts'

/**
 * Servidor da partida: entrega o jogo (cliente compilado), os assets do PC do anfitrião
 * e a sala multiplayer em /ws. Os amigos só precisam do navegador.
 */
const repoRoot = resolve(import.meta.dirname, '../../..')
const port = Number(process.env['PORT'] ?? 7777)
/** PANGYA_PAGINA=mapeador.html: o mesmo servidor abrindo o mapeador de personagens. */
const page = process.env['PANGYA_PAGINA'] ?? 'index.html'
const dirs = {
  assets: resolve(repoRoot, 'assets'),
  client: resolve(repoRoot, 'apps/client/dist'),
  page,
}
const original = resolve(dirs.assets, 'original')
if (!existsSync(original)) {
  console.warn(`aviso: ${original} não existe — rode "pnpm assets:build" ou "pnpm assets:exemplo"`)
}

const files = new DiskFiles(original)
const room = new Room(files)

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }))
    return
  }
  if (url.pathname === '/api/courses') {
    res
      .writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      .end(JSON.stringify(listCourses(original)))
    return
  }
  if (url.pathname === '/api/roupas-padrao') {
    handleOutfits(req, res, resolve(dirs.assets, 'converted/data/roupas-padrao.json'))
    return
  }
  if (url.pathname === '/api/sons') {
    handleSoundChoices(req, res, resolve(dirs.assets, 'converted/data/sons.json'))
    return
  }
  serveStatic(req, res, dirs)
})

const wss = new WebSocketServer({ server, path: '/ws' })
wss.on('connection', (socket) => {
  const id = room.connect({ send: (message) => socket.send(JSON.stringify(message)) })
  socket.on('message', (data) => {
    let message: ClientMessage
    try {
      message = JSON.parse(String(data)) as ClientMessage
    } catch {
      return
    }
    void room.handle(id, message)
  })
  socket.on('close', () => room.disconnect(id))
})

server.listen(port, () => {
  const what = page === 'index.html' ? 'PangyaWeb' : 'Mapeador do PangyaWeb'
  console.log(`\n${what} rodando! Abra no navegador:`)
  console.log(`  neste PC:        http://localhost:${port}`)
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  na mesma rede:   http://${net.address}:${port}`)
      }
    }
  }
  console.log('')
})

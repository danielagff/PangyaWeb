import { createServer } from 'node:http'

/** Servidor mínimo; WebSocket, contas e salas chegam na spec 16. */
const port = Number(process.env['PORT'] ?? 7777)

createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }
  res.writeHead(404).end()
}).listen(port, () => console.log(`servidor ouvindo em http://localhost:${port}`))

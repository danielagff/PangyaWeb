import type { ClientMessage, ServerMessage } from '@pangya/game'

/** WebSocket com o servidor da partida (mesmo endereço da página). */
export function connect(onMessage: (message: ServerMessage) => void, onClose: () => void) {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  const socket = new WebSocket(`${protocol}://${location.host}/ws`)
  const queue: ClientMessage[] = []
  socket.addEventListener('open', () => {
    for (const message of queue.splice(0)) socket.send(JSON.stringify(message))
  })
  socket.addEventListener('message', (e) => onMessage(JSON.parse(String(e.data)) as ServerMessage))
  socket.addEventListener('close', onClose)
  return {
    send(message: ClientMessage) {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
      else queue.push(message)
    },
  }
}

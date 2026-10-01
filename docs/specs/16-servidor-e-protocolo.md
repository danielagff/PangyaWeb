# 16 — Servidor e protocolo

- **Status:** rascunho
- **Fase:** 4 Online
- **Depende de:** 14
- **Estimativa:** G

## Objetivo
Servidor próprio (Node/TypeScript) com contas, salas e persistência, falando com o cliente
web via WebSocket com protocolo próprio.

## Contexto — duas opções
1. **Servidor próprio + protocolo próprio (recomendado).** Reaproveita `packages/game` e
   `packages/physics` no servidor; mensagens tipadas (JSON ou MessagePack); simples de
   evoluir.
2. **Reaproveitar um servidor emulador da comunidade** (implementações existentes do
   protocolo original em C++/C#/Go) com um gateway WebSocket. Só faz sentido se você quiser
   que o cliente original e o cliente web joguem juntos; exige reimplementar no cliente web
   o protocolo binário e a criptografia de pacotes do original. Mais trabalho, menos controle.

## Escopo (opção 1)
**Inclui**
- WebSocket (`ws` ou uWebSockets.js), mensagens validadas (zod) e versionadas.
- Contas locais (usuário/senha com hash argon2), sessão por token.
- Lobby: listar/criar/entrar em salas, chat.
- Persistência em SQLite (Drizzle/Kysely): jogador, inventário, histórico de partidas.
- Docker Compose para rodar tudo localmente.

**Não inclui**
- Economia/loja, rankings globais, anti-cheat avançado.

## Contratos / interfaces
```ts
type ClientMsg =
  | { t: 'login'; user: string; pass: string }
  | { t: 'room.create'; config: MatchConfig } | { t: 'room.join'; roomId: string }
  | { t: 'shot.commit'; input: ShotInput }  | { t: 'chat'; text: string }
type ServerMsg =
  | { t: 'login.ok'; profile: Profile } | { t: 'room.state'; room: RoomState }
  | { t: 'shot.result'; playerId: string; result: ShotResult } | { t: 'error'; code: string }
```

## Critérios de aceite
- [ ] Dois navegadores fazem login, entram na mesma sala e trocam mensagens de chat.
- [ ] Reiniciar o servidor mantém contas e inventários.
- [ ] Testes de integração do protocolo rodando no CI.

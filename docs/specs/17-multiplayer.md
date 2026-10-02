# 17 — Multiplayer

- **Status:** em andamento
- **Fase:** 4 Online
- **Depende de:** 14, 16
- **Estimativa:** M

## Objetivo

Partidas de 2–4 jogadores em turnos, sincronizadas, com servidor autoritativo.

## Contexto

Golfe por turnos facilita muito: não há física em tempo real compartilhada. Basta o servidor
receber a **entrada** da tacada, simular (mesmo pacote `physics`) e distribuir o resultado.
Como a física é determinística (spec 08), os clientes podem simular localmente para
animação imediata e o servidor confirma.

## Escopo

**Inclui**

- Fluxo de turno: servidor define jogador da vez e vento; cliente envia `shot.commit`;
  servidor valida (taco permitido, power shot disponível, limites) e simula; todos recebem
  `shot.result` e reproduzem a mesma trajetória.
- Modos: Stroke (cada um joga sua bola) e, opcionalmente, Match Play.
- Timeout de turno, reconexão (estado reenviado), espectadores.
- Detecção de dessincronia: hash do resultado local × servidor (log + correção).

## Progresso

- Servidor autoritativo: carrega o buraco (`loadHoleData` + `HoleWorld` de `packages/game`,
  os mesmos do cliente), simula a tacada e manda a trajetória pronta — os clientes só
  animam, então todos veem exatamente a mesma bola.
- `packages/game/src/match.ts`: jogadores, turnos (honra no tee, depois o mais longe do pin),
  cartão por buraco, sequência de buracos, saída/volta pelo mesmo nome mantendo o placar.
- Cliente: menu → sala (nome, jogadores, anfitrião escolhe curso/buracos), chat, bolas
  coloridas com nome, placar no fim de cada buraco e da partida.
- Testes: reducer da partida; sala com dois jogadores jogando o Blue Lagoon 1 até o fim
  (quando há assets); e2e manual com dois navegadores.
- Ainda não: power shot/itens limitados, tempo por tacada, espectadores.

## Critérios de aceite

- [ ] 4 jogadores completam 3 buracos sem dessincronia.
- [ ] Desconectar e reconectar no meio do buraco retoma a partida.
- [ ] Cliente modificado que envia força > 1 é rejeitado.

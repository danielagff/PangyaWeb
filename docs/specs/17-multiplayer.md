# 17 — Multiplayer

- **Status:** rascunho
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

## Critérios de aceite

- [ ] 4 jogadores completam 3 buracos sem dessincronia.
- [ ] Desconectar e reconectar no meio do buraco retoma a partida.
- [ ] Cliente modificado que envia força > 1 é rejeitado.

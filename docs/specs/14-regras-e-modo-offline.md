# 14 — Regras de golfe e modo offline

- **Status:** em andamento
- **Fase:** 3 Jogo
- **Depende de:** 08–12
- **Estimativa:** M

## Objetivo

Partida completa single-player (1, 3, 9 ou 18 buracos) sem servidor, com placar final.

## Escopo

**Inclui**

- `packages/game`: estado da partida puro e serializável (para reaproveitar no servidor).
- Regras: contagem de tacadas, par, birdie/eagle/albatross/hole-in-one, penalidades de
  água (+1, reposicionar) e OB (+1/+2, voltar ao ponto anterior — verificar regra do original),
  limite de tacadas por buraco, condição de vento por buraco (aleatória com seed).
- Modos: Stroke Play; Prática (repetir tacada, escolher posição).
- Tela de resultado do buraco e da partida.
- Salvar progresso/configurações localmente.

**Não inclui**

- Economia (pang, itens), modos online.

## Contratos / interfaces

```ts
interface MatchState { config: MatchConfig; holeIndex: number; players: PlayerState[]; wind: Wind; turn: number }
type MatchEvent = { type: 'shot'; playerId: string; result: ShotResult } | { type: 'hole-end' } | …
function reduce(state: MatchState, event: MatchEvent): MatchState   // puro, determinístico
```

## Progresso

- `packages/game` (`hole.ts`): estado de um buraco em Stroke Play, puro e serializável —
  `startHole`, `applyShot`, `scoreName`, `scoreToPar`, `isChipIn`, com testes.
- Penalidades implementadas (a confirmar no original): água +1 com a bola no último ponto
  seco da trajetória; O.B. +1 voltando para onde a tacada saiu; limite de 3× o par.
- Força do piso sorteada entre `min` e `max` do property.xml (`power2`/`power3` ainda não
  usados — verificar quando o jogo usa cada faixa).
- Vento sorteado no início de cada buraco (0–9 m, direção qualquer).
- Fim do buraco: resultado (Birdie, Par…, Chip-in), cartão e botão "Próximo buraco"; o
  cartão segue pela URL (`&cartao=4:4,3:3`).

## Critérios de aceite

- [ ] Jogar 18 buracos de um curso (real ou procedural) do início ao fim.
- [ ] Testes do reducer cobrindo todas as penalidades e tipos de resultado.
- [ ] Recarregar a página no meio da partida retoma do mesmo ponto.

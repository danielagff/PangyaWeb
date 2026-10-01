# 15 — Interface e menus

- **Status:** rascunho
- **Fase:** 3 Jogo
- **Depende de:** 04, 12, 14
- **Estimativa:** M

## Objetivo
Fluxo de telas do jogo offline: título → seleção de personagem → equipamento → seleção de
curso/modo → partida → resultado.

## Escopo
**Inclui**
- UI em framework leve (ex.: Preact/Svelte ou React) sobre o canvas.
- Seleção de personagem com preview 3D, troca de taco/bola/roupas a partir dos dados do
  `.iff` (spec 04).
- Seleção de curso, número de buracos, modo.
- Configurações: gráficos, áudio, controles, idioma (pt-BR primeiro).
- Usar estética inspirada no original, mas sem depender das texturas de UI originais
  (o formato de UI do cliente costuma ser complexo — opcional numa spec futura).

**Não inclui**
- Lobby/salas online (spec 17), loja com moeda (futuro).

## Critérios de aceite
- [ ] Fluxo completo navegável por teclado e mouse.
- [ ] Equipamento escolhido altera os atributos usados na física.

# 11 — Green e putt

- **Status:** em andamento
- **Fase:** 2 Engine
- **Depende de:** 08, 10
- **Estimativa:** M

## Objetivo

Putt jogável com leitura de green parecida com o original.

## Contexto

No original, no green aparece uma grade com pontos/setas animados indicando a inclinação,
e o jogador usa a distância + inclinação para calcular a quebra do putt.

## Escopo

**Inclui**

- Grade de inclinação gerada a partir da malha de colisão do green (gradiente por célula),
  com animação de fluxo na direção da queda.
- Putter: barra de força em escala de distância de putt, sem vento.
- Rolagem no green com atrito próprio e captura pela cova (spec 08).
- Exibir "Chip-in" quando a bola entra de fora do green.

## Progresso

- Putter (PT) no painel; no green ele é escolhido sozinho e a força começa na distância
  até o pin (100% = 30y, alcance do PT1).
- `puttSpeed(jardas, roll)`: velocidade inicial para rolar a distância em piso plano
  (d = v²/2a); a rolagem usa a mesma física do chão (desce as inclinações).
- Grade de inclinação: traços apontando para a descida, maiores e mais vermelhos quanto
  mais inclinado, amostrados a cada 4 unidades na malha de colisão do green.
- Testes: putt reto em green plano para a ±2%; quebra para o lado da descida; entra na cova.
- Sem bandeira: a cova tem a **luz** que puxa a bola. Na física (`CUP_BEAM` em
  `packages/physics/src/flight.ts`): se a bola, descendo, passa por cima da cova dentro de
  `radius` (0,8) e abaixo de `height` (1,75 unidade ≈ 0,5 m), é puxada para dentro (alguns
  quadros de animação) e conta como embocada. Alta demais, passa. Valores a calibrar.
  Na tela, a faixa amarela de baixo da luz mostra essa altura.
- A bola entra na cova de verdade: a física desliza a bola até o centro e a deixa cair até
  o fundo (`dropIntoCup`, `CUP_DEPTH` 0,75). Na tela, a boca da cova recorta o terreno com o
  stencil e desenha a parede (borda branca) e o fundo; a bola aparece lá dentro.

## Critérios de aceite

- [ ] Grade coerente com o terreno (validar com green procedural de inclinação conhecida).
- [ ] Putt reto em green plano: distância final dentro de ±2% da escolhida.
- [ ] Putt em green inclinado quebra na direção da descida.

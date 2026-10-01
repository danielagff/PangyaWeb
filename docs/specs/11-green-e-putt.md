# 11 — Green e putt

- **Status:** rascunho
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

## Critérios de aceite

- [ ] Grade coerente com o terreno (validar com green procedural de inclinação conhecida).
- [ ] Putt reto em green plano: distância final dentro de ±2% da escolhida.
- [ ] Putt em green inclinado quebra na direção da descida.

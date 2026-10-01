# 12 — Personagens e animações

- **Status:** rascunho
- **Fase:** 2 Engine
- **Depende de:** 05, 09
- **Estimativa:** M

## Objetivo
Personagem jogável (com partes/roupas e taco) animado e sincronizado com a tacada.

## Contexto
Personagens do original incluem Nuri, Hana, Azer, Cecilia, Max, Kooh, Arin, Kaz, Lucia,
Nell, Spika, entre outros. Roupas/acessórios são partes trocáveis; também existem caddies
e mascotes.

## Escopo
**Inclui**
- Composição de personagem: corpo base + partes (cabelo, roupa, luvas, sapatos) + taco
  preso ao osso da mão.
- Máquina de animações: idle, preparar, backswing (sincronizado com a barra), impacto,
  follow-through, reações (comemoração, frustração).
- O impacto da animação dispara a física no momento certo.
- Usar as animações originais do jogo, inclusive as de reação e de cada tipo de tacada.

**Não inclui**
- Caddie e mascote (spec futura), loja de roupas (spec 15).

## Critérios de aceite
- [ ] Um personagem completo com taco executando a tacada inteira em sincronia.
- [ ] Troca de pelo menos uma parte (ex.: roupa) em tempo de execução.

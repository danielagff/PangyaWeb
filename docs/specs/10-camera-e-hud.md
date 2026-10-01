# 10 — Câmera e HUD

- **Status:** rascunho
- **Fase:** 2 Engine
- **Depende de:** 07, 09
- **Estimativa:** M

## Objetivo
Câmeras de jogo e HUD com as informações necessárias para mirar como no original.

## Escopo
**Inclui**
- Câmeras: atrás do jogador (mira), seguindo a bola em voo, vista do pouso, vista aérea
  do buraco (mapa), câmera do green. Transições suaves.
- HUD (HTML/CSS sobre o canvas ou UI no WebGL):
  - vento (força + seta), taco atual e distância máxima, distância até o pin, diferença de
    altura, % do piso, barra de força, barra de power shot, ponto de contato na bola;
  - mini-mapa do buraco com posição da bola e do pin;
  - placar do buraco (tacadas, par);
  - mensagens: "Pangya!", "Nice Shot", "Chip-in", "Hole in One", "OB", "Water Hazard".
- Marcador de queda prevista (usa previsão da spec 08).

## Critérios de aceite
- [ ] Todas as informações acima visíveis e atualizadas durante a mira.
- [ ] Câmera nunca atravessa o terreno.
- [ ] HUD legível em 1280×720 e 1920×1080.

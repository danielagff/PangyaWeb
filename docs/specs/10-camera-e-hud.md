# 10 — Câmera e HUD

- **Status:** em andamento
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

## Problemas conhecidos

### Tela inteira azul (céu/névoa) depois de algumas tacadas — Pink Wind buraco 1

- **Onde:** `?curso=round10_spring%20wind&prefixo=pink&buraco=1`, cliente JP extraído
  localmente (com os 32 modelos de objetos carregados).
- **Como acontece (vídeo do usuário, 2026-10-02):** várias tacadas de 1W seguidas sem esperar
  a bola parar; em uma delas, logo após sair do tee, a tela inteira fica com a cor do céu e
  não volta mais. Nenhum erro no console, nenhuma caixa vermelha.
- **Já corrigido (pode ser outra causa):** câmera atrás de paredes do penhasco com a bola no
  fundo do desfiladeiro; câmera atravessando o terreno ao deslizar entre posições; buffer
  de GPU novo por quadro na trilha.
- **Não reproduzido** no ambiente de testes (sem os modelos de objetos, swiftshader).
- **Hipóteses:** câmera dentro de um objeto grande (os objetos não entram no teste de
  oclusão); `lookAt` degenerado; algo específico da GPU/driver.
- **Para investigar:** `window.__debug()` no console (posição da bola e da câmera) quando
  ficar azul; testar com os objetos desligados.

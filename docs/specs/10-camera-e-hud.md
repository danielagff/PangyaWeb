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

## Progresso

- HUD no topo: buraco, par, tacada atual (com penalidades), distância e desnível até o pin,
  piso e faixa de força do piso, total do cartão.
- Mira com ←/→ (mais fina no green); câmera atrás da bola na direção da mira, mais baixa e
  próxima no green.
- Anel amarelo no ponto de queda previsto com a força/spin/curva atuais, sem vento (como o
  anel do jogo). No putt, a distância escolhida em linha reta.
- Barra de força em 3 toques de espaço (começa, fixa a força, acerta o impacto na volta),
  em `apps/client/src/hole/power-bar.ts`. O toque vale pela posição desenhada (o que o
  jogador viu). Velocidade (1,1 s) e zona (±3,5%) são estimativas — `POWER_BAR_TUNING`.
- Erro de impacto (`ShotRequest.impact`, efeito em `IMPACT_TUNING` de packages/game):
  centro = "PANGYA!"; fora do centro curva para o lado do erro (no putt desvia a mira);
  fora da zona perde até 10% de força. Estimativa a calibrar. No painel dá para desligar a
  barra (espaço bate direto com a força do slider).
- Rosa do vento no canto: seta relativa à mira (para cima = a favor) e força em m.
- Faltam: mini-mapa, mensagens grandes ("Nice Shot"), animação do personagem.
- Câmera livre mirando: arrastar o mouse gira em volta da bola, a roda aproxima/afasta;
  R, mirar (A/D/setas) ou começar a barra volta à câmera padrão.
- Câmera do voo: A/D giram em volta da bola, S alterna a vista de cima; 0,8 s antes de a bola
  tocar o chão (`FREE_CAMERA_UNTIL_LANDING`) volta sozinha à câmera padrão.
- Barra de força no estilo do original: escala de jardas (meio e máximo do taco), zona de
  impacto amarela com a faixa PANGYA (rosa, `IMPACT_TUNING.pangyaZone`) e linha central;
  deixar o marcador passar da zona cancela a tacada (o jogador desistiu) e volta a mirar.
- Rosa dos ventos redonda com seta azul e selo com os metros.
- HUD da tacada embaixo, no lugar do painel lateral (`hole/shot-hud.ts`): mostrador com o
  taco (roda do mouse troca), o ponto de impacto na bola (clique/arraste = spin e curva;
  duplo clique centraliza), o power shot (Alt: 1 toque = 1 PS, 2 toques rápidos = 2 PS) e a
  força do personagem; a barra de força sempre visível, com a escala do alcance do taco
  (`HoleWorld.shotRange`) e a linha vermelha do pin. Sempre 3 toques de espaço.
- A **roda do mouse sempre troca o taco** (mirando, na câmera livre e na vista aérea). Um
  clique simples não solta a câmera: a câmera livre só começa arrastando (6 px); o zoom dela é
  Shift+↑/↓ (ou Ctrl+roda).
- Vista aérea com M ou 0, como no original: **roda do mouse troca o taco** e o
  **bonequinho** (onde a bola cai a 100% com o taco e a mira atuais, com o nome do taco e o
  alcance) vai junto; **Shift+↑/↓** aproxima/afasta, puxando a câmera para o bonequinho, que
  passa a ser seguido; Ctrl+roda (ou pinça no touchpad) dá zoom para onde o mouse aponta
  (até 12 unidades do chão); arrastar move o mapa (e para de seguir); Delete+0 abre já
  aproximada no bonequinho, seguindo-o.
- **Régua da barra** (`power-bar.ts`): com o mouse em cima da barra, marcas a cada 1% (maiores
  a cada 5%) e a leitura do ponto ("73,5% · 132,3y"); **Z** e **X** marcam o ponto na barra
  (linha azul e verde com a força e as jardas, que acompanham a escala do taco); Z/X com o
  mouse fora da barra apagam. Ficam salvas no navegador. A última marca feita fica
  **selecionada** (▶, mais grossa); no modo sozinho ela é o "calibrador": o **2º espaço fixa
  exatamente a força dela**, não importa onde a barra esteja (na sala, a barra é normal).
- **Sempre PANGYA** (desenvolvimento, só no modo sozinho — a sala não tem): tecla **P** liga
  e desliga (lembrado no navegador; "PANGYA · AUTO" na barra). Com ele, o marcador bate
  sozinho no centro da zona (2 toques bastam) e o 3º toque também sai perfeito.

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

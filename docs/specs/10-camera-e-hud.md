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
- **O mouse nunca move a câmera** (pedido do Daniel, como no original): não há câmera livre
  com o mouse; a roda só troca o taco.
- **Mira precisa** (`AIM_TUNING`): cada toque de A/D/←/→ gira 0,1° (0,05° no green);
  segurando, depois de 0,25 s gira sozinha de 2°/s até 25°/s (no green 0,6 a 8°/s). O passo
  por quadro é limitado (1/30 s), então o PC engasgar não dá pulo. Enquanto a mira gira, o
  anel e o X giram junto em volta da bola; o cálculo exato (física) é refeito a cada 0,12 s
  (`LANDING_REFRESH`) e quando a mira para.
- **Mostrador da mira** (embaixo da rosa dos ventos, `updateAimReadout`): quantos graus a mira
  está do pin e para que lado ("0,30° direita ▶"), quanto isso dá de lado na distância do pin
  ("1,2y do pin, de lado") e, depois da calculadora (G), o alvo dela e quanto falta ("falta
  0,10° ▶") ou "✓ mira certa".
- Desnível do pin em **metros**, como no original (`unitsToMeters`), no HUD e na barra.
- Câmera do voo: A/D giram em volta da bola, S alterna a vista de cima; 0,8 s antes de a bola
  tocar o chão (`FREE_CAMERA_UNTIL_LANDING`) volta sozinha à câmera padrão.
- **Câmera da tacada no estilo do Pangya** (`SHOT_CAMERA`, `flightCamera`), refeita pelo
  vídeo do Daniel: **cada tacada sorteia uma câmera** e vai nela até a bola cair — `chase`
  (colada atrás da bola, baixa), `sky` (do chão, olhando a bola subir: o céu), `high` (bem
  alta, vendo o curso de cima) ou `side` (parada ao lado do meio do voo, girando; só em
  tacadas de 60 y ou mais). Antes, 0,5 s parada atrás do jogador (a bola saindo e os pangs).
  1,1 s antes de cair, **corta** para uma câmera parada perto da queda que só gira para ver a
  bola (se ela vai entrar ou parar a menos de 2 y da cova, perto da cova: de trás se cai
  perto, de lado se vem rolando de longe); se a bola rola para longe, vai atrás devagar.
  Quando a bola para, **a câmera fica parada** (antes ela voltava para trás da bola e dava um
  zoom na cova); a luz da cova some quando a bola entra; na próxima vez corta para trás do
  jogador. No putt: atrás da bola, baixa. A/D no voo giram (câmera de perseguição) e S
  mostra de cima, como antes. `window.__shotCamera = 'sky'` força uma câmera (testes);
  `__debugDrop(jardas)` rola a bola até a cova.
- **Câmera do jogo original**: o `ProjectG.exe` é protegido (tudo criptografado), então não dá
  para ler a câmera nele daqui. O diagnóstico (`?diagnostico`, seção "== CÂMERA",
  `camera-search.ts`) procura pistas nos arquivos de dados: tipos de arquivo, nomes com cara
  de câmera, a lista das tabelas dentro do `pangya_<região>.iff` e as palavras "camera",
  "cam_", "카메라", "연출" (direção de cena), "시점" (ponto de vista), "리플레이" dentro das
  tabelas e dos arquivos de dados. Esperando o Daniel rodar.
- **Comemoração** (`celebrate`): depois de embocar, 1,6 s vendo a cova (moedas) e corta para o
  personagem perto da cova, de frente para a câmera (enquadrado pela altura do esqueleto),
  fazendo a pose do resultado; depois fica na pose final ("…끝") com o quadro do fim do
  buraco por cima.
- Barra de força no estilo do original: escala de jardas (meio e máximo do taco), zona de
  impacto amarela com a faixa PANGYA (rosa, `IMPACT_TUNING.pangyaZone`) e linha central;
  deixar o marcador passar da zona cancela a tacada (o jogador desistiu) e volta a mirar.
- Rosa dos ventos redonda com seta azul e selo com os metros.
- HUD da tacada embaixo, no lugar do painel lateral (`hole/shot-hud.ts`): mostrador com o
  taco (roda do mouse troca), o ponto de impacto na bola (clique/arraste = spin e curva;
  duplo clique centraliza), o power shot (Alt: 1 toque = 1 PS, 2 toques rápidos = 2 PS) e a
  força do personagem; a barra de força sempre visível, com a escala do alcance do taco
  (`HoleWorld.shotRange`). Sempre 3 toques de espaço. A distância e o desnível do pin
  **não ficam na barra** (pedido do Daniel): estão no marcador do pin, na tela.
- A **roda do mouse sempre troca o taco** (mirando e na vista aérea).
- **Vista aérea** com M ou 0, como no original (`hole-view.ts`, `AERIAL_OVERLAY`): de cima,
  com a linha da mira subindo na tela; **linha vermelha da bola até o X** (onde a bola cai a
  100% com o taco e a mira atuais, sem vento) com a distância ("195.74y"), e no pin a
  bandeira com o **desnível em m** ("▼ -0.56 m") e a **distância** ("417.11y").
  **↑/↓** andam pela linha (começa devagar e acelera, proporcional à altura), **Shift+↑/↓**
  zoom suave (segurando), A/D giram a mira e a câmera acompanha; a roda troca o taco e o X vai
  junto. M/0 abre com a linha inteira e o pin; Delete+0 abre perto do X e segue o X até ↑/↓
  — mas se o X passa do buraco, abre e segue **na linha da mira na distância do buraco** (o
  buraco projetado na linha; `followAlong`), como combinado com o Daniel. A linha, o X e o
  anel são desenhados com o **giro suavizado da câmera** (`shownAim`): ficam presos ao centro
  da tela e giram junto com ela (antes pulavam na frente a cada toque de mira).
  **Espaço** na vista aérea só volta para a câmera normal; o próximo começa a barra.
  Câmera da vista aérea com **molas** (`hole/smooth.ts`, a conta do SmoothDamp): giro,
  posição na linha, altura e chão aceleram e freiam aos poucos, contando pelo tempo — sem
  trancos nos toques nem nos recálculos da física; a entrada vem da câmera normal em 0,45 s.
  A linha é **recortada no plano da câmera** (com zoom perto do X a bola fica atrás da
  câmera e a linha sumia) e os desenhos usam a posição da câmera do próprio quadro. Sem
  névoa na vista aérea (de cima, nítido como no original).
- **Marcador do pin como no original** (`COURSE_OVERLAY`): bandeira, triângulo branco,
  desnível em m e distância em jardas — no topo da luz da cova na câmera normal e na cova na
  vista aérea. **Luz da cova** verde-água, alta (`BEAM_HEIGHT`, ~28 m), mais clara no meio,
  com no mínimo 6 px de largura na tela (engrossa de longe); some na vista aérea.
- Câmera normal: suavização contando pelo tempo (`lerpFactor`), igual em qualquer taxa de
  quadros.
- **Voo da bola sem trancos**: a física tem um ponto a cada 0,02 s (50/s) e a tela é 60 Hz ou
  mais; a bola (e a ponta do rastro) é desenhada entre dois pontos pelo tempo exato do quadro
  — antes ela pulava de ponto em ponto (quadros repetidos e saltos alternados) e a câmera
  tremia junto. Medido: 0 mudanças bruscas de velocidade em 108 quadros do meio do voo.
  Também no campo de treino.
- **Tacada um pouco mais lenta na tela** (pedido do Daniel): voo e rolagem tocados a 80% da
  velocidade da física (`BALL_PLAYBACK_SPEED` em `settings.ts`). Só a animação muda — o
  caminho e onde a bola para são os mesmos (o servidor nem sabe). Drive de 1W a 100%: 5,1 s →
  6,4 s no ar; no buraco 2 do Blue Lagoon a tacada inteira foi de 5,4 s para 6,9 s.
- **Calibrador** (`power-bar.ts`): um ponteiro na barra com a força e as jardas. Mouse em cima
  da barra mostra marcas a cada 1% e a leitura do ponto; **clique** (ou arrastar) põe o
  ponteiro ali, **botão direito** tira; **X sobe e Z desce 0,1%** (Shift: 1%; segurando,
  continua); sem ponteiro, Z/X começam na distância do pin. Salvo no navegador. No modo sozinho
  o **2º espaço fixa exatamente a força do calibrador** (▶ no ponteiro); na sala, a barra é
  normal.
- **Sempre PANGYA** (desenvolvimento, só no modo sozinho — a sala não tem): tecla **P** liga
  e desliga (lembrado no navegador; "PANGYA · AUTO" na barra). Com ele, o marcador bate
  sozinho no centro da zona (2 toques bastam) e o 3º toque também sai perfeito.
- **Calculadora** (desenvolvimento, só no modo sozinho): tecla **G**. `solveShot` em
  `packages/game/src/calculator.ts` acha a mira e a força para a bola cair direto na cova
  ("de dunk": tacada normal, bola no centro, impacto perfeito) com a física de verdade —
  vento, desnível, terreno e a força do piso já sorteada — pelo método de Newton sobre o
  primeiro toque no chão, e confere jogando a tacada inteira. Já deixa a mira, o taco (se
  o escolhido não alcança, o primeiro mais longo que alcança), a bola no centro e o
  calibrador na força exata: com o P, são só os 2 toques. Mostra "1W · força 98,29%
  (226,1y) · mira 0,50° (2,0y) à direita do pin · entra de dunk"; avisa quando não alcança
  (quanto falta), quando há obstáculo no caminho (a quantas jardas) e no green (putt ainda
  não). Conferido no Blue Lagoon (bola no tee e em 392 pontos de fairway, rough, bunker e
  areia, com vento sorteado): toda tacada que ela achou entrou na cova (320/320); o resto
  era obstáculo no caminho (69) ou fora de alcance (3). Leva até ~50 ms.

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

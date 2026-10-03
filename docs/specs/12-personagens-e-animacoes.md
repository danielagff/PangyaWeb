# 12 — Personagens e animações

- **Status:** em andamento
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

## Progresso

- **Reações pelo resultado** (`reactionMotion`, pedido do Daniel: "de bogey a HIO o personagem
  comemora com base na felicidade"): hole in one/albatross `알바홀인승리포즈`, eagle
  `이글승리포즈`, birdie `버디승리포즈`, par uma das `세이브파승리포즈`/`2`/`02` (sorteada),
  bogey `보기실격실망포즈`, double bogey ou pior `더블보기실망포즈` (sem a pose, a mais próxima);
  depois a pose final "…끝". Tocam perto da cova com a câmera de frente (spec 10). As
  versões com item (`날개알바홀인승리포즈_item`, asas; bike, dragão…) ficam para quando houver
  itens.
- Catálogo (`tools/asset-pipeline/src/characters.ts` → `assets/original/_characters.json`,
  gerado junto com o índice): cada `.bpet` com o `.apet` e as `.mpet` da mesma pasta,
  peças por slot (2º pedaço do nome: ha, fc, ts, pv, ft, hn…; `!xx` = slots escondidos) e
  uma roupa padrão (uma peça por slot básico, preferindo as que não escondem outras).
- Montagem (`apps/client/src/character/character.ts`): ossos do .bpet; cada peça é um
  SkinnedMesh com as inversas da pose de repouso _da peça_ — mesma conta do
  pet-source_tools (Σ wᵢ · Bpet[i] · Mpet[i]⁻¹ · Mpet[principal] · v).
- Animação: um clipe por "motion" do .apet, amostrado a 30 quadros/s; rotação gravada
  invertida (x,y,z,w); posição/rotação/escala locais ao pai, com a pose de repouso onde
  faltam chaves.
- Em jogo: só o personagem da vez aparece, ao lado da bola (destro, alvo à esquerda),
  parado; na tacada faz o swing do taco e a bola sai no impacto (`CHARACTER_TUNING`).
  Escolha do personagem no menu e na sala; tecla N percorre os movimentos.
- Validado com um personagem sintético no formato real (8 ossos, peças com pesos em 2
  ossos, motions stand/swing). **A conferir com os arquivos reais:** nomes dos movimentos
  (padrões `IDLE_MOTIONS`/`SWING_MOTIONS` em hole-view.ts), para onde o modelo olha
  (`facingDegrees`), a escala e o momento do impacto.
- Ainda não: trocar roupa/peças na interface, expressões faciais (FANM), taco na mão.
- Taco encostando no chão: na postura de preparação, `fitClub` estica/encolhe o taco a
  partir da mão (0,75–1,5×, `CLUB_FIT`) para a cabeça tocar o chão debaixo da bola.
- **Catálogo de animações** no mapeador (`motion-catalog.ts`, abre direto; tecla C alterna
  com o estúdio), no estilo do Mixamo: um cartão por movimento, **todos se mexendo ao mesmo
  tempo**, com o número da lista, a tradução, o nome coreano, a duração e a anotação; busca,
  filtro por categoria, trechos finais ("끝") escondidos, tamanho dos cartões; o mouse em
  cima recomeça do início; clicar no boneco abre no estúdio (quadro a quadro). Desenho: um
  boneco só, posado e desenhado no retângulo de cada cartão visível (`CharacterModel.pose`
  - scissor, como o exemplo "multiple elements" do three.js); cada cartão se enquadra
    medindo o boneco em 9 poses do movimento (mesmo tamanho em todos, só afasta se o movimento
    sai disso). O personagem de teste (`pnpm assets:teste`) ganhou 8 movimentos com nomes
    reais para testar.
- Pesquisa (03/10/2026): **não existe catálogo nem lista de movimentos por personagem** na
  internet — um tópico de 2025 no [pangya.community](https://pangya.community/t/in-search-of-animations-motions/2832)
  pede exatamente isso, sem resposta. O que existe: as exportações originais (3ds Max, 30
  quadros/s) de movimentos da **Arin** esquecidas em patches (repositório
  [Paechijanjae](https://codeberg.org/retreev/Paechijanjae), `data/avatar/g_arin/`), com nomes
  e duração (ex.: 우드샷 0–78, 우드샷헛스윙 0–121, 파 0–170, 버디 0–138, 홀인원 0–150); a cadeia
  "끝" = trecho final, ligado pelo campo "próximo movimento"; o bloco **FRAM** do `.apet`
  (comandos por quadro: `ptex(...)` troca a textura do rosto, `hideclub`/`showclub`,
  `hidebone`/`showbone`) — ainda não lido por nós; a lista de comandos de chat
  ([lounge action commands](https://pangya.community/t/lounge-action-commands-list/428)).
  Nenhuma fonte diz o quadro do impacto do swing.

## Critérios de aceite

- [ ] Um personagem completo com taco executando a tacada inteira em sincronia.
- [ ] Troca de pelo menos uma parte (ex.: roupa) em tempo de execução.

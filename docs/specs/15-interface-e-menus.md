# 15 — Interface e menus

- **Status:** em andamento
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
- Reproduzir a UI original usando as texturas/sprites de interface do cliente. Se o formato
  de layout da UI for difícil de interpretar, montar as telas à mão em HTML/CSS com os
  sprites originais e deixar o parser de layout para uma spec futura.

**Não inclui**

- Lobby/salas online (spec 17), loja com moeda (futuro).

## Critérios de aceite

- [x] Fluxo completo navegável por teclado e mouse.
- [ ] Equipamento escolhido altera os atributos usados na física.

## Progresso

- **Bolas** (`equipment/balls.ts`, `menu/ball-preview.ts`): a lista vem do `balls.json`
  (Ball.iff convertido; 149 bolas, uma por modelo que existe na extração), com os nomes do
  cliente japonês traduzidos pelas palavras conhecidas ("爆弾アズテック" → "Bomba Aztec") e a
  prévia do modelo girando. Guardada no navegador (`pangyaweb.bola`); vai na entrada da sala
  online (`hello.ball`) para os outros verem. Na partida o modelo (`pet-object.ts`) fica no
  tamanho da bola da física. Os atributos da tabela ainda não mudam a física (os números
  lidos não batem com os do jogo; conferir o layout do Ball.iff).
- **Menu** (`apps/client/src/menu/menu.ts`), com endereço por tela (o "voltar" do navegador
  funciona; Esc volta, Enter confirma, setas escolhem):
  - título (`/`): jogar sozinho, jogar com amigos, campo de treino, mapeador, diagnóstico;
  - personagem (`#sozinho` / `#amigos`): lista, **prévia 3D** na postura básica (기본자세;
    arrastar gira — `menu/character-preview.ts`) e a força; "Continuar" vai ao curso
    (sozinho) ou à sala (amigos);
  - curso (`#curso`): cursos do servidor com nome do jogo (`courseName`: tabela por prefixo
    — `blue` Blue Lagoon, `pink` Pink Wind — senão o nome da pasta), 1/3/9/18 buracos,
    buraco inicial, recorde do plano. Lembra a última escolha.
- **Plano de buracos** (`menu/courses.ts`): `planHoles` (dá a volta: começar no 10 com 18
  buracos = 10…18, 1…9), usado no modo sozinho e na sala. Na URL do modo sozinho:
  `buracos=10-18,1-9`; links antigos sem o plano seguem até o 18 como antes.
- **Cartão de placar** (`menu/scorecard.ts`) no fim de cada buraco, da rodada e da partida
  online: buracos, par, tacadas com círculo/quadrado (birdie, eagle, bogey…), ida/volta
  quando passa de 9 buracos, total relativo ao par.
- **Fim da rodada** (sozinho): total, último resultado, **recorde** por curso + plano
  (`menu/records.ts`, neste navegador), "Jogar de novo" (Enter), "Outro curso", "Menu".
- Ainda não: sprites/telas originais do cliente (precisa achar os arquivos de UI na
  extração), equipamento (tacos/bolas do `.iff`) mudando a física, configurações de
  gráficos/áudio/controles.

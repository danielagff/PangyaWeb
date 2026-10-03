# 13 — Áudio

- **Status:** em andamento
- **Fase:** 2 Engine
- **Depende de:** 03, 09
- **Estimativa:** P

## Objetivo

Efeitos sonoros e música tocando nos eventos certos.

## Escopo

**Inclui**

- Web Audio API com mixer (música, efeitos, vozes) e volumes configuráveis.
- Mapa evento → som: tacada (por tipo/qualidade), Pangya, quique por superfície, água,
  entrada na cova, vozes do personagem, música por curso.
- Desbloqueio de áudio após primeira interação (exigência dos navegadores).
- Usar os sons, vozes e músicas originais (convertidos para formato web pelo pipeline).

## Progresso

- A física marca o quadro de cada evento (quique, rolagem, colisão, água, cova…); o
  `HoleWorld` monta a linha do tempo da tacada (`PlayedShot.events`), que também vai pela
  rede no multiplayer.
- Quique e rolagem usam os `.wav` de cada piso do property.xml (`bound_sound`/`roll_sound`).
  **Os nomes do cliente são em coreano**: o Blue Lagoon usa `공_그린.wav` (bola no green),
  `공_티샷.wav`, `충돌_rough2.wav`, `구름_rough.wav` (rolando)…
- **Momentos do jogo** (`audio/sound-events.ts`): batida normal, PANGYA, power shot,
  errada, barra de força; quique/rolagem sem som do piso, árvore/objeto, água, O.B., cova,
  aplausos; resultado (hole in one, albatross, eagle, birdie, par, bogey, double bogey,
  chip-in); música do menu e **de cada curso**; menus (mudar seleção, confirmar, voltar).
  Cada um acha o arquivo sozinho por padrões de nome em coreano e inglês (팡야/pangya,
  컵/cup, 버디/birdie, 박수/applause…; "파" não pega "파도" nem "파워샷"; vozes não entram
  como efeito); sem arquivo, sintetizado (batida, quiques, cova…) ou mudo.
- **Vozes**: no Pangya as falas vêm dos **pacotes de voz** (tacos de voz e eventos), um
  por personagem: `<pacote>_<nº do personagem>_<fala><n>.wav` (`v2_club_7_py1.wav`) ou, em
  alguns pacotes, com a palavra (`2013_thanksgiving_7_pangya0.wav`; "dbobey" é erro do
  próprio jogo). Número pela letra do arquivo do personagem: 0 Nuri (m), 1 Hana (f),
  2 Azer, 3 Cecilia, 4 Max, 5 Kooh, 6 Arin, 7 Kaz, 8 Lucia, 9 Nell, 10 Spika, 11 Nuri R
  (mm), 12 Hana R (ff), 14 Cecilia R (cc). O automático usa o pacote mais completo do
  personagem; o mapeador lista os dele primeiro. Tocam: "Pangya!" (`py`, não no putt),
  power shot (`ps`/`dps`), resultado (`ha` hole in one/albatross, `e`, `bi`, `par`, `bo`,
  `dbo`), O.B. (`ob`), água (`w`), bunker (`bu`), apresentação na escolha do personagem
  (`pre`), fim da rodada sozinho (`win`/`lose`). Uma fala por vez.
- Diagnóstico do cliente JP (03/10/2026): 6933 sons, 191 pacotes de voz; `birdie.wav`,
  `par.wav`, `bogey.wav`; músicas `.mp3` (`bgm_under_par`, `bgm_over_par`,
  `bgm_scoreboard` → fim do buraco e da rodada; `bgm_grandprix_lobby` fica fora do menu);
  vozes de caddie (`1_cien1_tlimit01.wav`…). A página de diagnóstico agora mostra as pastas
  dos sons e o caminho de cada música (para achar a de cada curso).
- Com os nomes certos (2º diagnóstico): cova = `공_홀인.wav` (não `공_컵점프1`, que é a bola
  pulando na borda); **público** (`갤러리_박수` aplausos na cova, `갤러리_와우` no birdie ou
  melhor, `갤러리_오` quando para a menos de 1,5 y da cova, `갤러리_실망` na água/O.B.);
  `나이스샷.wav` ("Nice shot!") na batida boa sem PANGYA; música do menu da pasta
  `sound/lobby` (`coffee_time.mp3`); vozes: o taco de voz normal (`2014_voice_club`, depois
  `v2_club`) antes dos pacotes de evento.
- **Som ambiente** pelas caixas de som do curso (`바다` → `바다소리.wav` em laço) e os bichos
  (`NPC_SeaGull` → `갈매기울음.wav` a cada 8–22 s).
- Música de cada curso: o cliente não tem tabela curso → música (o `Course.iff` não tem);
  usamos a da **trilha oficial** (pangya.wiki, "Pangya Online Original Soundtrack";
  `COURSE_TRACKS`): Blue Lagoon/Blue Water/Blue Moon = Daydream e Frog, Pink Wind/Wind
  Hill/Sepia Wind = Breeze e Spring, Wiz Wiz/West Wiz = Bunny e Shiny, White Wiz =
  Snowscape e Winter Ride, Silvia Cannon = Navy Blue e Rising Sun, Shining Sand = Somewhere
  e Nowhere, Ice Cannon = Crystal Waver e Happy Flight, Deep Inferno = Volcano e Vermilion,
  Ice Spa = Crystal Lake e Fade Into White, Lost Seaway, Eastern Valley (e River), Wiz City
  (Secret Wish, A Day in the WizCity), Ice Inferno (Orbit of Darkness, Cyan Sunset), Grand
  Zodiac (Grand Skyscraper), Abbot Mine (Beautiful Ruins, Skyrider), Mystic Ruins (Dear
  Memory, Oracle). Toca uma delas, sorteada. Sem a música na tabela, o automático tenta a
  pasta do curso, a pasta de sons dele e as palavras do nome da pasta. O Daniel confere e
  troca na tela Sons.
- **Pangs**: som das moedas `아이템획득(팡).wav` (momento "pang") quando as moedas saem da
  bola no PANGYA/power shot e da cova quando a bola entra (sintetizado sem o arquivo).
- **Tela "Sons" no mapeador** (`audio/sound-mapper.ts`; `mapeador.html#sons` ou "Sons do
  jogo" no menu): os momentos com os arquivos que tocam e de onde vieram (escolhido,
  automático, sintetizado, mudo); todos os arquivos de som por pasta, com ▶ e ＋ para usar no
  momento escolhido, ✕ para tirar, "sem som", "↺ automático"; a voz de cada personagem.
  Grava em `assets/converted/data/sons.json` pelo servidor (`/api/sons`, só o próprio PC) e
  vale para todos.
- `SoundLibrary` (uma por página, `sound`): volumes **geral, música, efeitos e vozes**
  (painel "🔊 Som" no menu, lembrados no navegador); música em laço com troca suave; tecla V
  liga/desliga tudo no jogo. Pulando a animação, só tocam a batida e o som final.
- O servidor manda o power shot de cada tacada (som e voz nos outros jogadores) e cada
  cliente anuncia o resultado de quem embocou.
- Teste na nuvem: `pnpm assets:teste` gera bipes com nomes no padrão (`data/sound/teste/`).
  Conferido no navegador: música do curso em laço, PANGYA + "Pangya!" na batida, cova +
  aplausos no Hole in One.
- Ainda não: vozes dos caddies, conferir no PC com os arquivos reais.

## Critérios de aceite

- [x] Todos os eventos da física e da tacada têm som associado.
- [x] Configurações de volume persistem entre sessões.

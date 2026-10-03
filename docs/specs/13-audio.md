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
- **Vozes** `<prefixo>_<código><n>.wav`: o prefixo de cada personagem sai da pasta
  (`h_kaz` → `kaz`), do nome ou da letra. Tocam: "Pangya!" (`py`, não no putt), power shot
  (`ps`/`dps`), resultado (`ha` hole in one/albatross?, `e` eagle?, `bi`, `par`, `bo`,
  `dbo`), O.B. (`ob`), fim da rodada sozinho (`win`/`lose`). Uma fala por vez. `bu`, `w` e
  `pre` só dá para ouvir no mapeador (significado a conferir).
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
- Ainda não: sons ambientes do curso (ondas, pássaros — `soundbox` do .gbin), vozes dos
  caddies, conferir os nomes com a extração completa.

## Critérios de aceite

- [x] Todos os eventos da física e da tacada têm som associado.
- [x] Configurações de volume persistem entre sessões.

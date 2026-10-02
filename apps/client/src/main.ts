import { characterSelect } from './character/character.ts'
import { startCharacterViewer } from './character/viewer.ts'
import { showDiagnostics } from './diagnostics.ts'
import { startHoleMode } from './hole/hole-mode.ts'
import { startOnlineMode } from './online/online-mode.ts'
import { startRangeMode } from './range-mode.ts'
import { powerInput } from './settings.ts'
import './style.css'

// Rotas: ?curso=…&prefixo=…&buraco=N (sozinho), ?online (sala multiplayer),
// ?treino (campo de treino), ?personagens (visualizador); sem parâmetros, o menu.
const params = new URLSearchParams(location.search)
const round = params.get('curso')

if (round) {
  startHoleMode({
    round,
    prefix: params.get('prefixo') ?? round.split('_').pop() ?? round,
    hole: Number(params.get('buraco') ?? 1),
  }).catch((err: unknown) => console.error(err))
} else if (params.has('online')) {
  startOnlineMode()
} else if (params.has('treino')) {
  startRangeMode()
} else if (params.has('personagens')) {
  void startCharacterViewer()
} else if (params.has('diagnostico')) {
  void showDiagnostics()
} else {
  showMenu()
}

interface CourseInfo {
  round: string
  prefix: string
  holes: number[]
}

function showMenu() {
  const menu = document.createElement('div')
  menu.className = 'lobby'
  menu.innerHTML = `
    <h1>PangyaWeb <small class="version">versão ${__PANGYA_VERSION__}</small></h1>
    <p><a class="button" href="?online">Jogar com amigos (sala)</a></p>
    <h2>Personagem</h2>
    <p class="character"></p>
    <p class="power"></p>
    <h2>Sozinho</h2>
    <div class="courses"><p>Procurando cursos…</p></div>
    <p><a class="button secondary" href="?treino">Campo de treino</a>
      <a class="button secondary" href="?diagnostico">Diagnóstico</a></p>
  `
  document.body.appendChild(menu)
  void characterSelect().then((select) => menu.querySelector('.character')!.append(select))
  menu.querySelector('.power')!.append(powerInput())
  const list = menu.querySelector('.courses') as HTMLDivElement
  const link = (c: CourseInfo, hole: number) =>
    `?curso=${encodeURIComponent(c.round)}&prefixo=${encodeURIComponent(c.prefix)}&buraco=${hole}`
  // A lista vem do servidor da partida; sem ele (pnpm dev sozinho), o curso de exemplo.
  void fetch('/api/courses')
    .then((r) => (r.ok ? (r.json() as Promise<CourseInfo[]>) : []))
    .catch(() => [] as CourseInfo[])
    .then((courses) => {
      const shown = courses.length
        ? courses
        : [{ round: 'round02_blue', prefix: 'blue', holes: [1] }]
      list.innerHTML = shown
        .map(
          (c) =>
            `<p>${c.round}: ${c.holes
              .map((h) => `<a href="${link(c, h)}">${h}</a>`)
              .join(' ')}</p>`,
        )
        .join('')
    })
}

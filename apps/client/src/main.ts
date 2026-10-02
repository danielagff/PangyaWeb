import { startCharacterViewer } from './character/viewer.ts'
import { showDiagnostics } from './diagnostics.ts'
import { startHoleMode } from './hole/hole-mode.ts'
import { showMenu } from './menu/menu.ts'
import { startOnlineMode } from './online/online-mode.ts'
import { startRangeMode } from './range-mode.ts'
import './style.css'

// Rotas: ?curso=…&prefixo=…&buraco=N&buracos=1-18 (sozinho), ?online (sala multiplayer),
// ?treino (campo de treino), ?personagens (visualizador); sem parâmetros, o menu
// (título → personagem → curso, em menu/menu.ts).
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

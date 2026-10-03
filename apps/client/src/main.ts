import { startCharacterViewer } from './character/viewer.ts'
import { showDiagnostics } from './diagnostics.ts'
import { startHoleMode } from './hole/hole-mode.ts'
import { showMenu } from './menu/menu.ts'
import { startOnlineMode } from './online/online-mode.ts'
import { startRangeMode } from './range-mode.ts'
import { startNavigation, type Screen } from './app/navigation.ts'
import { cover, reveal } from './app/transition.ts'
import { courseName } from './menu/courses.ts'
import './style.css'

// Rotas: ?curso=…&prefixo=…&buraco=N&buracos=1-18 (sozinho), ?online (sala multiplayer),
// ?treino (campo de treino), ?personagens (visualizador); sem parâmetros, o menu
// (título → personagem → curso, em menu/menu.ts).
startNavigation(async (previous) => {
  const params = new URLSearchParams(location.search)
  const round = params.get('curso')
  if (round) {
    const prefix = params.get('prefixo') ?? round.split('_').pop() ?? round
    const hole = Number(params.get('buraco') ?? 1)
    // A cortina com a última imagem da tela anterior (ou o nome do curso) enquanto carrega.
    cover({
      ...withImage(previous),
      title: courseName({ round, prefix }),
      subtitle: `Buraco ${hole}`,
    })
    previous?.dispose()
    return startHoleMode({ round, prefix, hole })
  }
  if (params.has('online')) startOnlineMode()
  else if (params.has('treino')) startRangeMode()
  else if (params.has('personagens')) void startCharacterViewer()
  else if (params.has('diagnostico')) void showDiagnostics()
  else {
    if (previous) {
      cover(withImage(previous))
      previous.dispose()
    }
    const menu = showMenu()
    if (previous) void reveal()
    return menu
  }
  return undefined
})

function withImage(screen: Screen | undefined) {
  const image = screen?.snapshot?.()
  return image ? { image } : {}
}

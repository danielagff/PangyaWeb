import { startHoleMode } from './hole/hole-mode.ts'
import { startRangeMode } from './range-mode.ts'
import './style.css'

// ?curso=round02_blue&prefixo=blue&buraco=1 abre um buraco real (assets locais);
// sem parâmetros, abre o campo de treino.
const params = new URLSearchParams(location.search)
const round = params.get('curso')

if (round) {
  startHoleMode({
    round,
    prefix: params.get('prefixo') ?? round.split('_').pop() ?? round,
    hole: Number(params.get('buraco') ?? 1),
  }).catch((err: unknown) => {
    const box = document.createElement('pre')
    box.className = 'hole-status error'
    box.textContent = `Não foi possível abrir o buraco:\n${err instanceof Error ? err.message : String(err)}`
    document.body.appendChild(box)
  })
} else {
  startRangeMode()
}

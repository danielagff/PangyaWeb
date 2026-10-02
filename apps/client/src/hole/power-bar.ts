/**
 * Barra de força no estilo do Pangya, com três toques de espaço:
 * 1º começa (o marcador corre da esquerda para a direita), 2º fixa a força,
 * 3º acerta o impacto quando o marcador volta à zona da esquerda.
 *
 * A zona de impacto fica à esquerda, com o ponto da tacada perfeita ("PANGYA") marcado no
 * meio dela. Se o marcador passa da zona sem o 3º toque, a tacada é cancelada (o jogador
 * desistiu de bater naquela hora) e ele volta a mirar.
 *
 * Velocidade e largura da zona são estimativas (a comparar com o original).
 */
import { IMPACT_TUNING } from '@pangya/game'

export const POWER_BAR_TUNING = {
  /** Segundos para o marcador ir de 0 a 100%. */
  riseSeconds: 1.1,
  /** Segundos para voltar de 100% até a zona de impacto. */
  returnSeconds: 1.1,
  /** Meia-largura da zona de impacto, em fração da barra. */
  zoneHalf: 0.035,
  /** Quanto o marcador passa da zona antes de cancelar a tacada. */
  overrun: 0.05,
}

/** Erro de impacto (em meias-larguras da zona) que ainda conta como PANGYA (tacada perfeita). */
const PANGYA_WINDOW = IMPACT_TUNING.pangyaZone

/** Resultado: força (0..1) e erro de impacto em meias-larguras da zona (0 = centro). */
export interface PowerBarResult {
  percent: number
  impact: number
}

/** Posição da zona de impacto na barra (fração a partir da esquerda). */
const ZONE = 0.06

export interface PowerBarOptions {
  /** Texto do primeiro passo. */
  label?: string
  /** Distância (jardas) a 100% com o taco atual, para a escala acima da barra. */
  maxYards?: number
  /** Marcador passou da zona sem o 3º toque: tacada cancelada. */
  onCancel?: () => void
}

export function createPowerBar() {
  const k = POWER_BAR_TUNING
  const root = document.createElement('div')
  root.className = 'power-bar'
  root.innerHTML = `
    <div class="scale">
      <span class="tag pangya-tag">PANGYA</span>
      <span class="tag half"></span>
      <span class="tag max"></span>
    </div>
    <div class="track">
      <div class="ticks"></div>
      <div class="fill"></div>
      <div class="zone"><div class="pangya"></div></div>
      <div class="power"><span></span></div>
      <div class="marker"></div>
    </div>
    <div class="label">Espaço: começar</div>`
  root.hidden = true
  document.body.appendChild(root)
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector(selector) as T
  const track = $<HTMLDivElement>('.track')
  const fill = $<HTMLDivElement>('.fill')
  const powerMark = $<HTMLDivElement>('.power')
  const powerText = $<HTMLSpanElement>('.power span')
  const marker = $<HTMLDivElement>('.marker')
  const label = $<HTMLDivElement>('.label')
  const zone = $<HTMLDivElement>('.zone')
  const pangya = $<HTMLDivElement>('.pangya')
  const half = $<HTMLSpanElement>('.half')
  const max = $<HTMLSpanElement>('.max')
  zone.style.left = `${(ZONE - k.zoneHalf) * 100}%`
  zone.style.width = `${k.zoneHalf * 2 * 100}%`
  // Faixa da tacada perfeita, centralizada na zona.
  pangya.style.left = `${50 - PANGYA_WINDOW * 50}%`
  pangya.style.width = `${PANGYA_WINDOW * 100}%`
  $<HTMLSpanElement>('.pangya-tag').style.left = `${ZONE * 100}%`

  let stage: 'idle' | 'rising' | 'returning' = 'idle'
  let started = 0
  let power = 0
  let maxYards = 0
  /** Última posição desenhada: os toques valem pelo que o jogador viu na tela. */
  let shown = 0
  let raf = 0
  let finish: ((result: PowerBarResult) => void) | undefined
  let cancelled: (() => void) | undefined

  /** Posição atual do marcador (fração da barra). */
  const position = (now: number) => {
    const t = (now - started) / 1000
    if (stage === 'rising') return Math.min(1, t / k.riseSeconds)
    // Volta da força escolhida até a zona e um pouco além.
    const speed = (1 - ZONE) / k.returnSeconds
    return power - t * speed
  }

  const yards = (fraction: number) => (maxYards ? `${Math.round(maxYards * fraction)}y` : '')

  const draw = (now: number) => {
    if (stage === 'idle') return
    const p = position(now)
    shown = p
    marker.style.left = `${Math.max(0, p) * 100}%`
    if (stage === 'rising') {
      fill.style.width = `${p * 100}%`
      label.textContent = `${Math.round(p * 100)}% ${yards(p)} · espaço: fixar a força`
      if (p >= 1) setPower(now, 1) // chegou no máximo: 100%
    } else {
      // Perto da zona, ela pisca para chamar a atenção.
      root.classList.toggle('near', p < ZONE + 0.12 && p > ZONE - k.zoneHalf)
      if (p < ZONE - k.zoneHalf - k.overrun) {
        giveUp()
        return
      }
    }
    raf = requestAnimationFrame(draw)
  }

  const setPower = (now: number, at = shown) => {
    power = Math.max(0.01, at)
    powerMark.style.left = `${power * 100}%`
    powerText.textContent = yards(power) || `${Math.round(power * 100)}%`
    powerMark.hidden = false
    stage = 'returning'
    started = now
    label.textContent = `${Math.round(power * 100)}% ${yards(power)} · espaço no PANGYA (rosa)`
  }

  const hideSoon = () =>
    setTimeout(() => {
      if (stage !== 'idle') return
      root.hidden = true
      root.classList.remove('done', 'cancelled')
    }, 900)

  const done = (impact: number) => {
    cancelAnimationFrame(raf)
    stage = 'idle'
    root.classList.remove('near')
    root.classList.add('done')
    label.textContent =
      Math.abs(impact) <= PANGYA_WINDOW
        ? '✨ PANGYA!'
        : Math.abs(impact) <= 1
          ? 'Boa!'
          : 'Errou a zona'
    hideSoon()
    finish?.({ percent: power, impact })
  }

  /** Passou da zona sem o toque: o jogador desistiu de bater agora. */
  const giveUp = () => {
    cancelAnimationFrame(raf)
    stage = 'idle'
    root.classList.remove('near')
    root.classList.add('cancelled')
    label.textContent = 'Tacada cancelada — espaço para tentar de novo'
    hideSoon()
    cancelled?.()
  }

  return {
    get active() {
      return stage !== 'idle'
    },
    /** Começa a barra; `onDone` recebe a força e o erro de impacto. */
    start(onDone: (result: PowerBarResult) => void, options: PowerBarOptions = {}) {
      finish = onDone
      cancelled = options.onCancel
      maxYards = options.maxYards ?? 0
      half.textContent = yards(0.5)
      max.textContent = yards(1)
      stage = 'rising'
      started = performance.now()
      power = 0
      shown = 0
      root.hidden = false
      root.classList.remove('done', 'cancelled', 'near')
      powerMark.hidden = true
      fill.style.width = '0'
      marker.style.left = '0'
      label.textContent = options.label ?? 'Espaço: fixar a força'
      raf = requestAnimationFrame(draw)
    },
    /** Toque de espaço com a barra ativa. */
    press() {
      const now = performance.now()
      if (stage === 'rising') setPower(now)
      else if (stage === 'returning') done((shown - ZONE) / k.zoneHalf)
    },
    cancel() {
      cancelAnimationFrame(raf)
      stage = 'idle'
      root.hidden = true
    },
    dispose() {
      cancelAnimationFrame(raf)
      root.remove()
    },
    track,
  }
}

export type PowerBar = ReturnType<typeof createPowerBar>

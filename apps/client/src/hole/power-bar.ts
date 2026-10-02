/**
 * Barra de força no estilo do Pangya, com três toques de espaço:
 * 1º começa (o marcador corre da esquerda para a direita), 2º fixa a força,
 * 3º acerta o impacto quando o marcador volta à zona da esquerda.
 *
 * Velocidade e largura da zona são estimativas (a comparar com o original).
 */

export const POWER_BAR_TUNING = {
  /** Segundos para o marcador ir de 0 a 100%. */
  riseSeconds: 1.1,
  /** Segundos para voltar de 100% até a zona de impacto. */
  returnSeconds: 1.1,
  /** Meia-largura da zona de impacto, em fração da barra. */
  zoneHalf: 0.035,
  /** Quanto o marcador passa da zona antes de contar como erro total. */
  overrun: 0.12,
}

/** Resultado: força (0..1) e erro de impacto em meias-larguras da zona (0 = centro). */
export interface PowerBarResult {
  percent: number
  impact: number
}

/** Posição da zona de impacto na barra (fração a partir da esquerda). */
const ZONE = 0.06

export function createPowerBar() {
  const k = POWER_BAR_TUNING
  const root = document.createElement('div')
  root.className = 'power-bar'
  root.innerHTML = `
    <div class="track">
      <div class="zone"></div>
      <div class="fill"></div>
      <div class="power"></div>
      <div class="marker"></div>
    </div>
    <div class="label">Espaço: começar</div>`
  root.hidden = true
  document.body.appendChild(root)
  const track = root.querySelector('.track') as HTMLDivElement
  const fill = root.querySelector('.fill') as HTMLDivElement
  const powerMark = root.querySelector('.power') as HTMLDivElement
  const marker = root.querySelector('.marker') as HTMLDivElement
  const label = root.querySelector('.label') as HTMLDivElement
  const zone = root.querySelector('.zone') as HTMLDivElement
  zone.style.left = `${(ZONE - k.zoneHalf) * 100}%`
  zone.style.width = `${k.zoneHalf * 2 * 100}%`

  let stage: 'idle' | 'rising' | 'returning' = 'idle'
  let started = 0
  let power = 0
  /** Última posição desenhada: os toques valem pelo que o jogador viu na tela. */
  let shown = 0
  let raf = 0
  let finish: ((result: PowerBarResult) => void) | undefined

  /** Posição atual do marcador (fração da barra). */
  const position = (now: number) => {
    const t = (now - started) / 1000
    if (stage === 'rising') return Math.min(1, t / k.riseSeconds)
    // Volta da força escolhida até a zona e um pouco além.
    const speed = (1 - ZONE) / k.returnSeconds
    return power - t * speed
  }

  const draw = (now: number) => {
    if (stage === 'idle') return
    const p = position(now)
    shown = p
    marker.style.left = `${Math.max(0, p) * 100}%`
    if (stage === 'rising') {
      fill.style.width = `${p * 100}%`
      if (p >= 1) setPower(now, 1) // chegou no máximo: 100%
    } else if (p < ZONE - k.zoneHalf - k.overrun) {
      done(-(1 + k.overrun / k.zoneHalf)) // passou da zona sem apertar
      return
    }
    raf = requestAnimationFrame(draw)
  }

  const setPower = (now: number, at = shown) => {
    power = Math.max(0.01, at)
    powerMark.style.left = `${power * 100}%`
    powerMark.hidden = false
    stage = 'returning'
    started = now
    label.textContent = `${Math.round(power * 100)}% · espaço na zona amarela`
  }

  const done = (impact: number) => {
    cancelAnimationFrame(raf)
    stage = 'idle'
    root.classList.add('done')
    const result = { percent: power, impact }
    label.textContent =
      Math.abs(impact) <= 0.2 ? '✨ PANGYA!' : Math.abs(impact) <= 1 ? 'Boa!' : 'Errou a zona'
    setTimeout(() => {
      root.hidden = true
      root.classList.remove('done')
    }, 900)
    finish?.(result)
  }

  return {
    get active() {
      return stage !== 'idle'
    },
    /** Começa a barra; `onDone` recebe a força e o erro de impacto. */
    start(onDone: (result: PowerBarResult) => void, initialLabel = 'Espaço: fixar a força') {
      finish = onDone
      stage = 'rising'
      started = performance.now()
      power = 0
      shown = 0
      root.hidden = false
      root.classList.remove('done')
      powerMark.hidden = true
      fill.style.width = '0'
      label.textContent = initialLabel
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

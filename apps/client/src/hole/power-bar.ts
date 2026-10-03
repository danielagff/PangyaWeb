/**
 * Barra de força no visual do Pangya original, sempre visível, com três toques de espaço:
 * 1º começa (o marcador corre da esquerda para a direita), 2º fixa a força,
 * 3º acerta o impacto quando o marcador volta à zona da esquerda.
 *
 * Desenho (como a barra 3W de referência do Daniel): moldura branca arredondada, trilho
 * escuro, preenchimento azul com divisões, zona PANGYA rosa à esquerda, faixa vermelha na
 * ponta, marcador cinza (polegar), jardas do meio e do máximo embaixo e "Max" em cima da
 * ponta. Na volta, um "Click" laranja com a seta aponta onde apertar. Se o marcador passa da
 * zona sem o 3º toque, a tacada é cancelada (o jogador desistiu de bater naquela hora) e ele
 * volta a mirar.
 *
 * Calibrador (para acertar uma força exata): um triângulo verde em cima da barra com as
 * jardas; embaixo, "Callipers" com as teclas Z e X. Com o mouse em cima da barra aparecem
 * marcas a cada 1% e a leitura do ponto; clicar (ou arrastar) põe o triângulo ali, botão
 * direito tira. Sem mouse: X sobe e Z desce 0,1% (Shift: 1%); segurando, continua. Com
 * `setSnapToMark` (desenvolvimento, só sozinho), o 2º toque de espaço fixa exatamente a força
 * do calibrador. "Sempre PANGYA" (desenvolvimento): o impacto sai sempre perfeito — sozinho,
 * no ponto PANGYA, ou no 3º toque.
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
  /** Marcador passou da zona sem o 3º toque: tacada cancelada. */
  onCancel?: () => void
  /** Força fixada (2º toque ou chegou ao máximo): fração da barra. */
  onPower?: (power: number) => void
}

const IDLE_LABEL = 'Espaço: começar · roda do mouse: taco · Alt: power shot'

/** Ponteiro do calibrador (fração da barra), salvo neste navegador. */
const CALIBRATOR_KEY = 'pangyaweb.calibrador'
function readCalibrator(): number | undefined {
  try {
    const raw = localStorage.getItem(CALIBRATOR_KEY)
    const value = raw === null ? NaN : Number(raw)
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined
  } catch {
    return undefined
  }
}
function saveCalibrator(value: number | undefined) {
  try {
    if (value === undefined) localStorage.removeItem(CALIBRATOR_KEY)
    else localStorage.setItem(CALIBRATOR_KEY, String(value))
  } catch {
    // sem armazenamento: vale só nesta página
  }
}

/** Passo do Z/X no calibrador (fração da barra): 0,1%; com Shift, 1%. */
export const CALIBRATOR_STEP = { fine: 0.001, coarse: 0.01 }

/** Novo valor do calibrador depois de um passo, preso entre 0 e 100%, em décimos de %. */
export const stepCalibrator = (value: number, steps: number, step = CALIBRATOR_STEP.fine) =>
  Math.min(1, Math.max(0, Math.round((value + steps * step) * 1000) / 1000))

/** Jardas como no HUD do jogo: "249.6y" (ponto, `digits` casas). */
export const yardsText = (yards: number, digits = 1) => `${yards.toFixed(digits)}y`

/** Passo da barra: esperando o 1º toque, subindo (força) ou voltando (impacto). */
export type PowerBarStage = 'idle' | 'rising' | 'returning'

/** Estado da barra a cada quadro (para o mostrador: passo e % de força). */
export interface PowerBarUpdate {
  stage: PowerBarStage
  /** Posição do marcador (fração da barra). */
  position: number
  /** Força fixada (fração), 0 antes do 2º toque. */
  power: number
}

/** "73,5%" (uma casa, vírgula como no Brasil). */
export const percentText = (fraction: number) =>
  `${(Math.round(fraction * 1000) / 10).toFixed(1).replace('.', ',')}%`

export function createPowerBar(parent: HTMLElement = document.body) {
  const k = POWER_BAR_TUNING
  const root = document.createElement('div')
  root.className = 'power-bar'
  root.dataset['stage'] = 'idle'
  root.innerHTML = `
    <div class="readout" hidden></div>
    <div class="max-tag">Max</div>
    <div class="click" hidden>Click<i></i></div>
    <div class="mark" hidden><span></span><i></i></div>
    <div class="track" title="Calibrador: clique para pôr o triângulo (botão direito tira); X sobe, Z desce (Shift: 1%)">
      <div class="fill"></div>
      <div class="ticks"></div>
      <div class="ruler"></div>
      <div class="zone"><div class="pangya"></div></div>
      <div class="end"></div>
      <div class="power"><span></span></div>
      <div class="guide" hidden></div>
      <div class="marker"></div>
    </div>
    <div class="scale">
      <span class="tag half"></span>
      <span class="tag max"></span>
    </div>
    <div class="callipers">Callipers <kbd>Z</kbd><kbd>X</kbd></div>
    <div class="label">${IDLE_LABEL}</div>`
  parent.appendChild(root)
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
  const click = $<HTMLDivElement>('.click')
  zone.style.left = `${(ZONE - k.zoneHalf) * 100}%`
  zone.style.width = `${k.zoneHalf * 2 * 100}%`
  // Faixa da tacada perfeita, centralizada na zona.
  pangya.style.left = `${50 - PANGYA_WINDOW * 50}%`
  pangya.style.width = `${PANGYA_WINDOW * 100}%`
  click.style.left = `${ZONE * 100}%`
  powerMark.hidden = true
  const guide = $<HTMLDivElement>('.guide')
  const readout = $<HTMLDivElement>('.readout')

  let stage: PowerBarStage = 'idle'
  let started = 0
  let power = 0
  let maxYards = 0
  /** Última posição desenhada: os toques valem pelo que o jogador viu na tela. */
  let shown = 0
  let raf = 0
  let resetTimer = 0
  /** Texto do repouso pedido por fora (batendo, vez de outro…); vazio = IDLE_LABEL. */
  let idleText = ''
  let finish: ((result: PowerBarResult) => void) | undefined
  let cancelled: (() => void) | undefined
  let powered: ((power: number) => void) | undefined
  /** Impacto sempre perfeito (desenvolvimento: testar a física). */
  let autoPangya = false
  /** Ponto da régua sob o mouse (fração da barra), undefined = mouse fora. */
  let hover: number | undefined
  /** Ponteiro do calibrador (fração da barra). */
  let calibrator = readCalibrator()
  /** Distância do pin (fração da barra), para o calibrador começar nela. */
  let pinFraction: number | undefined
  /** O 2º toque usa a força do calibrador (desenvolvimento, só sozinho). */
  let snap = false
  const snapTarget = () => (snap ? calibrator : undefined)
  const updates: ((update: PowerBarUpdate) => void)[] = []
  const finishes: ((result: PowerBarResult) => void)[] = []
  /** Avisa o mostrador (passo e força) e mostra o "Click" na volta. */
  const notify = (position = shown) => {
    click.hidden = stage !== 'returning' || autoPangya
    root.dataset['stage'] = stage
    for (const listener of updates) listener({ stage, position, power })
  }

  /** Posição atual do marcador (fração da barra). */
  const position = (now: number) => {
    const t = (now - started) / 1000
    if (stage === 'rising') return Math.min(1, t / k.riseSeconds)
    // Volta da força escolhida até a zona e um pouco além.
    const speed = (1 - ZONE) / k.returnSeconds
    return power - t * speed
  }

  const yards = (fraction: number) => (maxYards ? yardsText(maxYards * fraction, 0) : '')
  /** Jardas com uma casa (calibrador e régua); sem escala, a %. */
  const fineYards = (fraction: number) =>
    maxYards ? yardsText(maxYards * fraction) : percentText(fraction)
  const rulerText = (fraction: number) =>
    maxYards ? `${percentText(fraction)} · ${fineYards(fraction)}` : percentText(fraction)

  /** Desenha a linha do mouse (com a leitura) e o ponteiro do calibrador. */
  const drawRuler = () => {
    guide.hidden = readout.hidden = hover === undefined
    root.classList.toggle('ruling', hover !== undefined)
    if (hover !== undefined) {
      guide.style.left = readout.style.left = `${hover * 100}%`
      readout.textContent = rulerText(hover)
    }
    const line = $<HTMLDivElement>('.mark')
    line.hidden = calibrator === undefined
    if (calibrator === undefined) return
    line.style.left = `${calibrator * 100}%`
    line.querySelector('span')!.textContent = fineYards(calibrator)
    line.title = rulerText(calibrator)
  }
  const setCalibrator = (value: number | undefined) => {
    calibrator = value
    saveCalibrator(value)
    drawRuler()
  }
  const fractionAt = (e: PointerEvent) => {
    const rect = track.getBoundingClientRect()
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
  }
  let dragging = false
  track.addEventListener('pointerenter', (e) => {
    hover = fractionAt(e)
    drawRuler()
  })
  track.addEventListener('pointermove', (e) => {
    hover = fractionAt(e)
    if (dragging) setCalibrator(stepCalibrator(hover, 0))
    else drawRuler()
  })
  track.addEventListener('pointerleave', () => {
    hover = undefined
    drawRuler()
  })
  // Clique põe o ponteiro (arrastando, ele acompanha); botão direito tira.
  track.addEventListener('pointerdown', (e) => {
    if (e.button === 2) {
      setCalibrator(undefined)
      return
    }
    if (e.button !== 0) return
    dragging = true
    track.setPointerCapture(e.pointerId)
    setCalibrator(stepCalibrator(fractionAt(e), 0))
  })
  track.addEventListener('pointerup', () => (dragging = false))
  track.addEventListener('pointercancel', () => (dragging = false))
  track.addEventListener('contextmenu', (e) => e.preventDefault())
  /** X sobe, Z desce o calibrador (0,1%; Shift: 1%). Sem ponteiro, começa no pin. */
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    const direction = e.code === 'KeyX' ? 1 : e.code === 'KeyZ' ? -1 : 0
    if (!direction) return
    if (calibrator === undefined) {
      setCalibrator(stepCalibrator(pinFraction ?? 1, 0))
      return
    }
    const step = e.shiftKey ? CALIBRATOR_STEP.coarse : CALIBRATOR_STEP.fine
    setCalibrator(stepCalibrator(calibrator, direction, step))
  }
  window.addEventListener('keydown', onKey)
  drawRuler()

  const draw = (now: number) => {
    if (stage === 'idle') return
    const p = position(now)
    shown = p
    marker.style.left = `${Math.max(0, p) * 100}%`
    notify(p)
    if (stage === 'rising') {
      fill.style.width = `${p * 100}%`
      const target = snapTarget()
      label.textContent =
        target === undefined
          ? `${percentText(p)} ${yards(p)} · espaço: fixar a força`
          : `${percentText(p)} · espaço: força do calibrador (${percentText(target)})`
      if (p >= 1) setPower(now, 1) // chegou no máximo: 100%
    } else if (autoPangya && p <= ZONE) {
      // Sempre PANGYA: bate sozinho no centro da zona.
      shown = ZONE
      marker.style.left = `${ZONE * 100}%`
      done(0)
      return
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
    // Com a marca da régua selecionada, a força é exatamente a dela.
    power = Math.max(0.01, snapTarget() ?? at)
    fill.style.width = `${power * 100}%`
    powerMark.style.left = `${power * 100}%`
    powerText.textContent = yards(power) || `${Math.round(power * 100)}%`
    powerMark.hidden = false
    stage = 'returning'
    started = now
    notify(power)
    powered?.(power)
    label.textContent = autoPangya
      ? `${percentText(power)} ${yards(power)} · sempre PANGYA: o impacto sai sozinho`
      : `${percentText(power)} ${yards(power)} · espaço no PANGYA (rosa)`
  }

  /** Volta a barra ao repouso (sempre visível) pouco depois do resultado. */
  const resetSoon = () => {
    clearTimeout(resetTimer)
    resetTimer = window.setTimeout(() => {
      if (stage !== 'idle') return
      root.classList.remove('done', 'cancelled')
      fill.style.width = '0'
      marker.style.left = '0'
      powerMark.hidden = true
      label.textContent = idleText || IDLE_LABEL
    }, 1200)
  }

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
    notify()
    resetSoon()
    for (const listener of finishes) listener({ percent: power, impact })
    finish?.({ percent: power, impact })
  }

  /** Passou da zona sem o toque: o jogador desistiu de bater agora. */
  const giveUp = () => {
    cancelAnimationFrame(raf)
    stage = 'idle'
    root.classList.remove('near')
    root.classList.add('cancelled')
    label.textContent = 'Tacada cancelada — espaço para tentar de novo'
    power = 0
    notify(0)
    resetSoon()
    cancelled?.()
  }

  return {
    get active() {
      return stage !== 'idle'
    },
    /** Subindo: o próximo toque fixa a força. */
    get rising() {
      return stage === 'rising'
    },
    /** Escala em jardas do taco atual (100% da barra). */
    setScale(yardsAt100: number) {
      maxYards = yardsAt100
      half.textContent = yards(0.5)
      max.textContent = yards(1)
      drawRuler()
    },
    /** Põe o calibrador numa força exata (fração da barra; a calculadora usa). */
    setCalibratorValue(value: number) {
      setCalibrator(Math.min(1, Math.max(0, value)))
    },
    /** Liga/desliga o 2º toque usar a força do calibrador. */
    setSnapToMark(on: boolean) {
      snap = on
      root.classList.toggle('snap', on)
    },
    /** Liga/desliga o "sempre PANGYA" (impacto perfeito em toda tacada). */
    setAutoPangya(on: boolean) {
      autoPangya = on
      root.classList.toggle('auto-pangya', on)
      click.hidden = stage !== 'returning' || on
    },
    /**
     * Distância até o pin (jardas; undefined = sem pin). Não aparece na barra: serve para o
     * calibrador começar nela.
     */
    setPinDistance(yardsToPin: number | undefined) {
      const fraction = yardsToPin !== undefined && maxYards ? yardsToPin / maxYards : undefined
      pinFraction = fraction !== undefined && fraction <= 1.02 ? Math.min(1, fraction) : undefined
    },
    /** Começa a barra; `onDone` recebe a força e o erro de impacto. */
    start(onDone: (result: PowerBarResult) => void, options: PowerBarOptions = {}) {
      clearTimeout(resetTimer)
      finish = onDone
      cancelled = options.onCancel
      powered = options.onPower
      stage = 'rising'
      started = performance.now()
      power = 0
      shown = 0
      root.classList.remove('done', 'cancelled', 'near')
      powerMark.hidden = true
      fill.style.width = '0'
      marker.style.left = '0'
      label.textContent = options.label ?? 'Espaço: fixar a força'
      notify(0)
      raf = requestAnimationFrame(draw)
    },
    /** Toque de espaço com a barra ativa. */
    press() {
      const now = performance.now()
      if (stage === 'rising') setPower(now)
      else if (stage === 'returning') done(autoPangya ? 0 : (shown - ZONE) / k.zoneHalf)
    },
    /** Interrompe (troca de vez, fim do buraco) e volta ao repouso. */
    cancel() {
      cancelAnimationFrame(raf)
      stage = 'idle'
      root.classList.remove('done', 'cancelled', 'near')
      fill.style.width = '0'
      marker.style.left = '0'
      powerMark.hidden = true
      label.textContent = idleText || IDLE_LABEL
      power = 0
      notify(0)
    },
    /** A cada quadro e troca de passo: passo, posição do marcador e força fixada. */
    onUpdate(listener: (update: PowerBarUpdate) => void) {
      updates.push(listener)
    },
    /** Fim do 3º toque (força e erro de impacto), além do `onDone` de `start`. */
    onFinish(listener: (result: PowerBarResult) => void) {
      finishes.push(listener)
    },
    /** Texto da barra (vez de outro jogador, batendo…). */
    setLabel(text: string) {
      idleText = text
      if (stage === 'idle') label.textContent = text || IDLE_LABEL
    },
    dispose() {
      cancelAnimationFrame(raf)
      clearTimeout(resetTimer)
      window.removeEventListener('keydown', onKey)
      root.remove()
    },
    track,
  }
}

export type PowerBar = ReturnType<typeof createPowerBar>

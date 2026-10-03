/**
 * Barra de força no visual do Pangya original, sempre visível, com três toques de espaço:
 * 1º começa (o marcador corre da esquerda para a direita), 2º fixa a força,
 * 3º acerta o impacto quando o marcador volta à zona da esquerda.
 *
 * O desenho é o componente <pb-bar> (hud/pb-components.ts, o mesmo do HTML de base do
 * Daniel); aqui fica só a lógica, que muda os atributos dele (value, position, power,
 * target, stage…). Na volta, um "Click" laranja com a seta aponta onde apertar. Se o marcador passa da
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
import type { PbBar } from './hud/pb-components.ts'
import { pbBarZone } from './hud/pb-geometry.ts'

export const POWER_BAR_TUNING = {
  /** Segundos para o marcador ir de 0 a 100%. */
  riseSeconds: 1.1,
  /** Segundos para voltar de 100% até a zona de impacto. */
  returnSeconds: 1.1,
  /** Meia-largura da zona de impacto, em fração da escala (a faixa branca do desenho). */
  zoneHalf: pbBarZone().half,
}

/** Erro de impacto (em meias-larguras da zona) que ainda conta como PANGYA (tacada perfeita). */
const PANGYA_WINDOW = IMPACT_TUNING.pangyaZone

/** Resultado: força (0..1) e erro de impacto em meias-larguras da zona (0 = centro). */
export interface PowerBarResult {
  percent: number
  impact: number
}

/**
 * Zona de impacto do desenho do <pb-bar> (frações da escala: 0 = início, 1 = máximo): o
 * ponto PANGYA é a faixa magenta no começo da escala, a zona é a faixa branca à esquerda
 * dela e o cursor pode voltar até o começo da trilha.
 */
const BAR_ZONE = pbBarZone()
const ZONE = BAR_ZONE.center

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

/** Valor de atributo (fração → texto, com até 4 casas). */
const num = (value: number) => String(Math.round(value * 10000) / 10000)

/**
 * Lógica da barra sobre o componente <pb-bar> (`bar`); `label` recebe o texto de ajuda
 * (vez de outro jogador, batendo…).
 */
export function createPowerBar(bar: PbBar, label: HTMLElement) {
  const k = POWER_BAR_TUNING
  label.textContent = IDLE_LABEL

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
  /** Ponteiro do calibrador (fração da barra). */
  let calibrator = readCalibrator()
  /** Distância do pin (fração da barra), para o calibrador começar nela. */
  let pinFraction: number | undefined
  /** O 2º toque usa a força do calibrador (desenvolvimento, só sozinho). */
  let snap = false
  const snapTarget = () => (snap ? calibrator : undefined)
  const updates: ((update: PowerBarUpdate) => void)[] = []
  const finishes: ((result: PowerBarResult) => void)[] = []

  /** Atributos do <pb-bar> em jardas (`max`). */
  const scaled = (fraction: number) => num(fraction * (maxYards || 256))
  /** Cursor em `at` (fração da escala; negativo = na zona de impacto). */
  const drawBar = (at: number) => bar.setAttribute('value', scaled(at))
  const showPower = (value: number | undefined) => {
    if (value === undefined) bar.removeAttribute('power')
    else bar.setAttribute('power', scaled(value))
  }
  /** Avisa o mostrador (passo e força) e o desenho (o "Click" aparece na volta). */
  const notify = (position = shown) => {
    bar.setAttribute('stage', stage)
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

  const drawCalibrator = () => {
    if (calibrator === undefined) bar.removeAttribute('target')
    else bar.setAttribute('target', scaled(calibrator))
  }
  const setCalibrator = (value: number | undefined) => {
    calibrator = value
    saveCalibrator(value)
    drawCalibrator()
  }
  // Mouse na barra: régua com a leitura; clique põe o calibrador (arrastando, acompanha);
  // botão direito tira.
  let dragging = false
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
  const onPointer = (e: PointerEvent) => {
    const fraction = clamp01(bar.scaleAt(e))
    if (e.type === 'pointerleave') bar.removeAttribute('hover')
    else bar.setAttribute('hover', num(fraction))
    if (e.type === 'pointerdown') {
      if (e.button === 2) setCalibrator(undefined)
      else if (e.button === 0) {
        dragging = true
        bar.setPointerCapture(e.pointerId)
        setCalibrator(stepCalibrator(fraction, 0))
      }
    } else if (e.type === 'pointermove' && dragging) setCalibrator(stepCalibrator(fraction, 0))
    else if (e.type === 'pointerup' || e.type === 'pointercancel') dragging = false
  }
  const pointerEvents = [
    'pointerenter',
    'pointermove',
    'pointerleave',
    'pointerdown',
    'pointerup',
    'pointercancel',
  ] as const
  for (const type of pointerEvents) bar.addEventListener(type, onPointer)
  const noMenu = (e: Event) => e.preventDefault()
  bar.addEventListener('contextmenu', noMenu)
  bar.title =
    'Calibrador: clique para pôr o triângulo (botão direito tira); X sobe, Z desce (Shift: 1%)'
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
  drawCalibrator()
  drawBar(0)

  const draw = (now: number) => {
    if (stage === 'idle') return
    const p = position(now)
    shown = p
    drawBar(p)
    notify(p)
    if (stage === 'rising') {
      const target = snapTarget()
      label.textContent =
        target === undefined
          ? `${percentText(p)} ${yards(p)} · espaço: fixar a força`
          : `${percentText(p)} · espaço: força do calibrador (${percentText(target)})`
      if (p >= 1) setPower(now, 1) // chegou no máximo: 100%
    } else if (autoPangya && p <= ZONE) {
      // Sempre PANGYA: bate sozinho no centro da zona.
      shown = ZONE
      drawBar(ZONE)
      done(0)
      return
    } else {
      // Passou da zona e chegou ao começo da trilha: desistiu.
      if (p <= BAR_ZONE.floor) {
        giveUp()
        return
      }
    }
    raf = requestAnimationFrame(draw)
  }

  const setPower = (now: number, at = shown) => {
    // Com o calibrador no modo "2º toque usa a força dele", a força é exatamente a dele.
    power = Math.max(0.01, snapTarget() ?? at)
    drawBar(power)
    showPower(power)
    stage = 'returning'
    started = now
    notify(power)
    powered?.(power)
    label.textContent = autoPangya
      ? `${percentText(power)} ${yards(power)} · sempre PANGYA: o impacto sai sozinho`
      : `${percentText(power)} ${yards(power)} · espaço na zona (faixa branca)`
  }

  const rest = () => {
    drawBar(0)
    showPower(undefined)
    label.textContent = idleText || IDLE_LABEL
  }

  /** Volta a barra ao repouso (sempre visível) pouco depois do resultado. */
  const resetSoon = () => {
    clearTimeout(resetTimer)
    resetTimer = window.setTimeout(() => {
      if (stage === 'idle') rest()
    }, 1200)
  }

  const done = (impact: number) => {
    cancelAnimationFrame(raf)
    stage = 'idle'
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
      if (yardsAt100 === maxYards) return
      maxYards = yardsAt100
      bar.setAttribute('max', num(yardsAt100))
      drawBar(stage === 'idle' ? 0 : shown)
      if (stage === 'returning') showPower(power)
      drawCalibrator()
    },
    /** Põe o calibrador numa força exata (fração da barra; a calculadora usa). */
    setCalibratorValue(value: number) {
      setCalibrator(Math.min(1, Math.max(0, value)))
    },
    /** Liga/desliga o 2º toque usar a força do calibrador. */
    setSnapToMark(on: boolean) {
      snap = on
      drawCalibrator()
    },
    /** Liga/desliga o "sempre PANGYA" (impacto perfeito em toda tacada). */
    setAutoPangya(on: boolean) {
      autoPangya = on
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
      rest()
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
      power = 0
      rest()
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
    /** Texto de ajuda (vez de outro jogador, batendo…). */
    setLabel(text: string) {
      idleText = text
      if (stage === 'idle') label.textContent = text || IDLE_LABEL
    },
    dispose() {
      cancelAnimationFrame(raf)
      clearTimeout(resetTimer)
      window.removeEventListener('keydown', onKey)
      for (const type of pointerEvents) bar.removeEventListener(type, onPointer)
      bar.removeEventListener('contextmenu', noMenu)
    },
  }
}

export type PowerBar = ReturnType<typeof createPowerBar>

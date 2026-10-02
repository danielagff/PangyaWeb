/**
 * Barra de força no estilo do Pangya, sempre visível, com três toques de espaço:
 * 1º começa (o marcador corre da esquerda para a direita), 2º fixa a força,
 * 3º acerta o impacto quando o marcador volta à zona da esquerda.
 *
 * Acima da barra, a escala em jardas do taco (meio e máximo); uma linha vermelha marca a
 * distância até o pin. A zona de impacto fica à esquerda, com o ponto da tacada perfeita
 * ("PANGYA") marcado no meio dela. Se o marcador passa da zona sem o 3º toque, a tacada é
 * cancelada (o jogador desistiu de bater naquela hora) e ele volta a mirar.
 *
 * Régua (para acertar uma força exata): com o mouse em cima da barra aparecem marcas a cada
 * 1% e a força/jardas daquele ponto; Z e X marcam esse ponto na barra (fora da barra, apagam).
 * A última marca feita fica selecionada; com `setSnapToMark` (desenvolvimento, só sozinho),
 * o 2º toque de espaço fixa exatamente a força dela.
 * "Sempre PANGYA" (desenvolvimento): o impacto sai sempre perfeito — sozinho, no ponto
 * PANGYA, ou no 3º toque.
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
}

const IDLE_LABEL = 'Espaço: começar · roda do mouse: taco · Alt: power shot'

/**
 * Marcas da régua (Z e X), em fração da barra, e qual está selecionada (a última feita);
 * ficam salvas neste navegador.
 */
type MarkKey = 'z' | 'x'
type RulerMarks = Partial<Record<MarkKey, number>> & { sel?: MarkKey }
const MARKS_KEY = 'pangyaweb.regua'
function readMarks(): RulerMarks {
  try {
    const value = JSON.parse(localStorage.getItem(MARKS_KEY) ?? '{}') as RulerMarks
    const valid = (n: unknown) => typeof n === 'number' && n >= 0 && n <= 1
    const marks: RulerMarks = {
      ...(valid(value.z) && { z: value.z! }),
      ...(valid(value.x) && { x: value.x! }),
    }
    const sel = value.sel && marks[value.sel] !== undefined ? value.sel : marks.x ? 'x' : 'z'
    return marks[sel] === undefined ? marks : { ...marks, sel }
  } catch {
    return {}
  }
}
function saveMarks(marks: RulerMarks) {
  try {
    localStorage.setItem(MARKS_KEY, JSON.stringify(marks))
  } catch {
    // sem armazenamento: as marcas valem só nesta página
  }
}

/** "73,5%" (uma casa, vírgula como no Brasil). */
export const percentText = (fraction: number) =>
  `${(Math.round(fraction * 1000) / 10).toFixed(1).replace('.', ',')}%`

export function createPowerBar(parent: HTMLElement = document.body) {
  const k = POWER_BAR_TUNING
  const root = document.createElement('div')
  root.className = 'power-bar'
  root.innerHTML = `
    <div class="readout" hidden></div>
    <div class="scale">
      <span class="tag pangya-tag">PANGYA</span>
      <span class="tag half"></span>
      <span class="tag max"></span>
      <span class="tag pin-tag"></span>
    </div>
    <div class="track" title="Régua: o mouse mostra a força e as jardas; Z/X marcam o ponto (fora da barra, apagam)">
      <div class="ticks"></div>
      <div class="ruler"></div>
      <div class="fill"></div>
      <div class="zone"><div class="pangya"></div></div>
      <div class="power"><span></span></div>
      <div class="pin"></div>
      <div class="mark" data-mark="z" hidden><span></span></div>
      <div class="mark" data-mark="x" hidden><span></span></div>
      <div class="guide" hidden></div>
      <div class="marker"></div>
    </div>
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
  const pin = $<HTMLDivElement>('.pin')
  const pinTag = $<HTMLSpanElement>('.pin-tag')
  zone.style.left = `${(ZONE - k.zoneHalf) * 100}%`
  zone.style.width = `${k.zoneHalf * 2 * 100}%`
  // Faixa da tacada perfeita, centralizada na zona.
  pangya.style.left = `${50 - PANGYA_WINDOW * 50}%`
  pangya.style.width = `${PANGYA_WINDOW * 100}%`
  $<HTMLSpanElement>('.pangya-tag').style.left = `${ZONE * 100}%`
  powerMark.hidden = true
  const guide = $<HTMLDivElement>('.guide')
  const readout = $<HTMLDivElement>('.readout')

  let stage: 'idle' | 'rising' | 'returning' = 'idle'
  let started = 0
  let power = 0
  let maxYards = 0
  /** Última posição desenhada: os toques valem pelo que o jogador viu na tela. */
  let shown = 0
  let raf = 0
  let resetTimer = 0
  let finish: ((result: PowerBarResult) => void) | undefined
  let cancelled: (() => void) | undefined
  /** Impacto sempre perfeito (desenvolvimento: testar a física). */
  let autoPangya = false
  /** Ponto da régua sob o mouse (fração da barra), undefined = mouse fora. */
  let hover: number | undefined
  let marks = readMarks()
  /** O 2º toque usa a força da marca selecionada (desenvolvimento, só sozinho). */
  let snap = false
  const snapTarget = () => (snap && marks.sel ? marks[marks.sel] : undefined)

  /** Posição atual do marcador (fração da barra). */
  const position = (now: number) => {
    const t = (now - started) / 1000
    if (stage === 'rising') return Math.min(1, t / k.riseSeconds)
    // Volta da força escolhida até a zona e um pouco além.
    const speed = (1 - ZONE) / k.returnSeconds
    return power - t * speed
  }

  const yards = (fraction: number) => (maxYards ? `${Math.round(maxYards * fraction)}y` : '')
  /** Jardas com uma casa (régua). */
  const fineYards = (fraction: number) =>
    maxYards ? `${(maxYards * fraction).toFixed(1).replace('.', ',')}y` : ''
  const rulerText = (fraction: number) =>
    [percentText(fraction), fineYards(fraction)].filter(Boolean).join(' · ')

  /** Desenha a linha do mouse e as marcas Z/X com a força e as jardas de cada uma. */
  const drawRuler = () => {
    guide.hidden = readout.hidden = hover === undefined
    root.classList.toggle('ruling', hover !== undefined)
    if (hover !== undefined) {
      guide.style.left = readout.style.left = `${hover * 100}%`
      readout.textContent = rulerText(hover)
    }
    for (const key of ['z', 'x'] as const) {
      const at = marks[key]
      const line = root.querySelector<HTMLElement>(`.mark[data-mark="${key}"]`)!
      line.hidden = at === undefined
      line.classList.toggle('selected', at !== undefined && marks.sel === key)
      if (at === undefined) continue
      line.style.left = `${at * 100}%`
      // Perto do fim da barra, o texto fica do lado esquerdo da linha.
      line.classList.toggle('flip', at > 0.85)
      line.querySelector('span')!.textContent = `${key.toUpperCase()} ${rulerText(at)}`
    }
  }
  const hoverAt = (e: PointerEvent) => {
    const rect = track.getBoundingClientRect()
    hover = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    drawRuler()
  }
  track.addEventListener('pointermove', hoverAt)
  track.addEventListener('pointerenter', hoverAt)
  track.addEventListener('pointerleave', () => {
    hover = undefined
    drawRuler()
  })
  /**
   * Z/X: marca o ponto sob o mouse (e seleciona essa marca); com o mouse fora da barra,
   * apaga a marca (a outra, se houver, fica selecionada).
   */
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    const key: MarkKey | undefined = e.code === 'KeyZ' ? 'z' : e.code === 'KeyX' ? 'x' : undefined
    if (!key || e.repeat) return
    if (hover === undefined) {
      const other: MarkKey = key === 'z' ? 'x' : 'z'
      const rest: RulerMarks = marks[other] === undefined ? {} : { [other]: marks[other] }
      const sel = marks.sel === key ? (rest[other] !== undefined ? other : undefined) : marks.sel
      marks = sel ? { ...rest, sel } : rest
    } else {
      marks = { ...marks, [key]: hover, sel: key }
    }
    saveMarks(marks)
    drawRuler()
  }
  window.addEventListener('keydown', onKey)
  drawRuler()

  const draw = (now: number) => {
    if (stage === 'idle') return
    const p = position(now)
    shown = p
    marker.style.left = `${Math.max(0, p) * 100}%`
    if (stage === 'rising') {
      fill.style.width = `${p * 100}%`
      const target = snapTarget()
      label.textContent =
        target === undefined
          ? `${percentText(p)} ${yards(p)} · espaço: fixar a força`
          : `${percentText(p)} · espaço: força da marca ${marks.sel!.toUpperCase()} (${percentText(target)})`
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
      label.textContent = IDLE_LABEL
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
    resetSoon()
    finish?.({ percent: power, impact })
  }

  /** Passou da zona sem o toque: o jogador desistiu de bater agora. */
  const giveUp = () => {
    cancelAnimationFrame(raf)
    stage = 'idle'
    root.classList.remove('near')
    root.classList.add('cancelled')
    label.textContent = 'Tacada cancelada — espaço para tentar de novo'
    resetSoon()
    cancelled?.()
  }

  return {
    get active() {
      return stage !== 'idle'
    },
    /** Escala em jardas do taco atual (100% da barra). */
    setScale(yardsAt100: number) {
      maxYards = yardsAt100
      half.textContent = yards(0.5)
      max.textContent = yards(1)
      drawRuler()
    },
    /** Liga/desliga o 2º toque usar a força da marca selecionada da régua. */
    setSnapToMark(on: boolean) {
      snap = on
      root.classList.toggle('snap', on)
    },
    /** Liga/desliga o "sempre PANGYA" (impacto perfeito em toda tacada). */
    setAutoPangya(on: boolean) {
      autoPangya = on
      root.classList.toggle('auto-pangya', on)
    },
    /** Linha vermelha da distância até o pin (undefined = esconde). */
    setPin(yardsToPin: number | undefined, text = '') {
      const fraction = yardsToPin !== undefined && maxYards ? yardsToPin / maxYards : undefined
      const visible = fraction !== undefined && fraction <= 1.02
      pin.hidden = pinTag.hidden = !visible
      if (!visible) return
      pin.style.left = pinTag.style.left = `${Math.min(1, fraction) * 100}%`
      pinTag.textContent = text
    },
    /** Começa a barra; `onDone` recebe a força e o erro de impacto. */
    start(onDone: (result: PowerBarResult) => void, options: PowerBarOptions = {}) {
      clearTimeout(resetTimer)
      finish = onDone
      cancelled = options.onCancel
      stage = 'rising'
      started = performance.now()
      power = 0
      shown = 0
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
      label.textContent = IDLE_LABEL
    },
    /** Texto embaixo da barra (vez de outro jogador, batendo…). */
    setLabel(text: string) {
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

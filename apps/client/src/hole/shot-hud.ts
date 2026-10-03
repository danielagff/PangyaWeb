/**
 * HUD da tacada no visual do Pangya original (embaixo da tela). Tudo é desenhado numa caixa
 * de 1620×380 unidades de design (como o HTML de base do Daniel), escalada para a tela:
 * - mostrador redondo: a bola (clique/arraste: spin e curva; duplo clique centraliza), a % de
 *   força e, depois da batida, "PangYa" com o nº de PANGYAs seguidos; o taco num círculo no
 *   canto de cima (roda do mouse troca); um arco do lado com os ícones (itens, chat); um
 *   círculo pequeno embaixo com a força do personagem; o power shot (Alt: 1 toque = 1 PS,
 *   2 toques rápidos = 2 PS, de novo = desliga);
 * - a aba do passo embaixo-à-direita do mostrador ("Start", "Power", "Impact");
 * - a barra de força (power-bar.ts) com o calibrador;
 * - durante o voo, os contadores no centro de baixo (distância percorrida em branco e até o
 *   pin em vermelho); quando a bola para, o piso, "Distance" e a distância até o pin.
 * Habilidades do power shot (tomahawk, spike, cobra) ficam para depois: a tacada é normal.
 */
import { isPangya, PUTT_RANGE } from '@pangya/game'
import { CLUB_IDS, type ClubId, type PowerShot, type SpecialShot } from '@pangya/physics'
import { createPowerBar, yardsText, type PowerBarStage } from './power-bar.ts'

export { PUTT_RANGE }

/** Tacos na ordem da roda do mouse (o putter PT1 por último). */
export const HUD_CLUBS: ClubId[] = CLUB_IDS.filter((c) => c !== 'PT2')

/** Intervalo (ms) entre dois toques de Alt para virar 2 PS. */
const DOUBLE_ALT_MS = 350

export interface ShotHudInput {
  club: ClubId
  /** Força da barra, 0..1. */
  percent: number
  shot: SpecialShot
  powerShot: PowerShot
  /** Ponto de impacto, -1..1 (positivo = backspin / curva à direita). */
  spin: number
  curve: number
}

const clubLabel = (club: ClubId) => (club === 'PT1' ? 'PT' : club)

/** Tamanho da caixa do HUD, em unidades de design. */
export const HUD_DESIGN = { width: 1620, height: 380 }
/** Altura máxima do HUD (fração da altura da tela). */
const HUD_MAX_HEIGHT = 0.3

/** Escala da caixa de design para a tela (cabe na largura e em HUD_MAX_HEIGHT da altura). */
export const hudScale = (width: number, height: number) =>
  Math.min(1, width / HUD_DESIGN.width, (height * HUD_MAX_HEIGHT) / HUD_DESIGN.height)

/** Texto da aba do passo da barra. */
const STEP_LABELS: Record<PowerBarStage, string> = {
  idle: 'Start',
  rising: 'Power',
  returning: 'Impact',
}

/** Onde a bola parou, para o quadro do fim da tacada. */
export interface ShotStop {
  /** Piso ("Fairway", "Green"…). */
  surface: string
  /** Distância da tacada (jardas). */
  distance: number
  /** Distância até o pin (jardas); undefined = embocou. */
  toPin: number | undefined
}

export function createShotHud(onShoot: () => void) {
  const root = document.createElement('div')
  root.className = 'shot-hud'
  root.innerHTML = `
    <p class="result" aria-live="polite"></p>
    <div class="frame">
      <div class="box">
        <div class="dial">
          <div class="face">
            <div class="streak" hidden>PangYa <b></b></div>
            <div class="impact" title="Ponto de impacto: clique ou arraste (spin e curva); duplo clique centraliza">
              <div class="cross"></div><div class="dot"></div>
            </div>
            <div class="percent">0%</div>
            <div class="ps" title="Power shot (Alt: 1 toque = 1 PS, 2 toques rápidos = 2 PS)">
              <span></span><span></span>
            </div>
          </div>
          <div class="arc">
            <span class="icon" title="Itens (em breve)">🎒</span>
            <span class="icon" title="Chat">💬</span>
          </div>
          <div class="club" title="Taco (roda do mouse)">1W</div>
          <div class="stat" title="Força do personagem">15</div>
        </div>
        <div class="step"><span>Start</span><i></i></div>
        <div class="counters" hidden>
          <div class="traveled"></div>
          <div class="to-pin"></div>
        </div>
        <div class="stop" hidden>
          <div class="surface"></div>
          <div class="distance"></div>
          <div class="to-pin"></div>
        </div>
      </div>
    </div>`
  document.body.appendChild(root)
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector(selector) as T
  const result = $<HTMLParagraphElement>('.result')
  const clubBox = $<HTMLDivElement>('.club')
  const impact = $<HTMLDivElement>('.impact')
  const dot = $<HTMLDivElement>('.dot')
  const pips = [...root.querySelectorAll<HTMLSpanElement>('.ps span')]
  const stat = $<HTMLDivElement>('.stat')
  const frame = $<HTMLDivElement>('.frame')
  const box = $<HTMLDivElement>('.box')
  const percentBox = $<HTMLDivElement>('.percent')
  const streakBox = $<HTMLDivElement>('.streak')
  const step = $<HTMLSpanElement>('.step span')
  const counters = $<HTMLDivElement>('.counters')
  const stop = $<HTMLDivElement>('.stop')
  const bar = createPowerBar(box)

  // A caixa de design (1620×380) escalada para caber embaixo da tela.
  const fit = () => {
    const scale = hudScale(window.innerWidth, window.innerHeight)
    frame.style.width = `${HUD_DESIGN.width * scale}px`
    frame.style.height = `${HUD_DESIGN.height * scale}px`
    box.style.transform = `scale(${scale})`
  }
  window.addEventListener('resize', fit)
  fit()

  /** PANGYAs seguidos (nas tacadas deste jogador). */
  let streak = 0
  const showInfo = (which: 'counters' | 'stop' | undefined) => {
    counters.hidden = which !== 'counters'
    stop.hidden = which !== 'stop'
  }
  bar.onUpdate(({ stage, position, power }) => {
    step.textContent = STEP_LABELS[stage]
    root.dataset['stage'] = stage
    const shown = stage === 'rising' ? position : power
    percentBox.textContent = `${Math.round(shown * 100)}%`
    if (stage === 'rising' && position === 0) {
      // Nova tacada: some o "PangYa" e o quadro da tacada anterior.
      streakBox.hidden = true
      showInfo(undefined)
    }
  })
  bar.onFinish(({ impact }) => {
    streak = isPangya(impact) ? streak + 1 : 0
    streakBox.hidden = streak === 0
    streakBox.querySelector('b')!.textContent = streak > 1 ? `×${streak}` : ''
  })

  const input: ShotHudInput = {
    club: '1W',
    percent: 1,
    shot: 'dunk',
    powerShot: 'none',
    spin: 0,
    curve: 0,
  }
  let enabled = true
  let lastAlt = 0
  const listeners: (() => void)[] = []
  const changed = () => {
    clubBox.textContent = clubLabel(input.club)
    dot.style.left = `${50 + input.curve * 40}%`
    dot.style.top = `${50 + input.spin * 40}%`
    const count = input.powerShot === 'two' ? 2 : input.powerShot === 'one' ? 1 : 0
    pips.forEach((pip, i) => pip.classList.toggle('on', i < count))
    root.classList.toggle('power-shot', count > 0)
    listeners.forEach((l) => l())
  }

  // Ponto de impacto: posição do clique dentro do círculo da bola.
  let aimingImpact = false
  const setImpact = (e: PointerEvent) => {
    const rect = impact.getBoundingClientRect()
    let x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    let y = ((e.clientY - rect.top) / rect.height) * 2 - 1
    const length = Math.hypot(x, y)
    if (length > 1) {
      x /= length
      y /= length
    }
    input.curve = Math.round(x * 30) / 30
    input.spin = Math.round(y * 30) / 30
    changed()
  }
  impact.addEventListener('pointerdown', (e) => {
    if (!enabled) return
    aimingImpact = true
    impact.setPointerCapture(e.pointerId)
    setImpact(e)
  })
  impact.addEventListener('pointermove', (e) => aimingImpact && setImpact(e))
  impact.addEventListener('pointerup', () => (aimingImpact = false))
  impact.addEventListener('dblclick', () => {
    if (!enabled) return
    input.spin = input.curve = 0
    changed()
  })

  const onKey = (e: KeyboardEvent) => {
    const typing = e.target instanceof HTMLInputElement && e.target.type !== 'range'
    if (typing) return
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault()
      onShoot() // também serve para pular a animação, então vale mesmo desativado
    }
    if (e.code === 'AltLeft' || e.code === 'AltRight') {
      e.preventDefault() // senão o navegador foca o menu
      if (e.repeat || !enabled || bar.active) return
      const now = performance.now()
      const quick = now - lastAlt < DOUBLE_ALT_MS
      lastAlt = now
      input.powerShot =
        quick && input.powerShot === 'one' ? 'two' : input.powerShot === 'none' ? 'one' : 'none'
      changed()
    }
  }
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault()
  }
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKeyUp)
  changed()

  return {
    bar,
    showResult(text: string) {
      result.textContent = text
    },
    read: (): ShotHudInput => ({ ...input }),
    setClub(club: ClubId) {
      input.club = club
      changed()
    },
    /** Roda do mouse: próximo (+1) ou anterior (-1) taco. */
    cycleClub(direction: 1 | -1) {
      if (!enabled || bar.active) return
      const i = HUD_CLUBS.indexOf(input.club)
      const next = HUD_CLUBS[Math.min(HUD_CLUBS.length - 1, Math.max(0, i + direction))]!
      if (next === input.club) return
      input.club = next
      changed()
    },
    setPercent(percent: number) {
      input.percent = Math.min(1, Math.max(0.01, percent))
    },
    /** Ponto de impacto na bola (spin e curva, -1..1). */
    setImpact(spin: number, curve: number) {
      input.spin = spin
      input.curve = curve
      changed()
    },
    /** Novo buraco/tacada: tira o power shot e centraliza o impacto. */
    resetShot() {
      input.powerShot = 'none'
      input.spin = input.curve = 0
      changed()
    },
    /** Força do personagem mostrada no mostrador. */
    setPower(power: number) {
      stat.textContent = String(power)
    },
    /** Contadores do voo: distância percorrida (branco) e até o pin (vermelho), em jardas. */
    showFlight(traveled: number, toPin: number) {
      showInfo('counters')
      counters.querySelector('.traveled')!.textContent = yardsText(traveled, 2)
      counters.querySelector('.to-pin')!.textContent = yardsText(toPin, 2)
    },
    /** A bola parou: piso, distância da tacada e até o pin. */
    showStop({ surface, distance, toPin }: ShotStop) {
      showInfo('stop')
      stop.querySelector('.surface')!.textContent = surface
      stop.querySelector('.distance')!.textContent = `Distance: ${yardsText(distance, 2)}`
      stop.querySelector('.to-pin')!.textContent =
        toPin === undefined ? '' : `Pin: ${yardsText(toPin, 2)}`
    },
    /** Esconde os contadores do voo e o quadro do fim da tacada. */
    hideShotInfo() {
      showInfo(undefined)
    },
    /** Liga/desliga os controles (vez de outro jogador). */
    setEnabled(on: boolean, label = '') {
      enabled = on
      root.classList.toggle('waiting', !on)
      bar.setLabel(label)
    },
    /** Avisa quando taco, power shot ou impacto mudam. */
    onChange: (listener: () => void) => listeners.push(listener),
    dispose() {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', fit)
      bar.dispose()
      root.remove()
    },
  }
}

export type ShotHud = ReturnType<typeof createShotHud>

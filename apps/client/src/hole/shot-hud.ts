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
import {
  definePbComponents,
  type PbBar,
  type PbGauge,
  type PbImpactDetail,
  type PbSocket,
  type PbTab,
} from './hud/pb-components.ts'
import { ballImage } from './hud/ball-image.ts'
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
  definePbComponents()
  const root = document.createElement('div')
  root.className = 'shot-hud'
  // Mesmos componentes e coordenadas do HTML de base (unidades de design 1620 × 380; a
  // ordem define a sobreposição).
  root.innerHTML = `
    <p class="result" aria-live="polite"></p>
    <p class="bar-label"></p>
    <div class="stage">
      <div class="counters" hidden>
        <div class="traveled"></div>
        <div class="to-pin"></div>
      </div>
      <div class="stop" hidden>
        <div class="surface"></div>
        <div class="distance"></div>
        <div class="to-pin"></div>
      </div>
      <power-bar>
        <pb-arc-panel cx="177" cy="210" inner="157" outer="214" start="-70" end="-8" sections="2" slot="17" icons="flask,chat"></pb-arc-panel>
        <pb-bar x="320" y="180" w="1290" h="100" max="256" value="0"></pb-bar>
        <pb-gauge cx="177" cy="210" r="157" track="143" inner="133" value="0"></pb-gauge>
        <pb-tab x="312" y="245" w="148" h="77" radius="12" label="Start"></pb-tab>
        <pb-socket class="club" cx="71" cy="94" r="61" inner="44" thick label="1W" title="Taco (roda do mouse)"></pb-socket>
        <pb-socket class="spin" cx="250" cy="330" r="40" inner="30" label="−" label-color="#2196f3" title="Spin: clique centraliza o ponto de impacto"></pb-socket>
      </power-bar>
    </div>`
  document.body.appendChild(root)
  const $ = <T extends Element>(selector: string) => root.querySelector(selector) as T
  const result = $<HTMLParagraphElement>('.result')
  const gauge = $<PbGauge>('pb-gauge')
  const tab = $<PbTab>('pb-tab')
  const clubSocket = $<PbSocket>('pb-socket.club')
  const spinSocket = $<PbSocket>('pb-socket.spin')
  const counters = $<HTMLDivElement>('.counters')
  const stop = $<HTMLDivElement>('.stop')
  const bar = createPowerBar($<PbBar>('pb-bar'), $<HTMLDivElement>('.bar-label'))

  /** PANGYAs seguidos (nas tacadas deste jogador). */
  let streak = 0
  const showInfo = (which: 'counters' | 'stop' | undefined) => {
    counters.hidden = which !== 'counters'
    stop.hidden = which !== 'stop'
  }
  bar.onUpdate(({ stage, position, power }) => {
    tab.setAttribute('label', STEP_LABELS[stage])
    root.dataset['stage'] = stage
    const shown = stage === 'rising' ? position : power
    gauge.setAttribute('value', String(Math.round(Math.max(0, shown) * 100)))
    if (stage === 'rising' && position === 0) {
      // Nova tacada: some o "PangYa" e o quadro da tacada anterior.
      gauge.setAttribute('streak', '0')
      showInfo(undefined)
    }
  })
  bar.onFinish(({ impact }) => {
    streak = isPangya(impact) ? streak + 1 : 0
    gauge.setAttribute('streak', String(streak))
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
    clubSocket.setAttribute('label', clubLabel(input.club))
    gauge.setAttribute('curve', String(input.curve))
    gauge.setAttribute('spin', String(input.spin))
    const count = input.powerShot === 'two' ? 2 : input.powerShot === 'one' ? 1 : 0
    gauge.setAttribute('ps', String(count))
    root.classList.toggle('power-shot', count > 0)
    listeners.forEach((l) => l())
  }

  // Botão de spin ("−"): centraliza o ponto de impacto.
  spinSocket.style.pointerEvents = 'auto'
  spinSocket.style.cursor = 'pointer'
  spinSocket.addEventListener('click', () => {
    if (!enabled) return
    input.spin = input.curve = 0
    changed()
  })

  // Ponto de impacto: clique/arraste na bola do mostrador; duplo clique centraliza.
  let aimingImpact = false
  gauge.addEventListener('pb-impact', (e) => {
    const { type, x, y } = (e as CustomEvent<PbImpactDetail>).detail
    if (!enabled) return
    if (type === 'reset') {
      input.spin = input.curve = 0
      changed()
      return
    }
    if (type === 'down') aimingImpact = true
    if (type === 'up') aimingImpact = false
    if (!aimingImpact && type !== 'up') return
    if (type === 'up') return
    const length = Math.hypot(x, y)
    const scale = length > 1 ? 1 / length : 1
    input.curve = Math.round(x * scale * 30) / 30
    input.spin = Math.round(y * scale * 30) / 30
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
  let shownBall: string | undefined

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
    /** Força do personagem (na dica do mostrador). */
    setPower(power: number) {
      gauge.setAttribute('title', `Força do personagem: ${power}`)
    },
    /** A bola do jogador (modelo do jogo) no mostrador; sem ela, a bola branca. */
    setBall(model: string | undefined) {
      shownBall = model
      if (!model) {
        gauge.removeAttribute('ball')
        return
      }
      void ballImage(model).then((url) => {
        if (shownBall !== model) return
        if (url) gauge.setAttribute('ball', url)
        else gauge.removeAttribute('ball')
      })
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
      bar.dispose()
      root.remove()
    },
  }
}

export type ShotHud = ReturnType<typeof createShotHud>

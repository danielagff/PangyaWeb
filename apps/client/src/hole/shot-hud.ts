/**
 * HUD da tacada no estilo do Pangya (embaixo da tela), no lugar do painel lateral:
 * - mostrador redondo com o taco (roda do mouse troca), o ponto de impacto na bola
 *   (clique/arraste: spin e curva; duplo clique centraliza), o power shot (Alt: 1 toque =
 *   1 PS, 2 toques rápidos = 2 PS, de novo = desliga) e a força do personagem;
 * - a barra de força sempre visível (3 toques de espaço), com a escala de jardas e o pin.
 * Habilidades do power shot (tomahawk, spike, cobra) ficam para depois: a tacada é normal.
 */
import { PUTT_RANGE } from '@pangya/game'
import { CLUB_IDS, type ClubId, type PowerShot, type SpecialShot } from '@pangya/physics'
import { createPowerBar } from './power-bar.ts'

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

export function createShotHud(onShoot: () => void) {
  const root = document.createElement('div')
  root.className = 'shot-hud'
  root.innerHTML = `
    <p class="result" aria-live="polite"></p>
    <div class="row">
      <div class="dial">
        <div class="club" title="Taco (roda do mouse)">1W</div>
        <div class="impact" title="Ponto de impacto: clique ou arraste (spin e curva); duplo clique centraliza">
          <div class="cross"></div><div class="dot"></div>
        </div>
        <div class="ps" title="Power shot (Alt: 1 toque = 1 PS, 2 toques rápidos = 2 PS)">
          <span></span><span></span>
        </div>
        <div class="stat" title="Força do personagem">15</div>
      </div>
      <div class="bar-slot"></div>
    </div>`
  document.body.appendChild(root)
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector(selector) as T
  const result = $<HTMLParagraphElement>('.result')
  const clubBox = $<HTMLDivElement>('.club')
  const impact = $<HTMLDivElement>('.impact')
  const dot = $<HTMLDivElement>('.dot')
  const pips = [...root.querySelectorAll<HTMLSpanElement>('.ps span')]
  const stat = $<HTMLDivElement>('.stat')
  const bar = createPowerBar($<HTMLDivElement>('.bar-slot'))

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

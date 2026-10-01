// Cálculo de força e alcance da tacada.
// Portado de SuperSS-Dev (https://github.com/Acrisio-Filho/SuperSS-Dev),
// "Smart Calculator App/smart_calculator.js"
// Copyright (c) 2021 Acrisio Fragoso Vieira Filho — Licença MIT

import type { ClubPhysics } from './clubs.ts'

export type PowerShot = 'none' | 'one' | 'two' | 'item15'

/** Bônus de força vindos de equipamento; os `ps*` só valem com power shot. */
export interface PowerBonus {
  auxpart: number
  mascot: number
  card: number
  psAuxpart: number
  psMascot: number
  psCard: number
}

export interface PlayerPower {
  /** Atributo power total (personagem + taco + slots). */
  power: number
  bonus: PowerBonus
}

export const NO_BONUS: PowerBonus = {
  auxpart: 0,
  mascot: 0,
  card: 0,
  psAuxpart: 0,
  psMascot: 0,
  psCard: 0,
}

/** Faixa de distância até o alvo; muda o comportamento de wedges. */
export type DistanceBand = 'lt10' | 'lt15' | 'lt28' | 'lt58' | 'ge58'

export function distanceBand(yards: number): DistanceBand {
  if (yards >= 58) return 'ge58'
  if (yards < 10) return 'lt10'
  if (yards < 15) return 'lt15'
  if (yards < 28) return 'lt28'
  return 'lt58'
}

const isShortBand = (band: DistanceBand) => band === 'lt10' || band === 'lt15' || band === 'lt28'

export function powerShotBonus(ps: PowerShot): number {
  return { none: 0, one: 10, two: 20, item15: 15 }[ps]
}

export function totalBonus(bonus: PowerBonus, ps: PowerShot): number {
  const base = bonus.auxpart + bonus.mascot + bonus.card
  return ps === 'none' ? base : base + bonus.psAuxpart + bonus.psMascot + bonus.psCard
}

/** Constante de spin por grau usada no ângulo de saída (rad). */
export const SPIN_DEGREE_FACTOR = 0.0698131695389748

/** Força inicial da bola (unidades/s) a 100% da barra. */
export function launchPower(
  club: ClubPhysics,
  band: DistanceBand,
  player: PlayerPower,
  ps: PowerShot,
  spin: number,
): number {
  const extra = totalBonus(player.bonus, ps)
  const psBonus = powerShotBonus(ps)

  switch (club.category) {
    case 'wood':
      return (
        (((extra + psBonus + (player.power - 15) * 2) * 1.5) / club.powerBase + 1) *
        club.powerFactor
      )
    case 'iron':
      return (
        (psBonus / club.powerBase + 1) * club.powerFactor +
        (extra * club.powerFactor * 1.3) / club.powerBase
      )
    case 'wedge': {
      const extraPart = (extra * club.powerFactor) / club.powerBase
      if (band === 'ge58') return (psBonus / club.powerBase + 1) * club.powerFactor + extraPart
      const loft = (club.degree * Math.PI) / 180
      const byDegree = 0.5 + (0.5 * (loft + spin * SPIN_DEGREE_FACTOR)) / ((56 / 180) * Math.PI)
      const usePs = ps !== 'none'
      const base = isShortBand(band) ? 52 + (usePs ? 28 : 0) : 80 + (usePs ? 18 : 0)
      return byDegree * base + extraPart
    }
    case 'putter':
      return club.powerFactor
  }
}

/** Rotação de backspin inicial a 100% da barra. */
export function spinPower(player: PlayerPower, ps: PowerShot): number {
  const { auxpart, mascot, card, psCard } = player.bonus
  let value = (auxpart + mascot + card) / 2 + (player.power - 15)
  if (ps !== 'none') value += psCard / 2
  return value / 170 + 1.5
}

/** Alcance máximo exibido no HUD, em jardas (100% da barra, sem vento). */
export function powerRange(
  club: ClubPhysics,
  band: DistanceBand,
  player: PlayerPower,
  ps: PowerShot,
): number {
  const extra = totalBonus(player.bonus, ps)
  const usePs = ps !== 'none'

  if (club.category === 'wedge' && band !== 'ge58') {
    return isShortBand(band) ? 30 + (usePs ? 30 : 0) + extra : 60 + (usePs ? 20 : 0) + extra
  }
  let range = club.powerBase + extra + powerShotBonus(ps)
  if (club.category === 'wood') range += (player.power - 15) * 2
  return range
}

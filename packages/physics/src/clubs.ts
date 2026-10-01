// Tabela de tacos da física do Pangya (JP).
// Portado de SuperSS-Dev (https://github.com/Acrisio-Filho/SuperSS-Dev),
// "Smart Calculator App/smart_calculator.js"
// Copyright (c) 2021 Acrisio Fragoso Vieira Filho — Licença MIT

export type ClubCategory = 'wood' | 'iron' | 'wedge' | 'putter'

export interface ClubPhysics {
  category: ClubCategory
  /** Multiplicador da sustentação causada pelo spin. */
  rotationSpin: number
  /** Multiplicador da força lateral causada pela curva. */
  rotationCurve: number
  powerFactor: number
  /** Ângulo de saída (loft), em graus. */
  degree: number
  /** Distância base, em jardas. */
  powerBase: number
}

const club = (
  category: ClubCategory,
  rotationSpin: number,
  rotationCurve: number,
  powerFactor: number,
  degree: number,
  powerBase: number,
): ClubPhysics => ({ category, rotationSpin, rotationCurve, powerFactor, degree, powerBase })

export const CLUBS = {
  '1W': club('wood', 0.55, 1.61, 236, 10, 230),
  '2W': club('wood', 0.5, 1.41, 204, 13, 210),
  '3W': club('wood', 0.45, 1.26, 176, 16, 190),
  '2I': club('iron', 0.45, 1.07, 161, 20, 180),
  '3I': club('iron', 0.45, 0.95, 149, 24, 170),
  '4I': club('iron', 0.45, 0.83, 139, 28, 160),
  '5I': club('iron', 0.45, 0.73, 131, 32, 150),
  '6I': club('iron', 0.41, 0.67, 124, 36, 140),
  '7I': club('iron', 0.36, 0.61, 118, 40, 130),
  '8I': club('iron', 0.3, 0.57, 114, 44, 120),
  '9I': club('iron', 0.25, 0.53, 110, 48, 110),
  PW: club('wedge', 0.18, 0.49, 107, 52, 100),
  SW: club('wedge', 0.17, 0.42, 93, 56, 80),
  PT1: club('putter', 0, 0, 30, 0, 20),
  PT2: club('putter', 0, 0, 21, 0, 10),
} as const satisfies Record<string, ClubPhysics>

export type ClubId = keyof typeof CLUBS
export const CLUB_IDS = Object.keys(CLUBS) as ClubId[]

/**
 * Unidades da simulação. O Pangya simula em "unidades do jogo": 1 jarda = 3,2 unidades,
 * eixo Y para cima, a tacada sai na direção +Z.
 */
export const UNITS_PER_YARD = 3.2
export const METERS_PER_YARD = 0.9144

export const yardsToUnits = (yd: number) => yd * UNITS_PER_YARD
export const unitsToYards = (u: number) => u / UNITS_PER_YARD
/** Altura em metros (como no HUD do jogo) → unidades. */
export const metersToUnits = (m: number) => m * 1.094 * UNITS_PER_YARD

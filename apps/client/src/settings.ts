/**
 * Configurações do jogador escolhidas antes da partida (guardadas neste navegador).
 * Por enquanto: a força (atributo power) do personagem.
 */
import { clampPower, DEFAULT_POWER, POWER_LIMITS } from '@pangya/game'
import { CLUBS, NO_BONUS, powerRange } from '@pangya/physics'

const POWER_KEY = 'pangyaweb.forca'

/**
 * Velocidade com que a tacada (voo e rolagem) é tocada na tela: 1 = o tempo da física. Só a
 * animação fica mais lenta — o caminho e onde a bola para não mudam.
 */
export const BALL_PLAYBACK_SPEED = 0.8

/** Força do personagem escolhida (padrão: a da calculadora do SuperSS). */
export function playerPower(): number {
  try {
    const saved = Number(localStorage.getItem(POWER_KEY))
    return localStorage.getItem(POWER_KEY) !== null && Number.isFinite(saved)
      ? clampPower(saved)
      : DEFAULT_POWER
  } catch {
    return DEFAULT_POWER
  }
}

function savePower(power: number) {
  try {
    localStorage.setItem(POWER_KEY, String(clampPower(power)))
  } catch {
    // sem armazenamento: vale só nesta página
  }
}

/** Alcance do HUD do 1W com essa força (para mostrar ao escolher). */
const driverRange = (power: number) =>
  Math.round(powerRange(CLUBS['1W'], 'ge58', { power, bonus: NO_BONUS }, 'none'))

/** Campo "Força do personagem" com o alcance do 1W ao lado; salva ao mudar. */
export function powerInput(): HTMLLabelElement {
  const label = document.createElement('label')
  label.className = 'power-setting'
  label.innerHTML = `Força do personagem
    <input type="number" min="${POWER_LIMITS.min}" max="${POWER_LIMITS.max}" step="1" />
    <small></small>`
  const input = label.querySelector('input') as HTMLInputElement
  const hint = label.querySelector('small') as HTMLElement
  const show = () => {
    const power = clampPower(Number(input.value) || 0)
    hint.textContent = `1W chega a ${driverRange(power)}y a 100%`
  }
  input.value = String(playerPower())
  show()
  input.addEventListener('input', () => {
    show()
    savePower(Number(input.value) || 0)
  })
  return label
}

/**
 * Volumes do jogo (geral, música, efeitos, vozes) e o mudo, num bloco que abre e fecha.
 * Muda na hora e fica lembrado no navegador.
 */
import { sound, type Volumes } from './sounds.ts'

const LABELS: [keyof Volumes, string][] = [
  ['master', 'Geral'],
  ['music', 'Música'],
  ['effects', 'Efeitos'],
  ['voices', 'Vozes'],
]

export function volumePanel(): HTMLDetailsElement {
  const box = document.createElement('details')
  box.className = 'volume-panel'
  box.innerHTML = `<summary>🔊 Som</summary>
    ${LABELS.map(
      ([key, label]) => `<label>${label}
        <input type="range" name="${key}" min="0" max="1" step="0.05" value="${sound.volumes[key]}" />
        <output>${Math.round(sound.volumes[key] * 100)}%</output></label>`,
    ).join('')}
    <label class="mute"><input type="checkbox" name="mute" ${sound.muted ? 'checked' : ''} /> Mudo (V no jogo)</label>`
  for (const [key] of LABELS) {
    const input = box.querySelector<HTMLInputElement>(`input[name=${key}]`)!
    const output = input.nextElementSibling as HTMLOutputElement
    input.addEventListener('input', () => {
      sound.setVolume(key, Number(input.value))
      output.textContent = `${Math.round(Number(input.value) * 100)}%`
      if (key !== 'music') void sound.play('uiMove')
    })
  }
  const mute = box.querySelector<HTMLInputElement>('input[name=mute]')!
  mute.addEventListener('change', () => {
    if (mute.checked !== sound.muted) sound.toggleMute()
  })
  return box
}

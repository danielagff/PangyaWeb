import {
  CLUB_IDS,
  type ClubId,
  type PowerShot,
  type ShotInput,
  type SpecialShot,
} from '@pangya/physics'

/** Painel HTML com os parâmetros da tacada. */
export function createShotPanel(onShoot: (input: ShotInput) => void) {
  const panel = document.createElement('form')
  panel.className = 'panel'
  panel.innerHTML = `
    <h1>PangyaWeb — física</h1>
    <label>Taco <select name="club">${CLUB_IDS.filter((c) => !c.startsWith('PT'))
      .map((c) => `<option>${c}</option>`)
      .join('')}</select></label>
    <label>Força <output name="percentOut">100%</output>
      <input name="percent" type="range" min="10" max="100" value="100" /></label>
    <label>Tacada <select name="shot">
      <option value="dunk">Normal</option><option value="tomahawk">Tomahawk</option>
      <option value="spike">Spike</option><option value="cobra">Cobra</option></select></label>
    <label>Power shot <select name="powerShot">
      <option value="none">Não</option><option value="one">1 PS</option>
      <option value="two">2 PS</option></select></label>
    <label>Spin <output name="spinOut">0</output>
      <input name="spin" type="range" min="-30" max="30" value="0" /></label>
    <label>Curva <output name="curveOut">0</output>
      <input name="curve" type="range" min="-30" max="30" value="0" /></label>
    <label>Vento <output name="windOut">0 m</output>
      <input name="wind" type="range" min="0" max="9" value="0" /></label>
    <label>Direção do vento <output name="windDegOut">0°</output>
      <input name="windDeg" type="range" min="0" max="359" value="0" /></label>
    <button type="submit">Bater (espaço)</button>
    <p class="result" aria-live="polite"></p>
  `
  document.body.appendChild(panel)

  const field = (name: string) => panel.elements.namedItem(name) as HTMLInputElement
  const out = (name: string) => panel.elements.namedItem(name) as HTMLOutputElement
  const sync = () => {
    out('percentOut').value = `${field('percent').value}%`
    out('spinOut').value = field('spin').value
    out('curveOut').value = field('curve').value
    out('windOut').value = `${field('wind').value} m`
    out('windDegOut').value = `${field('windDeg').value}°`
  }
  panel.addEventListener('input', sync)
  sync()

  const read = (): ShotInput => ({
    club: field('club').value as ClubId,
    player: {
      power: 15,
      bonus: { auxpart: 0, mascot: 0, card: 0, psAuxpart: 0, psMascot: 0, psCard: 0 },
    },
    percent: Number(field('percent').value) / 100,
    shot: field('shot').value as SpecialShot,
    powerShot: field('powerShot').value as PowerShot,
    spin: Number(field('spin').value) / 30,
    curve: Number(field('curve').value) / 30,
    wind: { speed: Number(field('wind').value), degree: Number(field('windDeg').value) },
  })

  panel.addEventListener('submit', (e) => {
    e.preventDefault()
    onShoot(read())
  })
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !(e.target instanceof HTMLSelectElement)) {
      e.preventDefault()
      onShoot(read())
    }
  })

  const result = panel.querySelector('.result') as HTMLParagraphElement
  return {
    showResult(text: string) {
      result.textContent = text
    },
  }
}

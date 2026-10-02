import {
  CLUB_IDS,
  type ClubId,
  type PowerShot,
  type ShotInput,
  type SpecialShot,
} from '@pangya/physics'

export interface ShotPanelOptions {
  title?: string
  /** Inclui o putter (PT1) na lista de tacos. */
  putter?: boolean
}

/** Alcance do putter (PT1) a 100% da barra, em jardas. */
export const PUTT_RANGE = 30

/** Painel HTML com os parâmetros da tacada. */
export function createShotPanel(
  onShoot: (input: ShotInput) => void,
  options: ShotPanelOptions = {},
) {
  const clubs = CLUB_IDS.filter((c) => (options.putter ? c !== 'PT2' : !c.startsWith('PT')))
  const panel = document.createElement('form')
  panel.className = 'panel'
  panel.innerHTML = `
    <h1>${options.title ?? 'PangyaWeb — física'}</h1>
    <label>Taco <select name="club">${clubs
      .map((c) => `<option value="${c}">${c === 'PT1' ? 'PT (putter)' : c}</option>`)
      .join('')}</select></label>
    <label>Força <output name="percentOut">100%</output>
      <input name="percent" type="range" min="1" max="100" value="100" /></label>
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
  const listeners: (() => void)[] = []
  const sync = () => {
    const percent = Number(field('percent').value)
    out('percentOut').value =
      field('club').value === 'PT1'
        ? `${percent}% (${((percent / 100) * PUTT_RANGE).toFixed(1)}y)`
        : `${percent}%`
    out('spinOut').value = field('spin').value
    out('curveOut').value = field('curve').value
    out('windOut').value = `${field('wind').value} m`
    out('windDegOut').value = `${field('windDeg').value}°`
  }
  panel.addEventListener('input', sync)
  panel.addEventListener('change', sync)
  panel.addEventListener('input', () => listeners.forEach((l) => l()))
  panel.addEventListener('change', () => listeners.forEach((l) => l()))
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
    if (e.code === 'Space' && !(e.target instanceof HTMLSelectElement) && !e.repeat) {
      e.preventDefault()
      onShoot(read())
    }
  })

  const result = panel.querySelector('.result') as HTMLParagraphElement
  const set = (name: string, value: string | number) => {
    field(name).value = String(value)
    sync()
    listeners.forEach((l) => l())
  }
  return {
    showResult(text: string) {
      result.textContent = text
    },
    read,
    setClub: (club: ClubId) => set('club', club),
    setPercent: (percent: number) => set('percent', Math.round(percent * 100)),
    setWind(speed: number, degree: number) {
      field('wind').value = String(speed)
      set('windDeg', degree)
    },
    /** Avisa quando qualquer parâmetro muda (pelo usuário ou pelos métodos acima). */
    onChange: (listener: () => void) => listeners.push(listener),
  }
}

/**
 * Letreiro da batida, como no jogo: a folha data/2d/font/[impact_x3.png (384×768) tem um
 * letreiro por faixa — Bad, PangYa, Power Spin, Power Curve, Tomahawk, Max, Super PangYa,
 * Cobra, Spike, Power Tomahawk, Power Cobra, Power Spike. Mostra o recorte por cima da barra,
 * crescendo e sumindo.
 */
import { findAsset, tryFetchBytes } from './assets.ts'

export type ImpactLabel =
  | 'bad'
  | 'pangya'
  | 'powerSpin'
  | 'powerCurve'
  | 'tomahawk'
  | 'max'
  | 'superPangya'
  | 'cobra'
  | 'spike'
  | 'powerTomahawk'
  | 'powerCobra'
  | 'powerSpike'

const SHEET = { file: '[impact_x3.png', width: 384, height: 768 }
/** Faixa (y de cima e de baixo, em pixels da folha) de cada letreiro, medida na imagem. */
const ROWS: Record<ImpactLabel, [number, number]> = {
  bad: [13, 48],
  pangya: [64, 106],
  powerSpin: [117, 160],
  powerCurve: [175, 210],
  tomahawk: [229, 264],
  max: [283, 318],
  superPangya: [334, 376],
  cobra: [388, 423],
  spike: [438, 481],
  powerTomahawk: [496, 531],
  powerCobra: [550, 585],
  powerSpike: [603, 646],
}
/** Quanto tempo o letreiro fica (ms) e a escala na tela. */
const SHOW_MS = 1400
const SCALE = 1

export class ImpactText {
  readonly element = document.createElement('div')
  private url: Promise<string | undefined> | undefined
  private timer = 0

  constructor() {
    this.element.className = 'impact-text'
  }

  private sheet() {
    this.url ??= findAsset(SHEET.file, '')
      .then((path) => (path ? tryFetchBytes(path) : undefined))
      .then((bytes) =>
        bytes
          ? URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/png' }))
          : undefined,
      )
      .catch(() => undefined)
    return this.url
  }

  preload() {
    void this.sheet()
  }

  async show(label: ImpactLabel) {
    const url = await this.sheet()
    if (!url) return
    const [top, bottom] = ROWS[label]
    const el = this.element
    el.style.width = `${SHEET.width * SCALE}px`
    el.style.height = `${(bottom - top) * SCALE}px`
    el.style.backgroundImage = `url("${url}")`
    el.style.backgroundSize = `${SHEET.width * SCALE}px ${SHEET.height * SCALE}px`
    el.style.backgroundPosition = `0 ${-top * SCALE}px`
    // Recomeça a animação (pop e some).
    el.classList.remove('show')
    void el.offsetWidth
    el.classList.add('show')
    clearTimeout(this.timer)
    this.timer = window.setTimeout(() => el.classList.remove('show'), SHOW_MS)
  }

  dispose() {
    clearTimeout(this.timer)
    void this.url?.then((u) => u && URL.revokeObjectURL(u))
  }
}

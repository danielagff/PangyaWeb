/**
 * Componentes do HUD da tacada, os mesmos do HTML de base do Daniel (PowerBar):
 *
 *   <power-bar>
 *     <pb-arc-panel cx="177" cy="210" inner="157" outer="214" start="-70" end="-8"
 *                   sections="2" slot="17" icons="flask,chat"></pb-arc-panel>
 *     <pb-bar x="320" y="180" w="1290" h="100" max="256" value="195" target="249.6"></pb-bar>
 *     <pb-gauge cx="177" cy="210" r="157" track="143" inner="133" value="100"></pb-gauge>
 *     <pb-tab x="312" y="245" w="148" h="77" radius="12" label="Impact"></pb-tab>
 *     <pb-socket cx="71" cy="94" r="61" inner="44" thick label="3W"></pb-socket>
 *     <pb-socket cx="250" cy="330" r="40" inner="30" label="−" label-color="#2196f3"></pb-socket>
 *   </power-bar>
 *
 * Coordenadas em unidades de design (1620 × 380); a ordem dos filhos define a sobreposição.
 * Cada peça desenha um grupo SVG dentro do <svg> do <power-bar>. Tema pelas variáveis CSS
 * do <power-bar>: --pb-stroke, --pb-accent, --pb-fill, --pb-stroke-width, --pb-stroke-thick.
 *
 * Ângulos do arco em graus, 0 = direita, crescendo no sentido horário (como no SVG).
 * Atributos "dinâmicos" (valor, posição, estado) só atualizam o que muda — sem redesenhar
 * tudo a cada quadro e sem perder o arraste do mouse.
 */

const SVG_NS = 'http://www.w3.org/2000/svg'
export const PB_DESIGN = { width: 1620, height: 380 }

type Attrs = Record<string, string | number | undefined>

/** Cria um elemento SVG com atributos (undefined = não põe). */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  parent?: Element,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag)
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== undefined) node.setAttribute(name, String(value))
  }
  parent?.appendChild(node)
  return node
}

/** Texto SVG. */
function text(parent: Element, content: string, attrs: Attrs) {
  const node = svg('text', attrs, parent)
  node.textContent = content
  return node
}

const rad = (deg: number) => (deg * Math.PI) / 180
const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => [
  cx + r * Math.cos(rad(deg)),
  cy + r * Math.sin(rad(deg)),
]

/** Setor de coroa circular (de `start` a `end` graus, entre os raios `inner` e `outer`). */
function annularSector(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  start: number,
  end: number,
) {
  const large = Math.abs(end - start) > 180 ? 1 : 0
  const [ax, ay] = polar(cx, cy, outer, start)
  const [bx, by] = polar(cx, cy, outer, end)
  const [c, d] = polar(cx, cy, inner, end)
  const [e, f] = polar(cx, cy, inner, start)
  return (
    `M${ax},${ay} A${outer},${outer} 0 ${large} 1 ${bx},${by} ` +
    `L${c},${d} A${inner},${inner} 0 ${large} 0 ${e},${f} Z`
  )
}

let uid = 0
const nextId = (prefix: string) => `${prefix}-${++uid}`

/** Ícones de traço (caixa 24 × 24). */
const ICONS: Record<string, string> = {
  flask:
    'M9 3h6M10 3v6.5L4.6 18.7A1.5 1.5 0 0 0 5.9 21h12.2a1.5 1.5 0 0 0 1.3-2.3L14 9.5V3M7 15h10',
  chat: 'M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z',
  bag: 'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2',
}

/** Peça do <power-bar>: desenha um grupo no SVG do pai. */
abstract class PbPart extends HTMLElement {
  readonly group = svg('g')
  private built = false
  /** Atributos que só pedem `update()` (o resto redesenha a peça). */
  protected static dynamic: string[] = []

  num(name: string, fallback = 0) {
    const value = Number(this.getAttribute(name))
    return this.hasAttribute(name) && Number.isFinite(value) ? value : fallback
  }

  connectedCallback() {
    this.style.display = 'none'
    this.redraw()
    ;(this.closest('power-bar') as PowerBarElement | null)?.layout()
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null) {
    if (!this.built || old === value) return
    if ((this.constructor as typeof PbPart).dynamic.includes(name)) this.update()
    else this.redraw()
  }

  redraw() {
    this.group.replaceChildren()
    this.draw(this.group)
    this.built = true
    this.update()
  }

  /** Desenho completo. */
  protected abstract draw(g: SVGGElement): void
  /** Só a parte que muda (valor, posição…). */
  protected update() {}

  /** Ponto do evento em unidades de design. */
  protected designPoint(e: PointerEvent | MouseEvent) {
    const owner = this.group.ownerSVGElement
    const matrix = owner?.getScreenCTM()
    if (!owner || !matrix) return { x: 0, y: 0 }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse())
    return { x: p.x, y: p.y }
  }
}

/** Contêiner: um <svg> 1620 × 380 com os grupos dos filhos, na ordem. */
export class PowerBarElement extends HTMLElement {
  readonly svg = svg('svg', {
    viewBox: `0 0 ${PB_DESIGN.width} ${PB_DESIGN.height}`,
    class: 'pb-svg',
  })

  connectedCallback() {
    if (!this.svg.isConnected) this.prepend(this.svg)
    this.layout()
  }

  /** Põe os grupos dos filhos no SVG, na ordem do HTML (a ordem é a sobreposição). */
  layout() {
    for (const child of this.children) {
      if (child instanceof PbPart) this.svg.appendChild(child.group)
    }
  }
}

/** Painel em arco com os espaços dos ícones (itens, chat…). */
export class PbArcPanel extends PbPart {
  static observedAttributes = [
    'cx',
    'cy',
    'inner',
    'outer',
    'start',
    'end',
    'sections',
    'slot',
    'icons',
  ]

  protected draw(g: SVGGElement) {
    const cx = this.num('cx')
    const cy = this.num('cy')
    const inner = this.num('inner')
    const outer = this.num('outer')
    const start = this.num('start')
    const end = this.num('end')
    const sections = Math.max(1, Math.round(this.num('sections', 1)))
    const slot = this.num('slot', 16)
    const icons = (this.getAttribute('icons') ?? '').split(',').map((s) => s.trim())
    g.setAttribute('class', 'pb-arc-panel')
    svg(
      'path',
      { d: annularSector(cx, cy, inner, outer, start, end), class: 'pb-shape pb-thick' },
      g,
    )
    const step = (end - start) / sections
    const mid = (inner + outer) / 2
    for (let i = 0; i < sections; i++) {
      if (i > 0) {
        const [x1, y1] = polar(cx, cy, inner, start + step * i)
        const [x2, y2] = polar(cx, cy, outer, start + step * i)
        svg('line', { x1, y1, x2, y2, class: 'pb-line' }, g)
      }
      const [x, y] = polar(cx, cy, mid, start + step * (i + 0.5))
      const cell = svg('g', { class: 'pb-slot', 'data-icon': icons[i] ?? '' }, g)
      svg('circle', { cx: x, cy: y, r: slot, class: 'pb-shape pb-line' }, cell)
      const icon = ICONS[icons[i] ?? '']
      if (icon) {
        const size = slot * 1.15
        svg(
          'path',
          {
            d: icon,
            class: 'pb-icon',
            transform: `translate(${x - size / 2},${y - size / 2}) scale(${size / 24})`,
          },
          cell,
        )
      }
      const title = svg('title', {}, cell)
      title.textContent =
        icons[i] === 'chat' ? 'Chat' : icons[i] === 'flask' ? 'Itens (em breve)' : ''
    }
  }
}

/** Evento da barra: ponteiro sobre o trilho (fração da barra, 0..1). */
export interface PbTrackDetail {
  type: 'enter' | 'move' | 'leave' | 'down' | 'up'
  fraction: number
  button: number
}

/**
 * Barra de força: moldura branca arredondada, trilho escuro, preenchimento azul (`value`, em
 * jardas de `max`) com divisões, zona PANGYA rosa à esquerda, faixa vermelha na ponta,
 * polegar cinza, jardas do meio e do máximo embaixo, "Max" em cima da ponta, o calibrador
 * (`target`, triângulo verde com as jardas) e o "Click" laranja (estado "returning").
 */
export class PbBar extends PbPart {
  static observedAttributes = [
    'x',
    'y',
    'w',
    'h',
    'max',
    'zone',
    'zone-half',
    'pangya',
    'value',
    'position',
    'power',
    'target',
    'hover',
    'stage',
    'state',
    'snap',
    'auto',
  ]
  protected static override dynamic = [
    'value',
    'position',
    'power',
    'target',
    'hover',
    'stage',
    'state',
    'snap',
    'auto',
  ]
  private parts: Record<string, SVGElement> = {}

  /** Trilho em unidades de design. */
  track() {
    const x = this.num('x')
    const y = this.num('y')
    const w = this.num('w', 1000)
    const h = this.num('h', 100)
    const x0 = x + h * 0.42
    const x1 = x + w - h * 0.2
    return { x, y, w, h, x0, x1, top: y + h * 0.17, height: h * 0.66 }
  }

  /** Fração da barra → x de design. */
  at(fraction: number) {
    const t = this.track()
    return t.x0 + (t.x1 - t.x0) * fraction
  }

  /** Jardas → fração da barra. */
  private fraction(attr: string) {
    const max = this.num('max', 0)
    if (!this.hasAttribute(attr) || this.getAttribute(attr) === '') return undefined
    const value = this.num(attr)
    return max > 0 ? value / max : value
  }

  protected draw(g: SVGGElement) {
    const t = this.track()
    const max = this.num('max', 0)
    const zone = this.num('zone', 0.06)
    const zoneHalf = this.num('zone-half', 0.035)
    const pangya = this.num('pangya', 0.3)
    const clip = nextId('pb-bar-clip')
    const glow = nextId('pb-bar-fill')
    g.setAttribute('class', 'pb-bar')
    const defs = svg('defs', {}, g)
    const clipPath = svg('clipPath', { id: clip }, defs)
    svg(
      'rect',
      { x: t.x0, y: t.top, width: t.x1 - t.x0, height: t.height, rx: t.height / 2 },
      clipPath,
    )
    const gradient = svg('linearGradient', { id: glow, x1: 0, y1: 0, x2: 0, y2: 1 }, defs)
    svg('stop', { offset: 0, 'stop-color': '#bfeaff' }, gradient)
    svg('stop', { offset: 0.45, class: 'pb-accent-stop' }, gradient)
    svg('stop', { offset: 1, 'stop-color': '#0b6fb0' }, gradient)

    // Moldura branca e trilho escuro.
    svg(
      'rect',
      { x: t.x, y: t.y, width: t.w, height: t.h, rx: t.h / 2, class: 'pb-shape pb-thick pb-frame' },
      g,
    )
    svg(
      'rect',
      {
        x: t.x0,
        y: t.top,
        width: t.x1 - t.x0,
        height: t.height,
        rx: t.height / 2,
        class: 'pb-rail',
      },
      g,
    )
    const inside = svg('g', { 'clip-path': `url(#${clip})` }, g)
    this.parts['fill'] = svg(
      'rect',
      { x: t.x0, y: t.top, width: 0, height: t.height, fill: `url(#${glow})` },
      inside,
    )
    // Divisões a cada 10% (a do meio mais forte).
    for (let i = 1; i < 10; i++) {
      const x = this.at(i / 10)
      svg(
        'line',
        {
          x1: x,
          y1: t.top,
          x2: x,
          y2: t.top + t.height,
          class: i === 5 ? 'pb-div pb-div-half' : 'pb-div',
        },
        inside,
      )
    }
    // Régua do calibrador (com o mouse em cima): marcas a cada 1%.
    const ruler = svg('g', { class: 'pb-ruler' }, inside)
    for (let i = 1; i < 100; i++) {
      const x = this.at(i / 100)
      const long = i % 5 === 0
      svg(
        'line',
        { x1: x, y1: t.top, x2: x, y2: t.top + t.height * (long ? 0.5 : 0.28), class: 'pb-tick' },
        ruler,
      )
    }
    this.parts['ruler'] = ruler
    // Zona PANGYA (rosa), com a faixa perfeita e a linha do centro.
    const zx0 = this.at(zone - zoneHalf)
    const zx1 = this.at(zone + zoneHalf)
    this.parts['zone'] = svg(
      'rect',
      { x: zx0, y: t.top, width: zx1 - zx0, height: t.height, class: 'pb-zone' },
      inside,
    )
    const px0 = this.at(zone - zoneHalf * pangya)
    const px1 = this.at(zone + zoneHalf * pangya)
    svg(
      'rect',
      { x: px0, y: t.top, width: px1 - px0, height: t.height, class: 'pb-pangya' },
      inside,
    )
    svg(
      'line',
      {
        x1: this.at(zone),
        y1: t.top,
        x2: this.at(zone),
        y2: t.top + t.height,
        class: 'pb-pangya-center',
      },
      inside,
    )
    // Faixa vermelha na ponta.
    const ex = this.at(0.975)
    svg('rect', { x: ex, y: t.top, width: t.x1 - ex, height: t.height, class: 'pb-end' }, inside)
    // Força fixada (2º toque).
    const power = svg('g', { class: 'pb-power' }, inside)
    svg('line', { x1: 0, y1: t.top, x2: 0, y2: t.top + t.height }, power)
    this.parts['powerText'] = text(power, '', {
      x: 8,
      y: t.top + t.height - 8,
      class: 'pb-power-text',
    })
    this.parts['power'] = power
    svg(
      'rect',
      {
        x: t.x0,
        y: t.top,
        width: t.x1 - t.x0,
        height: t.height,
        rx: t.height / 2,
        class: 'pb-rail-line',
      },
      g,
    )
    // Guia do mouse.
    this.parts['guide'] = svg(
      'line',
      { y1: t.top - 4, y2: t.top + t.height + 4, class: 'pb-guide' },
      g,
    )

    // Polegar cinza.
    const thumbId = nextId('pb-thumb')
    const thumbGradient = svg('linearGradient', { id: thumbId, x1: 0, y1: 0, x2: 1, y2: 0 }, defs)
    svg('stop', { offset: 0, 'stop-color': '#8d939c' }, thumbGradient)
    svg('stop', { offset: 0.45, 'stop-color': '#f2f4f6' }, thumbGradient)
    svg('stop', { offset: 1, 'stop-color': '#9ea4ad' }, thumbGradient)
    this.parts['thumb'] = svg(
      'rect',
      {
        x: -9,
        y: t.top - 9,
        width: 18,
        height: t.height + 18,
        rx: 7,
        fill: `url(#${thumbId})`,
        class: 'pb-thumb pb-line',
      },
      g,
    )

    // Textos: "Max" em cima da ponta, jardas do meio e do máximo embaixo, "Callipers Z X".
    text(g, 'Max', { x: t.x1 - 4, y: t.y - 10, class: 'pb-label pb-max', 'text-anchor': 'end' })
    if (max > 0) {
      text(g, `${Math.round(max / 2)}y`, {
        x: this.at(0.5),
        y: t.y + t.h + 34,
        class: 'pb-label',
        'text-anchor': 'middle',
      })
      text(g, `${Math.round(max)}y`, {
        x: t.x1,
        y: t.y + t.h + 34,
        class: 'pb-label',
        'text-anchor': 'end',
      })
    }
    const calipers = svg('g', { class: 'pb-callipers' }, g)
    const cy = t.y + t.h + 34
    const cx = t.x + 160
    text(calipers, 'Callipers', { x: cx, y: cy, class: 'pb-label pb-callipers-text' })
    for (const [i, key] of ['Z', 'X'].entries()) {
      const kx = cx + 132 + i * 40
      svg(
        'rect',
        { x: kx, y: cy - 25, width: 32, height: 32, rx: 6, class: 'pb-shape pb-line' },
        calipers,
      )
      text(calipers, key, { x: kx + 16, y: cy, class: 'pb-key', 'text-anchor': 'middle' })
    }

    // Calibrador: triângulo verde com as jardas.
    const target = svg('g', { class: 'pb-target' }, g)
    svg(
      'path',
      { d: `M-13,${t.y - 24} L13,${t.y - 24} L0,${t.y - 2} Z`, class: 'pb-target-mark' },
      target,
    )
    this.parts['targetText'] = text(target, '', {
      x: 0,
      y: t.y - 32,
      class: 'pb-label pb-target-text',
      'text-anchor': 'middle',
    })
    this.parts['target'] = target

    // "Click" laranja com a seta, em cima da zona de impacto.
    const click = svg('g', { class: 'pb-click', transform: `translate(${this.at(zone)},0)` }, g)
    text(click, 'Click', { x: 0, y: t.y - 32, class: 'pb-click-text', 'text-anchor': 'middle' })
    svg(
      'path',
      { d: `M-11,${t.y - 26} L11,${t.y - 26} L0,${t.y - 6} Z`, class: 'pb-click-arrow' },
      click,
    )
    this.parts['click'] = click

    // Leitura do mouse (régua).
    const readout = svg('g', { class: 'pb-readout' }, g)
    this.parts['readoutBox'] = svg('rect', { y: t.y - 66, height: 34, rx: 8 }, readout)
    this.parts['readoutText'] = text(readout, '', { y: t.y - 41, 'text-anchor': 'middle' })
    this.parts['readout'] = readout

    // Área do mouse (calibrador): o trilho todo.
    const hit = svg(
      'rect',
      { x: t.x0 - 8, y: t.y, width: t.x1 - t.x0 + 16, height: t.h, class: 'pb-hit' },
      g,
    )
    const send = (type: PbTrackDetail['type'], e: PointerEvent) => {
      const { x } = this.designPoint(e)
      const fraction = Math.min(1, Math.max(0, (x - t.x0) / (t.x1 - t.x0)))
      this.dispatchEvent(
        new CustomEvent<PbTrackDetail>('pb-track', {
          detail: { type, fraction, button: e.button },
        }),
      )
    }
    hit.addEventListener('pointerenter', (e) => send('enter', e))
    hit.addEventListener('pointermove', (e) => send('move', e))
    hit.addEventListener('pointerleave', (e) => send('leave', e))
    hit.addEventListener('pointerdown', (e) => {
      if (e.button === 0) hit.setPointerCapture(e.pointerId)
      send('down', e)
    })
    hit.addEventListener('pointerup', (e) => send('up', e))
    hit.addEventListener('pointercancel', (e) => send('up', e))
    hit.addEventListener('contextmenu', (e) => e.preventDefault())
    const title = svg('title', {}, hit)
    title.textContent =
      'Calibrador: clique para pôr o triângulo (botão direito tira); X sobe, Z desce (Shift: 1%)'
  }

  protected override update() {
    const p = this.parts
    if (!p['fill']) return
    const t = this.track()
    const max = this.num('max', 0)
    const yards = (fraction: number, digits: number) =>
      max > 0 ? `${(fraction * max).toFixed(digits)}y` : `${Math.round(fraction * 100)}%`
    const value = Math.min(1, Math.max(0, this.fraction('value') ?? 0))
    p['fill']!.setAttribute('width', String((t.x1 - t.x0) * value))
    const position = this.hasAttribute('position') ? this.num('position') : value
    p['thumb']!.setAttribute(
      'transform',
      `translate(${this.at(Math.min(1, Math.max(0, position)))},0)`,
    )
    const power = this.fraction('power')
    p['power']!.setAttribute('visibility', power === undefined ? 'hidden' : 'visible')
    if (power !== undefined) {
      p['power']!.setAttribute('transform', `translate(${this.at(power)},0)`)
      p['powerText']!.textContent = yards(power, 0)
    }
    const target = this.fraction('target')
    p['target']!.setAttribute('visibility', target === undefined ? 'hidden' : 'visible')
    if (target !== undefined) {
      p['target']!.setAttribute('transform', `translate(${this.at(Math.min(1, target))},0)`)
      p['targetText']!.textContent = (this.hasAttribute('snap') ? '▶ ' : '') + yards(target, 1)
    }
    const hover = this.getAttribute('hover')
    const hovering = hover !== null && hover !== ''
    this.group.classList.toggle('pb-hovering', hovering)
    p['guide']!.setAttribute('visibility', hovering ? 'visible' : 'hidden')
    p['readout']!.setAttribute('visibility', hovering ? 'visible' : 'hidden')
    if (hovering) {
      const f = Number(hover)
      const x = this.at(f)
      p['guide']!.setAttribute('x1', String(x))
      p['guide']!.setAttribute('x2', String(x))
      const label = `${(f * 100).toFixed(1).replace('.', ',')}%${max > 0 ? ` · ${yards(f, 1)}` : ''}`
      p['readoutText']!.textContent = label
      p['readoutText']!.setAttribute('x', String(x))
      const width = label.length * 13 + 20
      p['readoutBox']!.setAttribute('x', String(x - width / 2))
      p['readoutBox']!.setAttribute('width', String(width))
    }
    const stage = this.getAttribute('stage') ?? 'idle'
    p['click']!.setAttribute(
      'visibility',
      stage === 'returning' && !this.hasAttribute('auto') ? 'visible' : 'hidden',
    )
    const state = this.getAttribute('state') ?? ''
    for (const name of ['near', 'done', 'cancelled']) {
      this.group.classList.toggle(`pb-${name}`, state.split(' ').includes(name))
    }
    this.group.classList.toggle('pb-auto', this.hasAttribute('auto'))
  }
}

/** Evento do mostrador: clique/arraste na bola (x, y de -1 a 1) ou duplo clique (reset). */
export interface PbImpactDetail {
  type: 'down' | 'move' | 'up' | 'reset'
  x: number
  y: number
}

/**
 * Mostrador redondo: aro (r), anel da força (entre `track` e `inner`, cheio em `value`%),
 * face com a bola do jogador (`ball` = imagem), o ponto de impacto (`spin`/`curve`), a %
 * (`value`), o "PangYa" com os PANGYAs seguidos (`streak`) e o power shot (`ps` = 0..2).
 */
export class PbGauge extends PbPart {
  static observedAttributes = [
    'cx',
    'cy',
    'r',
    'track',
    'inner',
    'value',
    'ball',
    'spin',
    'curve',
    'streak',
    'ps',
    'title',
  ]
  protected static override dynamic = ['value', 'ball', 'spin', 'curve', 'streak', 'ps', 'title']
  private parts: Record<string, SVGElement> = {}

  /** Centro e raio da bola na face. */
  private ballCircle() {
    const cx = this.num('cx')
    const cy = this.num('cy')
    const inner = this.num('inner', 100)
    return { x: cx, y: cy - inner * 0.12, r: inner * 0.46 }
  }

  protected draw(g: SVGGElement) {
    const cx = this.num('cx')
    const cy = this.num('cy')
    const r = this.num('r', 150)
    const track = this.num('track', r * 0.9)
    const inner = this.num('inner', r * 0.85)
    g.setAttribute('class', 'pb-gauge')
    const defs = svg('defs', {}, g)
    svg('circle', { cx, cy, r, class: 'pb-shape pb-thick' }, g)
    // Anel da força.
    const ring = (track + inner) / 2
    svg('circle', { cx, cy, r: ring, class: 'pb-gauge-track', 'stroke-width': track - inner }, g)
    this.parts['arc'] = svg(
      'circle',
      {
        cx,
        cy,
        r: ring,
        pathLength: 100,
        'stroke-width': track - inner,
        class: 'pb-gauge-value',
        transform: `rotate(-90 ${cx} ${cy})`,
      },
      g,
    )
    svg('circle', { cx, cy, r: track, class: 'pb-outline pb-line' }, g)
    svg('circle', { cx, cy, r: inner, class: 'pb-shape pb-line' }, g)

    // A bola do jogador (imagem) ou, sem ela, uma bola branca desenhada.
    const b = this.ballCircle()
    const clip = nextId('pb-ball-clip')
    svg('circle', { cx: b.x, cy: b.y, r: b.r }, svg('clipPath', { id: clip }, defs))
    const shade = nextId('pb-ball-shade')
    const gradient = svg('radialGradient', { id: shade, cx: 0.4, cy: 0.35, r: 0.7 }, defs)
    svg('stop', { offset: 0, 'stop-color': '#ffffff' }, gradient)
    svg('stop', { offset: 0.6, 'stop-color': '#dfe6ee' }, gradient)
    svg('stop', { offset: 1, 'stop-color': '#9aa8ba' }, gradient)
    const ball = svg('g', { class: 'pb-ball' }, g)
    svg('circle', { cx: b.x, cy: b.y, r: b.r, fill: `url(#${shade})` }, ball)
    this.parts['image'] = svg(
      'image',
      {
        x: b.x - b.r,
        y: b.y - b.r,
        width: b.r * 2,
        height: b.r * 2,
        'clip-path': `url(#${clip})`,
        preserveAspectRatio: 'xMidYMid slice',
      },
      ball,
    )
    svg('line', { x1: b.x - b.r, y1: b.y, x2: b.x + b.r, y2: b.y, class: 'pb-cross' }, ball)
    svg('line', { x1: b.x, y1: b.y - b.r, x2: b.x, y2: b.y + b.r, class: 'pb-cross' }, ball)
    svg('circle', { cx: b.x, cy: b.y, r: b.r, class: 'pb-outline pb-line' }, ball)
    this.parts['dot'] = svg('circle', { cx: b.x, cy: b.y, r: 8, class: 'pb-dot' }, ball)
    const hit = svg('circle', { cx: b.x, cy: b.y, r: b.r, class: 'pb-hit pb-ball-hit' }, g)
    const title = svg('title', {}, hit)
    title.textContent =
      'Ponto de impacto: clique ou arraste (spin e curva); duplo clique centraliza'
    const send = (type: PbImpactDetail['type'], e: PointerEvent | MouseEvent) => {
      const p = this.designPoint(e)
      this.dispatchEvent(
        new CustomEvent<PbImpactDetail>('pb-impact', {
          detail: { type, x: (p.x - b.x) / b.r, y: (p.y - b.y) / b.r },
        }),
      )
    }
    hit.addEventListener('pointerdown', (e) => {
      hit.setPointerCapture(e.pointerId)
      send('down', e)
    })
    hit.addEventListener('pointermove', (e) => send('move', e))
    hit.addEventListener('pointerup', (e) => send('up', e))
    hit.addEventListener('dblclick', (e) => send('reset', e))

    // Power shot: dois indicadores à direita da bola.
    this.parts['ps1'] = svg('circle', { cx: b.x + b.r + 22, cy: b.y - 12, r: 8, class: 'pb-ps' }, g)
    this.parts['ps2'] = svg('circle', { cx: b.x + b.r + 22, cy: b.y + 12, r: 8, class: 'pb-ps' }, g)
    // "PangYa ×N" e a %.
    this.parts['streak'] = text(g, '', {
      x: cx,
      y: cy - inner * 0.68,
      class: 'pb-streak',
      'text-anchor': 'middle',
    })
    this.parts['value'] = text(g, '', {
      x: cx,
      y: cy + inner * 0.6,
      class: 'pb-value',
      'text-anchor': 'middle',
    })
    this.parts['title'] = svg('title', {}, g)
  }

  protected override update() {
    const p = this.parts
    if (!p['value']) return
    const value = Math.min(100, Math.max(0, this.num('value')))
    p['value']!.textContent = `${Math.round(value)}%`
    p['arc']!.setAttribute('stroke-dasharray', `${value} 100`)
    const ball = this.getAttribute('ball') ?? ''
    if (ball) p['image']!.setAttribute('href', ball)
    else p['image']!.removeAttribute('href')
    const b = this.ballCircle()
    p['dot']!.setAttribute('cx', String(b.x + this.num('curve') * b.r * 0.8))
    p['dot']!.setAttribute('cy', String(b.y + this.num('spin') * b.r * 0.8))
    const streak = Math.round(this.num('streak'))
    p['streak']!.textContent = streak > 0 ? `PangYa${streak > 1 ? ` ×${streak}` : ''}` : ''
    const ps = this.num('ps')
    p['ps1']!.classList.toggle('pb-on', ps >= 1)
    p['ps2']!.classList.toggle('pb-on', ps >= 2)
    this.group.classList.toggle('pb-power-shot', ps > 0)
    p['title']!.textContent = this.getAttribute('title') ?? ''
  }
}

/** Aba (retângulo arredondado) com o texto e a setinha: o passo da barra. */
export class PbTab extends PbPart {
  static observedAttributes = ['x', 'y', 'w', 'h', 'radius', 'label', 'label-color']
  protected static override dynamic = ['label', 'label-color']
  private label: SVGTextElement | undefined
  private arrow: SVGPathElement | undefined

  protected draw(g: SVGGElement) {
    const x = this.num('x')
    const y = this.num('y')
    const w = this.num('w', 140)
    const h = this.num('h', 70)
    g.setAttribute('class', 'pb-tab')
    svg(
      'rect',
      { x, y, width: w, height: h, rx: this.num('radius', 10), class: 'pb-shape pb-thick' },
      g,
    )
    this.label = text(g, '', {
      x: x + (w - 24) / 2,
      y: y + h * 0.64,
      class: 'pb-tab-label',
      'text-anchor': 'middle',
      'font-size': h * 0.42,
    })
    const ax = x + w - 22
    const ay = y + h / 2
    this.arrow = svg(
      'path',
      {
        d: `M${ax - 7},${ay - 11} L${ax + 8},${ay} L${ax - 7},${ay + 11} Z`,
        class: 'pb-tab-arrow',
      },
      g,
    )
  }

  protected override update() {
    if (!this.label || !this.arrow) return
    this.label.textContent = this.getAttribute('label') ?? ''
    const color = this.getAttribute('label-color')
    this.label.style.fill = color ?? ''
    this.arrow.style.fill = color ?? ''
  }
}

/** Soquete redondo (aro, miolo e texto): o taco, o power shot. */
export class PbSocket extends PbPart {
  static observedAttributes = ['cx', 'cy', 'r', 'inner', 'thick', 'label', 'label-color', 'title']
  protected static override dynamic = ['label', 'label-color', 'title']
  private label: SVGTextElement | undefined
  private titleNode: SVGTitleElement | undefined

  protected draw(g: SVGGElement) {
    const cx = this.num('cx')
    const cy = this.num('cy')
    const r = this.num('r', 40)
    const inner = this.num('inner', r * 0.75)
    g.setAttribute('class', 'pb-socket')
    svg(
      'circle',
      { cx, cy, r, class: `pb-shape ${this.hasAttribute('thick') ? 'pb-thick' : 'pb-line'}` },
      g,
    )
    svg('circle', { cx, cy, r: inner, class: 'pb-shape pb-line' }, g)
    this.label = text(g, '', {
      x: cx,
      y: cy,
      class: 'pb-socket-label',
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-size': inner * 0.92,
    })
    this.titleNode = svg('title', {}, g)
  }

  protected override update() {
    if (!this.label || !this.titleNode) return
    this.label.textContent = this.getAttribute('label') ?? ''
    this.label.style.fill = this.getAttribute('label-color') ?? ''
    this.titleNode.textContent = this.getAttribute('title') ?? ''
  }
}

/** Registra os componentes (uma vez). */
export function definePbComponents() {
  const define = (name: string, element: CustomElementConstructor) => {
    if (!customElements.get(name)) customElements.define(name, element)
  }
  define('power-bar', PowerBarElement)
  define('pb-arc-panel', PbArcPanel)
  define('pb-bar', PbBar)
  define('pb-gauge', PbGauge)
  define('pb-tab', PbTab)
  define('pb-socket', PbSocket)
}

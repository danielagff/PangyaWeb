/**
 * Componentes da PowerBar do Daniel (components/pb-*.js), portados como estão: mesmo
 * desenho (SVG, cores, gradientes), mesmos atributos, Shadow DOM e a unidade de design --u
 * do <power-bar> (o desenho mede 1620 × 380). Uso, como no HTML de base:
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
 * O que o jogo acrescenta (sem mudar o desenho em repouso), marcado com "Jogo:":
 * - <pb-gauge>: `ball` (imagem da bola do jogador no lugar da bola de vidro), `spin`/`curve`
 *   (o ponto azul anda a partir do lugar dele), `streak` ("PangYa ×N") e `ps` (power shot:
 *   anel dourado); evento "pb-impact" (clique/arraste na bola).
 * - <pb-bar>: `value` negativo (o cursor volta para a zona de impacto, à esquerda do 0),
 *   `power` (linha da força fixada), `stage="returning"` ("Click" na zona), `hover` (régua do
 *   calibrador).
 */

import { pbBarGeometry } from './pb-geometry.ts'

export { pbBarZone } from './pb-geometry.ts'

/** Medidas do desenho original. */
export const PB_DESIGN = { width: 1620, height: 380 }

/** Base das peças: posiciona em unidades de design e desenha um <svg> no Shadow DOM. */
export class PbElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return []
  }

  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
  }

  connectedCallback() {
    this.update()
  }

  attributeChangedCallback() {
    if (this.isConnected) this.update()
  }

  /** Lê um atributo numérico com valor padrão. */
  num(name: string, fallback: number) {
    const v = parseFloat(this.getAttribute(name) ?? '')
    return Number.isNaN(v) ? fallback : v
  }

  /** Posiciona o elemento dentro do <power-bar> (coordenadas em unidades de design). */
  place(x: number, y: number, w: number, h: number) {
    const u = (n: number) => `calc(${n} * var(--u))`
    Object.assign(this.style, { left: u(x), top: u(y), width: u(w), height: u(h) })
  }

  /** Renderiza um <svg> com viewBox local e o conteúdo informado. */
  draw(viewBox: string, content: string) {
    this.shadowRoot!.innerHTML = `
        <style>
          :host { position: absolute; display: block; pointer-events: none; }
          svg { width: 100%; height: 100%; overflow: visible; display: block; }
          .line { fill: none; stroke: var(--pb-stroke, #111); stroke-width: var(--pb-stroke-width, 1.4); }
          .fill { fill: var(--pb-fill, #fff); }
          .accent { fill: none; stroke: var(--pb-accent, #1aa3e8); stroke-width: var(--pb-stroke-width, 1.4); }
          .thick { stroke-width: var(--pb-stroke-thick, 3.5); }
        </style>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${content}</svg>`
  }

  update() {}

  /** Jogo: ponto do evento no viewBox do svg da peça. */
  protected local(e: MouseEvent) {
    const svg = this.shadowRoot!.querySelector('svg')
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix) return { x: 0, y: 0 }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse())
    return { x: p.x, y: p.y }
  }
}

/** Container: define a escala --u e a proporção do desenho. */
export class PowerBarElement extends HTMLElement {
  connectedCallback() {
    const w = parseFloat(this.getAttribute('design-width') ?? '') || PB_DESIGN.width
    const h = parseFloat(this.getAttribute('design-height') ?? '') || PB_DESIGN.height
    Object.assign(this.style, {
      display: 'block',
      position: 'relative',
      containerType: 'inline-size',
      aspectRatio: `${w} / ${h}`,
    })
    this.style.setProperty('--u', `calc(100cqw / ${w})`)
  }
}

// <pb-arc-panel>: setor de anel ao redor do gauge, dividido em seções,
// cada uma com um botão de item (ícone) no meio.
// Atributos: cx, cy (centro do gauge), inner, outer (raios),
// start, end (ângulos em graus; 0 = direita, negativo = para cima),
// sections (quantidade de divisões), slot (raio do botão),
// icons (lista separada por vírgula: flask, chat).
// Evento: "pb-item" com detail { index, icon } ao clicar num botão.

// Ícones desenhados numa caixa de -10..10.
const ICONS: Record<string, string> = {
  flask: `<path d="M -4.5 -9 H 4.5 M -2.5 -9 V -3 L -8 6.5 Q -9 9 -6.5 9 H 6.5 Q 9 9 8 6.5 L 2.5 -3 V -9" />
            <path d="M -5.6 2.5 H 5.6" />`,
  chat: `<path d="M -8.5 -5.5 Q -8.5 -8 -6 -8 H 6 Q 8.5 -8 8.5 -5.5 V 1.5 Q 8.5 4 6 4 H -0.5 L -5 8 V 4 H -6 Q -8.5 4 -8.5 1.5 Z" />
           <circle cx="-4" cy="-2" r=".6" /><circle cx="0" cy="-2" r=".6" /><circle cx="4" cy="-2" r=".6" />`,
}

export class PbArcPanel extends PbElement {
  static override get observedAttributes() {
    return ['cx', 'cy', 'inner', 'outer', 'start', 'end', 'sections', 'slot', 'icons']
  }

  override update() {
    const cx = this.num('cx', 0),
      cy = this.num('cy', 0)
    const ri = this.num('inner', 157),
      ro = this.num('outer', 214)
    const a0 = this.num('start', -70),
      a1 = this.num('end', -8)
    const n = Math.max(1, Math.round(this.num('sections', 2)))
    const slotR = this.num('slot', 17)
    const icons = (this.getAttribute('icons') || '').split(',').map((s) => s.trim())

    const xy = (r: number, deg: number) => {
      const t = (deg * Math.PI) / 180
      return [r * Math.cos(t), r * Math.sin(t)] as [number, number]
    }
    const pt = (r: number, deg: number) =>
      xy(r, deg)
        .map((v) => v.toFixed(2))
        .join(' ')
    const step = (a1 - a0) / n
    const mid = (ri + ro) / 2
    const large = a1 - a0 > 180 ? 1 : 0

    // Fundo do setor (fechado) e bordas visíveis.
    let svg = `
        <path class="sector" d="M ${pt(ri, a0)} L ${pt(ro, a0)} A ${ro} ${ro} 0 ${large} 1 ${pt(ro, a1)}
                                L ${pt(ri, a1)} A ${ri} ${ri} 0 ${large} 0 ${pt(ri, a0)} Z" />
        <path class="rim" d="M ${pt(ro - 3, a0 + 0.6)} A ${ro - 3} ${ro - 3} 0 ${large} 1 ${pt(ro - 3, a1)}" />`

    for (let i = 0; i < n; i++) {
      if (i > 0)
        svg += `<path class="divider" d="M ${pt(ri, a0 + step * i)} L ${pt(ro, a0 + step * i)}" />`
      const [x, y] = xy(mid, a0 + step * (i + 0.5))
      const icon = ICONS[icons[i] ?? ''] || ''
      svg += `
          <g class="slot" data-index="${i}" data-icon="${icons[i] || ''}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})">
            <circle class="slot-bg" r="${slotR}" />
            <g class="icon" transform="scale(${(slotR / 14).toFixed(3)})">${icon}</g>
          </g>`
    }

    this.place(cx - ro, cy - ro, ro * 2, ro * 2)
    this.draw(
      `${-ro} ${-ro} ${ro * 2} ${ro * 2}`,
      `
        <style>
          .sector { fill: #2e3d36; fill-opacity: .82; stroke: #1a2420; stroke-width: 1.5; }
          .rim { fill: none; stroke: #8fa39a; stroke-width: 2; opacity: .6; }
          .divider { stroke: #8fa39a; stroke-width: 1.5; opacity: .6; }
          .slot { pointer-events: auto; cursor: pointer; }
          .slot-bg { fill: #ffffff; fill-opacity: .06; stroke: #cfe0d8; stroke-opacity: .35; stroke-width: 1.5; transition: fill-opacity .15s; }
          .slot:hover .slot-bg { fill-opacity: .2; }
          .icon { fill: none; stroke: #f2f6f4; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
          .icon circle { fill: #f2f6f4; }
        </style>
        ${svg}`,
    )

    this.shadowRoot!.querySelectorAll<SVGGElement>('.slot').forEach((el) => {
      el.addEventListener('click', () =>
        this.dispatchEvent(
          new CustomEvent('pb-item', {
            bubbles: true,
            composed: true,
            detail: { index: Number(el.dataset['index']), icon: el.dataset['icon'] },
          }),
        ),
      )
    })
  }
}

// <pb-bar>: barra de força no estilo Pangya.
// Trilha: zona de impacto (escura + branca) | escala 0..max (azul) | estouro (vermelho).
// Atributos:
//   x, y, w, h   posição e tamanho (unidades de design)
//   max          distância máxima do taco em yards (padrão 256)
//   value        posição do cursor em yards (vazio = sem cursor)
//   target       distância do alvo em yards (vazio = sem marcador)
//   pad-left     espaço antes da trilha (onde o gauge encosta)
export class PbBar extends PbElement {
  static override get observedAttributes() {
    return ['x', 'y', 'w', 'h', 'max', 'value', 'target', 'pad-left', 'power', 'stage', 'hover']
  }

  /** Jogo: posição do mouse na escala (0..1, pode passar dos limites). */
  scaleAt(e: MouseEvent) {
    const w = this.num('w', 1290),
      h = this.num('h', 100)
    const { s0, s1 } = pbBarGeometry(w, h, this.num('pad-left', 20))
    return (this.local(e).x - s0) / (s1 - s0)
  }

  override update() {
    const x = this.num('x', 0),
      y = this.num('y', 0)
    const w = this.num('w', 1290),
      h = this.num('h', 100)
    const max = this.num('max', 256)
    const value = this.num('value', NaN),
      target = this.num('target', NaN)

    // Geometria da trilha (proporções tiradas do jogo).
    const { tx0, ty, th, tw, impactW, overW, s0, s1 } = pbBarGeometry(
      w,
      h,
      this.num('pad-left', 20),
    )
    const toX = (yd: number) => s0 + (Math.min(Math.max(yd, 0), max) / max) * (s1 - s0)
    // Jogo: o cursor também anda à esquerda do 0 (volta para a zona de impacto).
    const cursorX = (yd: number) => Math.max(tx0, s0 + (Math.min(yd, max) / max) * (s1 - s0))
    const fmt = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}y`

    // Marcações a cada 10% da escala.
    let ticks = ''
    for (let i = 1; i < 10; i++) {
      const tx = toX((max * i) / 10)
      ticks += `<line x1="${tx}" y1="${ty}" x2="${tx}" y2="${ty + th}" class="tick" />`
    }

    const cursor = Number.isNaN(value)
      ? ''
      : (() => {
          const cx = cursorX(value),
            cw = 18,
            ch = th + 16
          return `<rect class="cursor" x="${cx - cw / 2}" y="${ty - 8}" width="${cw}" height="${ch}" rx="3" />
              <line class="cursor-grip" x1="${cx}" y1="${ty - 3}" x2="${cx}" y2="${ty + th + 3}" />`
        })()

    const marker = Number.isNaN(target)
      ? ''
      : (() => {
          const mx = toX(target)
          return `<line class="target-line" x1="${mx}" y1="${ty}" x2="${mx}" y2="${ty + th}" />
              <path class="target-tri" d="M ${mx - 11} ${ty - 30} L ${mx + 11} ${ty - 30} L ${mx} ${ty - 6} Z" />
              <text class="label target-text" x="${mx}" y="${ty - 38}" text-anchor="middle">${fmt(target)}</text>`
        })()

    // Jogo: força fixada (2º toque), "Click" na volta e a régua do calibrador.
    const power = this.num('power', NaN)
    const powerLine = Number.isNaN(power)
      ? ''
      : `<line class="power-line" x1="${toX(power)}" y1="${ty}" x2="${toX(power)}" y2="${ty + th}" />`
    const zoneX = s0 - impactW * 0.14
    const click =
      this.getAttribute('stage') === 'returning'
        ? `<g class="click"><text class="label click-text" x="${zoneX}" y="${ty - 30}" text-anchor="middle">Click</text>
           <path class="click-arrow" d="M ${zoneX - 10} ${ty - 24} L ${zoneX + 10} ${ty - 24} L ${zoneX} ${ty - 6} Z" /></g>`
        : ''
    const hover = this.num('hover', NaN)
    let ruler = ''
    if (!Number.isNaN(hover)) {
      for (let i = 1; i < 100; i++) {
        if (i % 10 === 0) continue
        const tx = toX((max * i) / 100)
        ruler += `<line x1="${tx}" y1="${ty}" x2="${tx}" y2="${ty + th * (i % 5 ? 0.3 : 0.55)}" class="ruler" />`
      }
      const hx = toX(hover * max)
      const text = `${(hover * 100).toFixed(1).replace('.', ',')}% · ${fmt(Math.round(hover * max * 10) / 10)}`
      ruler += `<line class="guide" x1="${hx}" y1="${ty - 4}" x2="${hx}" y2="${ty + th + 4}" />
        <text class="label readout" x="${hx}" y="${ty - 46}" text-anchor="middle">${text}</text>`
    }

    this.place(x, y, w, h)
    this.draw(
      `0 0 ${w} ${h}`,
      `
      <defs>
        <linearGradient id="frame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f4f6f8" /><stop offset="1" stop-color="#c9ced4" />
        </linearGradient>
        <linearGradient id="power" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#7fe6ff" /><stop offset=".35" stop-color="#1cc4f5" />
          <stop offset="1" stop-color="#0784bf" />
        </linearGradient>
        <linearGradient id="over" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#c8344e" /><stop offset="1" stop-color="#7a1022" />
        </linearGradient>
        <linearGradient id="knob" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#9aa0a6" /><stop offset=".5" stop-color="#eef0f2" />
          <stop offset="1" stop-color="#8a9096" />
        </linearGradient>
      </defs>
      <style>
        :host { pointer-events: auto; cursor: crosshair; }
        .frame { fill: url(#frame); stroke: #8d949b; stroke-width: 1.5; }
        .track-bg { fill: #0f2a30; stroke: #5d666e; stroke-width: 1.5; }
        .tick { stroke: #0a6fa3; stroke-width: 1.5; }
        .cursor { fill: url(#knob); stroke: #5b6168; stroke-width: 1.5; }
        .cursor-grip { stroke: #6d737a; stroke-width: 1.5; }
        .target-line { stroke: #8b5cf6; stroke-width: 3; }
        .target-tri { fill: #f2f8ff; stroke: #1b5fa8; stroke-width: 2.5; stroke-linejoin: round; }
        .label {
          font: 800 30px 'Nunito', 'Arial Rounded MT Bold', sans-serif;
          paint-order: stroke; stroke-linejoin: round;
          fill: #2b2f33; stroke: #fff; stroke-width: 6;
        }
        .target-text { fill: #3dff6e; stroke: #0b3d17; stroke-width: 6; }
        .power-line { stroke: #fff; stroke-width: 3; }
        .click-text { fill: #ff9800; stroke: #5a2a00; font-style: italic; }
        .click-arrow { fill: #ff9800; stroke: #5a2a00; stroke-width: 2; stroke-linejoin: round; }
        .click { animation: bob .35s infinite alternate; }
        @keyframes bob { to { transform: translateY(5px); } }
        .ruler { stroke: rgba(255, 255, 255, .7); stroke-width: 1.2; }
        .guide { stroke: #fff; stroke-width: 2; }
        .readout { font-size: 24px; }
      </style>

      <rect class="frame" x="0" y="0" width="${w}" height="${h}" />
      <rect class="track-bg" x="${tx0}" y="${ty}" width="${tw}" height="${th}" />
      <rect fill="#fff" x="${s0 - impactW * 0.28}" y="${ty}" width="${impactW * 0.28}" height="${th}" />
      <rect fill="#e040fb" x="${s0 - 4}" y="${ty}" width="4" height="${th}" />
      <rect fill="url(#power)" x="${s0}" y="${ty}" width="${s1 - s0}" height="${th}" />
      <rect fill="url(#over)" x="${s1}" y="${ty}" width="${overW}" height="${th}" />
      ${ticks}
      ${ruler}
      ${powerLine}
      ${marker}
      ${cursor}
      ${click}
      <text class="label" x="${toX(max / 2)}" y="${h * 0.8}" text-anchor="middle">${fmt(max / 2)}</text>
      <text class="label" x="${s1}" y="${h * 0.8}" text-anchor="middle">${fmt(max)}</text>`,
    )
  }
}

/** Jogo: clique/arraste na bola do mostrador (x, y de -1 a 1 em relação à bola). */
export interface PbImpactDetail {
  type: 'down' | 'move' | 'up' | 'reset'
  x: number
  y: number
}

// <pb-gauge>: anel principal no estilo Pangya (moldura branca, anel azul,
// bola de vidro escura com a porcentagem e o ponto de spin).
// Atributos: cx, cy, r (raio externo), track (raio do anel azul),
// inner (raio interno da moldura), value (porcentagem exibida, padrão 100).
export class PbGauge extends PbElement {
  static override get observedAttributes() {
    return ['cx', 'cy', 'r', 'track', 'inner', 'value', 'ball', 'spin', 'curve', 'streak', 'ps']
  }

  /** Raio da bola (unidades locais, centro em 0,0). */
  ballRadius() {
    const r = this.num('r', 157)
    return this.num('inner', r * 0.85) * 0.72
  }

  override update() {
    const cx = this.num('cx', 0),
      cy = this.num('cy', 0),
      r = this.num('r', 157)
    const track = this.num('track', r * 0.91),
      inner = this.num('inner', r * 0.85)
    const value = this.num('value', 100)
    const ball = inner * 0.72
    // Jogo: a bola do jogador (imagem), o ponto de impacto, os PANGYAs seguidos e o power shot.
    const image = this.getAttribute('ball')
    const dx = this.num('curve', 0) * ball * 0.4
    const dy = this.num('spin', 0) * ball * 0.4
    const streak = Math.round(this.num('streak', 0))
    const ps = this.num('ps', 0) > 0
    const ballFill = image
      ? `<clipPath id="ball-clip"><circle r="${ball}" /></clipPath>
         <image href="${image}" x="${-ball}" y="${-ball}" width="${ball * 2}" height="${ball * 2}"
                clip-path="url(#ball-clip)" preserveAspectRatio="xMidYMid slice" />`
      : `<circle r="${ball}" fill="url(#ball)" />`
    const streakText =
      streak > 0
        ? `<text class="streak" y="${-inner * 0.8}" text-anchor="middle">PangYa${streak > 1 ? ` ×${streak}` : ''}</text>`
        : ''
    this.place(cx - r, cy - r, r * 2, r * 2)
    this.draw(
      `${-r} ${-r} ${r * 2} ${r * 2}`,
      `
      <defs>
        <linearGradient id="bezel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff" /><stop offset="1" stop-color="#c8cfd6" />
        </linearGradient>
        <radialGradient id="ball" cx=".42" cy=".35" r=".75">
          <stop offset="0" stop-color="#5b6670" /><stop offset=".55" stop-color="#1a1f24" />
          <stop offset="1" stop-color="#030405" />
        </radialGradient>
        <radialGradient id="dot" cx=".4" cy=".35" r=".7">
          <stop offset="0" stop-color="#e6f7ff" /><stop offset=".45" stop-color="#3fb4ff" />
          <stop offset="1" stop-color="#0b5fc2" />
        </radialGradient>
      </defs>
      <style>
        .pct {
          font: 800 ${ball * 0.36}px 'Nunito', 'Arial Rounded MT Bold', sans-serif;
          paint-order: stroke; stroke-linejoin: round;
          fill: #f4fff6; stroke: #0d4a22; stroke-width: ${ball * 0.07};
        }
        .streak {
          font: 800 ${ball * 0.3}px 'Nunito', 'Arial Rounded MT Bold', sans-serif;
          paint-order: stroke; stroke-linejoin: round; font-style: italic;
          fill: #ff5fc0; stroke: #4a0030; stroke-width: ${ball * 0.06};
        }
        .ball-hit { pointer-events: auto; cursor: crosshair; touch-action: none; }
      </style>

      <circle r="${r}" fill="url(#bezel)" stroke="#2a2f35" stroke-width="2" />
      <circle r="${track}" fill="none" stroke="${ps ? '#c98a00' : '#1565c0'}" stroke-width="${(r - inner) * 0.62}" />
      <circle r="${track}" fill="none" stroke="${ps ? '#ffd54f' : '#4fc3ff'}" stroke-width="${(r - inner) * 0.28}" />
      <circle r="${inner}" fill="url(#bezel)" stroke="#8d969f" stroke-width="1.5" />

      <circle r="${ball + 6}" fill="#e9eef2" stroke="#9aa3ab" stroke-width="2" />
      ${ballFill}
      <ellipse cx="${-ball * 0.1}" cy="${-ball * 0.55}" rx="${ball * 0.55}" ry="${ball * 0.28}" fill="#fff" opacity=".22" />

      <line x1="${-inner + 8}" y1="0" x2="${-ball * 0.05}" y2="0" stroke="#2fd36b" stroke-width="5" stroke-linecap="round" />
      <text class="pct" x="${ball * 0.45}" y="${ball * 0.13}" text-anchor="middle">${Math.round(value)}%</text>

      <circle cx="${dx}" cy="${ball * 0.55 + dy}" r="${ball * 0.2}" fill="none" stroke="#3fb4ff" stroke-width="2" opacity=".55" />
      <circle cx="${dx}" cy="${ball * 0.55 + dy}" r="${ball * 0.12}" fill="url(#dot)" />
      ${streakText}
      <circle class="ball-hit" r="${ball}" fill="transparent" />`,
    )
    const hit = this.shadowRoot!.querySelector<SVGCircleElement>('.ball-hit')!
    const send = (type: PbImpactDetail['type'], e: MouseEvent) => {
      const p = this.local(e)
      this.dispatchEvent(
        new CustomEvent<PbImpactDetail>('pb-impact', {
          detail: { type, x: p.x / ball, y: p.y / ball },
        }),
      )
    }
    hit.addEventListener('pointerdown', (e) => {
      // A captura fica no próprio elemento (o desenho é refeito a cada mudança).
      this.setPointerCapture(e.pointerId)
      send('down', e)
    })
    hit.addEventListener('dblclick', (e) => send('reset', e))
  }

  private listening = false
  override connectedCallback() {
    super.connectedCallback()
    if (this.listening) return
    this.listening = true
    this.addEventListener('pointermove', (e) => {
      if (!this.hasPointerCapture(e.pointerId)) return
      const p = this.local(e)
      const ball = this.ballRadius()
      this.dispatchEvent(
        new CustomEvent<PbImpactDetail>('pb-impact', {
          detail: { type: 'move', x: p.x / ball, y: p.y / ball },
        }),
      )
    })
    this.addEventListener('pointerup', () =>
      this.dispatchEvent(
        new CustomEvent<PbImpactDetail>('pb-impact', { detail: { type: 'up', x: 0, y: 0 } }),
      ),
    )
  }
}

// <pb-tab>: aba azul arredondada (ex.: "Impact") com setinha para cima.
// Atributos: x, y, w, h, radius, label.
export class PbTab extends PbElement {
  static override get observedAttributes() {
    return ['x', 'y', 'w', 'h', 'radius', 'label']
  }

  override update() {
    const x = this.num('x', 0),
      y = this.num('y', 0)
    const w = this.num('w', 100),
      h = this.num('h', 40)
    const rx = this.num('radius', 12)
    const label = this.getAttribute('label') || ''
    const ax = w - 20,
      ay = h * 0.3
    this.place(x, y, w, h)
    this.draw(
      `0 0 ${w} ${h}`,
      `
      <defs>
        <linearGradient id="tab" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#5fb0f5" /><stop offset=".5" stop-color="#2c7fd6" />
          <stop offset="1" stop-color="#1a5aa8" />
        </linearGradient>
      </defs>
      <style>
        .lbl {
          font: 800 ${h * 0.36}px 'Nunito', 'Arial Rounded MT Bold', sans-serif;
          paint-order: stroke; stroke-linejoin: round;
          fill: #fff; stroke: #0b2f5c; stroke-width: ${h * 0.08};
        }
      </style>
      <rect width="${w}" height="${h}" rx="${rx}" fill="url(#tab)" stroke="#0d3d75" stroke-width="2" />
      <rect x="3" y="3" width="${w - 6}" height="${h * 0.4}" rx="${rx - 3}" fill="#fff" opacity=".15" />
      <path d="M ${ax - 8} ${ay + 3} L ${ax} ${ay - 6} L ${ax + 8} ${ay + 3} Z M ${ax - 8} ${ay + 6} H ${ax + 8}"
            fill="#fff" stroke="#fff" stroke-width="2.5" stroke-linejoin="round" />
      <text class="lbl" x="${w / 2}" y="${h * 0.8}" text-anchor="middle">${label}</text>`,
    )
  }
}

// <pb-socket>: botão redondo preto com aro branco (taco "3W", botão de spin "−").
// Atributos: cx, cy, r (externo), inner (raio do miolo preto),
// thick (aro mais grosso), label (texto central), label-color.
export class PbSocket extends PbElement {
  static override get observedAttributes() {
    return ['cx', 'cy', 'r', 'inner', 'thick', 'label', 'label-color']
  }

  override update() {
    const cx = this.num('cx', 0),
      cy = this.num('cy', 0),
      r = this.num('r', 40)
    const inner = this.num('inner', r * 0.75)
    const label = this.getAttribute('label') || ''
    const color = this.getAttribute('label-color') || '#fff'
    const size = inner * (label.length === 1 ? 1.4 : 0.8)
    const ring = this.hasAttribute('thick') ? 4 : 2.5
    this.place(cx - r, cy - r, r * 2, r * 2)
    this.draw(
      `${-r} ${-r} ${r * 2} ${r * 2}`,
      `
      <defs>
        <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff" /><stop offset="1" stop-color="#bcc4cc" />
        </linearGradient>
        <radialGradient id="core" cx=".4" cy=".3" r=".8">
          <stop offset="0" stop-color="#3a3f45" /><stop offset="1" stop-color="#050505" />
        </radialGradient>
      </defs>
      <style>
        .lbl {
          font: 900 ${size}px 'Nunito', 'Arial Rounded MT Bold', sans-serif;
          paint-order: stroke; stroke-linejoin: round; stroke: #000; stroke-width: ${inner * 0.08};
        }
      </style>
      <circle r="${r - ring / 2}" fill="url(#rim)" stroke="#1d2126" stroke-width="${ring}" />
      <circle r="${inner}" fill="url(#core)" stroke="#59616a" stroke-width="1.5" />
      <ellipse cy="${-inner * 0.5}" rx="${inner * 0.6}" ry="${inner * 0.28}" fill="#fff" opacity=".12" />
      <text class="lbl" y="${size * 0.35}" text-anchor="middle" fill="${color}">${label}</text>`,
    )
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

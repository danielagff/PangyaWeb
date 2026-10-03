// <pb-socket>: botão redondo preto com aro branco (taco "3W", botão de spin "−").
customElements.define(
  'pb-socket',
  class extends PbElement {
    static get observedAttributes() {
      return ['cx', 'cy', 'r', 'inner', 'thick', 'label', 'label-color']
    }
    update() {
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
  },
)

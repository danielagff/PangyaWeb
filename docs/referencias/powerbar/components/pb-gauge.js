// <pb-gauge>: anel principal no estilo Pangya (moldura branca, anel azul,
// bola de vidro escura com a porcentagem e o ponto de spin).
// Atributos: cx, cy, r (raio externo), track (raio do anel azul),
// inner (raio interno da moldura), value (porcentagem exibida, padrão 100).
customElements.define(
  'pb-gauge',
  class extends PbElement {
    static get observedAttributes() {
      return ['cx', 'cy', 'r', 'track', 'inner', 'value']
    }

    update() {
      const cx = this.num('cx', 0),
        cy = this.num('cy', 0),
        r = this.num('r', 157)
      const track = this.num('track', r * 0.91),
        inner = this.num('inner', r * 0.85)
      const value = this.num('value', 100)
      const ball = inner * 0.72
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
      </style>

      <circle r="${r}" fill="url(#bezel)" stroke="#2a2f35" stroke-width="2" />
      <circle r="${track}" fill="none" stroke="#1565c0" stroke-width="${(r - inner) * 0.62}" />
      <circle r="${track}" fill="none" stroke="#4fc3ff" stroke-width="${(r - inner) * 0.28}" />
      <circle r="${inner}" fill="url(#bezel)" stroke="#8d969f" stroke-width="1.5" />

      <circle r="${ball + 6}" fill="#e9eef2" stroke="#9aa3ab" stroke-width="2" />
      <circle r="${ball}" fill="url(#ball)" />
      <ellipse cx="${-ball * 0.1}" cy="${-ball * 0.55}" rx="${ball * 0.55}" ry="${ball * 0.28}" fill="#fff" opacity=".22" />

      <line x1="${-inner + 8}" y1="0" x2="${-ball * 0.05}" y2="0" stroke="#2fd36b" stroke-width="5" stroke-linecap="round" />
      <text class="pct" x="${ball * 0.45}" y="${ball * 0.13}" text-anchor="middle">${Math.round(value)}%</text>

      <circle cy="${ball * 0.55}" r="${ball * 0.2}" fill="none" stroke="#3fb4ff" stroke-width="2" opacity=".55" />
      <circle cy="${ball * 0.55}" r="${ball * 0.12}" fill="url(#dot)" />`,
      )
    }
  },
)

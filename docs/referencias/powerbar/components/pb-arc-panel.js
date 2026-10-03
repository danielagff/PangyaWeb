// <pb-arc-panel>: setor de anel ao redor do gauge, dividido em seções,
// cada uma com um botão de item (ícone) no meio.
// Atributos: cx, cy (centro do gauge), inner, outer (raios),
// start, end (ângulos em graus; 0 = direita, negativo = para cima),
// sections (quantidade de divisões), slot (raio do botão),
// icons (lista separada por vírgula: flask, chat).
// Evento: "pb-item" com detail { index, icon } ao clicar num botão.
;(function () {
  // Ícones desenhados numa caixa de -10..10.
  const ICONS = {
    flask: `<path d="M -4.5 -9 H 4.5 M -2.5 -9 V -3 L -8 6.5 Q -9 9 -6.5 9 H 6.5 Q 9 9 8 6.5 L 2.5 -3 V -9" />
            <path d="M -5.6 2.5 H 5.6" />`,
    chat: `<path d="M -8.5 -5.5 Q -8.5 -8 -6 -8 H 6 Q 8.5 -8 8.5 -5.5 V 1.5 Q 8.5 4 6 4 H -0.5 L -5 8 V 4 H -6 Q -8.5 4 -8.5 1.5 Z" />
           <circle cx="-4" cy="-2" r=".6" /><circle cx="0" cy="-2" r=".6" /><circle cx="4" cy="-2" r=".6" />`,
  }

  customElements.define(
    'pb-arc-panel',
    class extends PbElement {
      static get observedAttributes() {
        return ['cx', 'cy', 'inner', 'outer', 'start', 'end', 'sections', 'slot', 'icons']
      }

      update() {
        const cx = this.num('cx', 0),
          cy = this.num('cy', 0)
        const ri = this.num('inner', 157),
          ro = this.num('outer', 214)
        const a0 = this.num('start', -70),
          a1 = this.num('end', -8)
        const n = Math.max(1, Math.round(this.num('sections', 2)))
        const slotR = this.num('slot', 17)
        const icons = (this.getAttribute('icons') || '').split(',').map((s) => s.trim())

        const xy = (r, deg) => {
          const t = (deg * Math.PI) / 180
          return [r * Math.cos(t), r * Math.sin(t)]
        }
        const pt = (r, deg) =>
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
          const icon = ICONS[icons[i]] || ''
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

        this.shadowRoot.querySelectorAll('.slot').forEach((el) => {
          el.addEventListener('click', () =>
            this.dispatchEvent(
              new CustomEvent('pb-item', {
                bubbles: true,
                composed: true,
                detail: { index: Number(el.dataset.index), icon: el.dataset.icon },
              }),
            ),
          )
        })
      }
    },
  )
})()

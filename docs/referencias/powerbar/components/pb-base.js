// Base dos componentes da PowerBar.
// Cada peça é um custom element posicionado em "unidades de design" (--u),
// definidas pelo <power-bar> pai. O desenho original mede 1620 x 380 unidades.
(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  class PbElement extends HTMLElement {
    static get observedAttributes() { return []; }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() { this.update(); }
    attributeChangedCallback() { if (this.isConnected) this.update(); }

    // Lê um atributo numérico com valor padrão.
    num(name, fallback) {
      const v = parseFloat(this.getAttribute(name));
      return Number.isNaN(v) ? fallback : v;
    }

    // Posiciona o elemento dentro do <power-bar> (coordenadas em unidades de design).
    place(x, y, w, h) {
      const u = (n) => `calc(${n} * var(--u))`;
      Object.assign(this.style, { left: u(x), top: u(y), width: u(w), height: u(h) });
    }

    // Renderiza um <svg> com viewBox local e o conteúdo informado.
    draw(viewBox, content) {
      this.shadowRoot.innerHTML = `
        <style>
          :host { position: absolute; display: block; pointer-events: none; }
          svg { width: 100%; height: 100%; overflow: visible; display: block; }
          .line { fill: none; stroke: var(--pb-stroke, #111); stroke-width: var(--pb-stroke-width, 1.4); }
          .fill { fill: var(--pb-fill, #fff); }
          .accent { fill: none; stroke: var(--pb-accent, #1aa3e8); stroke-width: var(--pb-stroke-width, 1.4); }
          .thick { stroke-width: var(--pb-stroke-thick, 3.5); }
        </style>
        <svg xmlns="${SVG_NS}" viewBox="${viewBox}">${content}</svg>`;
    }

    update() {}
  }

  // Container: define a escala --u e a proporção do desenho.
  class PowerBar extends HTMLElement {
    connectedCallback() {
      const w = parseFloat(this.getAttribute('design-width')) || 1620;
      const h = parseFloat(this.getAttribute('design-height')) || 380;
      Object.assign(this.style, {
        display: 'block',
        position: 'relative',
        containerType: 'inline-size',
        aspectRatio: `${w} / ${h}`,
      });
      this.style.setProperty('--u', `calc(100cqw / ${w})`);
    }
  }

  window.PbElement = PbElement;
  customElements.define('power-bar', PowerBar);
})();

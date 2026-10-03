// <pb-tab>: aba azul arredondada (ex.: "Impact") com setinha para cima.
// Atributos: x, y, w, h, radius, label.
customElements.define('pb-tab', class extends PbElement {
  static get observedAttributes() { return ['x', 'y', 'w', 'h', 'radius', 'label']; }

  update() {
    const x = this.num('x', 0), y = this.num('y', 0);
    const w = this.num('w', 100), h = this.num('h', 40);
    const rx = this.num('radius', 12);
    const label = this.getAttribute('label') || '';
    const ax = w - 20, ay = h * 0.3;
    this.place(x, y, w, h);
    this.draw(`0 0 ${w} ${h}`, `
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
      <text class="lbl" x="${w / 2}" y="${h * 0.8}" text-anchor="middle">${label}</text>`);
  }
});

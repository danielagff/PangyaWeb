// <pb-bar>: barra de força no estilo Pangya.
// Trilha: zona de impacto (escura + branca) | escala 0..max (azul) | estouro (vermelho).
// Atributos:
//   x, y, w, h   posição e tamanho (unidades de design)
//   max          distância máxima do taco em yards (padrão 256)
//   value        posição do cursor em yards (vazio = sem cursor)
//   target       distância do alvo em yards (vazio = sem marcador)
//   pad-left     espaço antes da trilha (onde o gauge encosta)
customElements.define('pb-bar', class extends PbElement {
  static get observedAttributes() { return ['x', 'y', 'w', 'h', 'max', 'value', 'target', 'pad-left']; }

  update() {
    const x = this.num('x', 0), y = this.num('y', 0);
    const w = this.num('w', 1290), h = this.num('h', 100);
    const max = this.num('max', 256);
    const value = this.num('value', NaN), target = this.num('target', NaN);

    // Geometria da trilha (proporções tiradas do jogo).
    const tx0 = this.num('pad-left', 20), tx1 = w - 36;
    const ty = h * 0.14, th = h * 0.28;
    const tw = tx1 - tx0;
    const impactW = tw * 0.1, overW = tw * 0.022;
    const s0 = tx0 + impactW, s1 = tx1 - overW;      // início/fim da escala 0..max
    const toX = (yd) => s0 + (Math.min(Math.max(yd, 0), max) / max) * (s1 - s0);
    const fmt = (n) => `${Number.isInteger(n) ? n : n.toFixed(1)}y`;

    // Marcações a cada 10% da escala.
    let ticks = '';
    for (let i = 1; i < 10; i++) {
      const tx = toX((max * i) / 10);
      ticks += `<line x1="${tx}" y1="${ty}" x2="${tx}" y2="${ty + th}" class="tick" />`;
    }

    const cursor = Number.isNaN(value) ? '' : (() => {
      const cx = toX(value), cw = 18, ch = th + 16;
      return `<rect class="cursor" x="${cx - cw / 2}" y="${ty - 8}" width="${cw}" height="${ch}" rx="3" />
              <line class="cursor-grip" x1="${cx}" y1="${ty - 3}" x2="${cx}" y2="${ty + th + 3}" />`;
    })();

    const marker = Number.isNaN(target) ? '' : (() => {
      const mx = toX(target);
      return `<line class="target-line" x1="${mx}" y1="${ty}" x2="${mx}" y2="${ty + th}" />
              <path class="target-tri" d="M ${mx - 11} ${ty - 30} L ${mx + 11} ${ty - 30} L ${mx} ${ty - 6} Z" />
              <text class="label target-text" x="${mx}" y="${ty - 38}" text-anchor="middle">${fmt(target)}</text>`;
    })();

    this.place(x, y, w, h);
    this.draw(`0 0 ${w} ${h}`, `
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
      </style>

      <rect class="frame" x="0" y="0" width="${w}" height="${h}" />
      <rect class="track-bg" x="${tx0}" y="${ty}" width="${tw}" height="${th}" />
      <rect fill="#fff" x="${s0 - impactW * 0.28}" y="${ty}" width="${impactW * 0.28}" height="${th}" />
      <rect fill="#e040fb" x="${s0 - 4}" y="${ty}" width="4" height="${th}" />
      <rect fill="url(#power)" x="${s0}" y="${ty}" width="${s1 - s0}" height="${th}" />
      <rect fill="url(#over)" x="${s1}" y="${ty}" width="${overW}" height="${th}" />
      ${ticks}
      ${marker}
      ${cursor}
      <text class="label" x="${toX(max / 2)}" y="${h * 0.8}" text-anchor="middle">${fmt(max / 2)}</text>
      <text class="label" x="${s1}" y="${h * 0.8}" text-anchor="middle">${fmt(max)}</text>`);
  }
});

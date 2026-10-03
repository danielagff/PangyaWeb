/** Geometria do <pb-bar> (sem DOM: a lógica da barra e os testes usam). */

/** Geometria da trilha do <pb-bar> (proporções tiradas do jogo), em unidades locais. */
export function pbBarGeometry(w: number, h: number, padLeft = 20) {
  const tx0 = padLeft,
    tx1 = w - 36
  const ty = h * 0.14,
    th = h * 0.28
  const tw = tx1 - tx0
  const impactW = tw * 0.1,
    overW = tw * 0.022
  const s0 = tx0 + impactW,
    s1 = tx1 - overW // início/fim da escala 0..max
  return { tx0, tx1, ty, th, tw, impactW, overW, s0, s1 }
}

/**
 * Jogo: zona de impacto em frações da escala (0 = início, 1 = máximo). O ponto PANGYA é a
 * faixa magenta no começo da escala; a zona é a faixa branca à esquerda dela; o cursor pode
 * voltar até o começo da trilha (`floor`).
 */
export function pbBarZone(w = 1290, h = 100, padLeft = 20) {
  const g = pbBarGeometry(w, h, padLeft)
  const scale = g.s1 - g.s0
  return {
    center: -2 / scale,
    half: (g.impactW * 0.28) / scale,
    floor: (g.tx0 - g.s0) / scale,
  }
}

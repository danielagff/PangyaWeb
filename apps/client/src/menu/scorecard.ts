/**
 * Cartão de placar como no fim da rodada do jogo: buracos, par, tacadas de cada jogador
 * (cor por resultado: birdie, eagle…), subtotais de ida e volta e o total relativo ao par.
 */
import { scoreToPar } from '@pangya/game'

export interface CardRow {
  name: string
  /** Cor do jogador (0xRRGGBB) no nome. */
  color?: number
  /** Tacadas em cada buraco do plano, na mesma ordem (undefined = não jogou ainda). */
  strokes: (number | undefined)[]
  /** Texto depois do nome, ex.: "(saiu)". */
  note?: string
}

/** Classe do resultado de um buraco (para a cor da célula). */
export function scoreClass(strokes: number, par: number): string {
  if (strokes === 1) return 'hio'
  const diff = strokes - par
  if (diff <= -3) return 'albatross'
  if (diff === -2) return 'eagle'
  if (diff === -1) return 'birdie'
  if (diff === 0) return 'par'
  if (diff === 1) return 'bogey'
  return 'double'
}

/** Soma das tacadas e do par só dos buracos já jogados. */
export function cardTotals(strokes: (number | undefined)[], pars: (number | undefined)[]) {
  let total = 0
  let par = 0
  let played = 0
  strokes.forEach((s, i) => {
    if (s === undefined) return
    total += s
    par += pars[i] ?? 0
    played++
  })
  return { strokes: total, par, played }
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const colorCss = (color: number) => `#${color.toString(16).padStart(6, '0')}`

/** Partes do cartão: ida (até 9 buracos) e volta, quando o plano passa de 9. */
function halves(count: number): [number, number][] {
  return count > 9
    ? [
        [0, 9],
        [9, count],
      ]
    : [[0, count]]
}

const sum = (values: (number | undefined)[]) =>
  values.some((v) => v !== undefined) ? values.reduce<number>((n, v) => n + (v ?? 0), 0) : undefined

/**
 * Tabela HTML do cartão. `pars` segue a ordem de `holes` (undefined = par ainda
 * desconhecido, buraco não jogado).
 */
export function scorecardHtml(
  holes: number[],
  pars: (number | undefined)[],
  rows: CardRow[],
): string {
  const parts = halves(holes.length)
  const split = parts.length > 1
  const labels = ['Ida', 'Volta']
  const cells = (values: (string | number | undefined)[], tag = 'td') =>
    values.map((v) => `<${tag}>${v ?? ''}</${tag}>`).join('')

  const head = parts
    .map(
      ([a, b], i) =>
        cells(holes.slice(a, b), 'th') + (split ? `<th class="sub">${labels[i]}</th>` : ''),
    )
    .join('')
  const parRow = parts
    .map(
      ([a, b]) =>
        cells(pars.slice(a, b)) +
        (split ? `<td class="sub">${sum(pars.slice(a, b)) ?? ''}</td>` : ''),
    )
    .join('')
  const parTotal = sum(pars)

  const body = rows
    .map((row) => {
      const strokeCells = parts
        .map(([a, b]) => {
          const own = row.strokes.slice(a, b)
          const tds = own
            .map((s, i) => {
              const par = pars[a + i]
              if (s === undefined) return '<td></td>'
              const kind = par === undefined ? '' : ` class="s-${scoreClass(s, par)}"`
              return `<td${kind}><span>${s}</span></td>`
            })
            .join('')
          return tds + (split ? `<td class="sub">${sum(own) ?? ''}</td>` : '')
        })
        .join('')
      const t = cardTotals(row.strokes, pars)
      const total = t.played
        ? `<strong>${t.strokes}</strong> (${scoreToPar(t.strokes, t.par)})`
        : ''
      const style = row.color === undefined ? '' : ` style="color:${colorCss(row.color)}"`
      const note = row.note ? ` <small>${escapeHtml(row.note)}</small>` : ''
      return `<tr><th class="name"${style}>${escapeHtml(row.name)}${note}</th>${strokeCells}<td class="total">${total}</td></tr>`
    })
    .join('')

  return (
    `<table class="scorecard">` +
    `<tr class="holes"><th class="name">Buraco</th>${head}<th class="total">Total</th></tr>` +
    `<tr class="pars"><th class="name">Par</th>${parRow}<td class="total">${parTotal ?? ''}</td></tr>` +
    body +
    `</table>`
  )
}

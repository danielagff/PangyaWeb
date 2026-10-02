import { describe, expect, it } from 'vitest'
import { isBetter } from './records.ts'
import { cardTotals, scorecardHtml, scoreClass } from './scorecard.ts'

describe('cartão de placar', () => {
  it('classe pelo resultado do buraco', () => {
    expect(scoreClass(1, 3)).toBe('hio')
    expect(scoreClass(2, 5)).toBe('albatross')
    expect(scoreClass(3, 5)).toBe('eagle')
    expect(scoreClass(3, 4)).toBe('birdie')
    expect(scoreClass(4, 4)).toBe('par')
    expect(scoreClass(5, 4)).toBe('bogey')
    expect(scoreClass(7, 4)).toBe('double')
  })

  it('totais só dos buracos jogados', () => {
    expect(cardTotals([4, 3, undefined], [4, 4, 5])).toEqual({ strokes: 7, par: 8, played: 2 })
    expect(cardTotals([], [])).toEqual({ strokes: 0, par: 0, played: 0 })
  })

  it('até 9 buracos: só o total', () => {
    const html = scorecardHtml([1, 2, 3], [4, 3, 5], [{ name: 'Você', strokes: [4, 2, 6] }])
    expect(html).not.toContain('Ida')
    expect(html).toContain('<td class="s-par"><span>4</span></td>')
    expect(html).toContain('<td class="s-birdie"><span>2</span></td>')
    expect(html).toContain('<td class="s-bogey"><span>6</span></td>')
    expect(html).toContain('<strong>12</strong> (E)')
    expect(html).toContain('<td class="total">12</td>') // par total
  })

  it('18 buracos: ida e volta, linha de cada jogador, nome escapado', () => {
    const holes = Array.from({ length: 18 }, (_, i) => i + 1)
    const pars = holes.map(() => 4)
    const html = scorecardHtml(holes, pars, [
      { name: '<Ana>', color: 0xffeb3b, strokes: holes.map((h) => (h <= 9 ? 4 : undefined)) },
    ])
    expect(html).toContain('<th class="sub">Ida</th>')
    expect(html).toContain('<th class="sub">Volta</th>')
    expect(html).toContain('<td class="sub">36</td><td></td>') // par da ida, 1º da volta vazio
    expect(html).toContain('&#60;Ana&#62;')
    expect(html).toContain('color:#ffeb3b')
    expect(html).toContain('<strong>36</strong> (E)')
  })

  it('recorde: menos tacadas ganha', () => {
    const r = (strokes: number) => ({ strokes, par: 36, date: '2026-10-02' })
    expect(isBetter(r(40), undefined)).toBe(true)
    expect(isBetter(r(38), r(40))).toBe(true)
    expect(isBetter(r(40), r(40))).toBe(false)
  })
})

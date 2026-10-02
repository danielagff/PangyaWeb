import { describe, expect, it } from 'vitest'
import { courseName, describePlan, formatHoles, parseHoles, planHoles, soloUrl } from './courses.ts'

const all = Array.from({ length: 18 }, (_, i) => i + 1)

describe('cursos no menu', () => {
  it('nome pelo prefixo conhecido ou pela pasta', () => {
    expect(courseName({ round: 'round02_blue', prefix: 'blue' })).toBe('Blue Lagoon')
    expect(courseName({ round: 'round10_spring wind', prefix: 'pink' })).toBe('Pink Wind')
    expect(courseName({ round: 'round07_west wiz', prefix: 'xx' })).toBe('West Wiz')
    expect(courseName({ round: 'qualquer', prefix: 'q' })).toBe('Qualquer')
  })

  it('plano de buracos: quantidade a partir do primeiro, voltando ao começo', () => {
    expect(planHoles(all, 1, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(planHoles(all, 10, 9)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18])
    expect(planHoles(all, 17, 3)).toEqual([17, 18, 1])
    expect(planHoles(all, 10, 18)).toEqual([...all.slice(9), ...all.slice(0, 9)])
    expect(planHoles([1, 2, 3], 2, 18)).toEqual([2, 3, 1])
    expect(planHoles(all, 99, 1)).toEqual([1]) // buraco que não existe: começa no primeiro
    expect(planHoles([], 1, 9)).toEqual([])
  })

  it('plano na URL: faixas compactas, ida e volta', () => {
    const plan = planHoles(all, 10, 12)
    expect(formatHoles(plan)).toBe('10-18,1-3')
    expect(parseHoles('10-18,1-3')).toEqual(plan)
    expect(formatHoles([7])).toBe('7')
    expect(parseHoles('7')).toEqual([7])
    expect(parseHoles('')).toEqual([])
    expect(parseHoles('a-b')).toEqual([])
    expect(parseHoles('5-2')).toEqual([])
  })

  it('descrição e URL do modo sozinho', () => {
    expect(describePlan(all)).toBe('18 buracos')
    expect(describePlan([4])).toBe('Buraco 4')
    expect(describePlan(planHoles(all, 10, 9))).toBe('Buracos 10–18')
    expect(soloUrl({ round: 'round02_blue', prefix: 'blue' }, [10, 11, 12])).toBe(
      '?curso=round02_blue&prefixo=blue&buraco=10&buracos=10-12',
    )
  })
})

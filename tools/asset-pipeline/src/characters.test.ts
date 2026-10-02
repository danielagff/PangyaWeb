import { describe, expect, it } from 'vitest'
import { parsePartName } from '@pangya/formats'
import { buildCharacterCatalog, defaultPart, slotOf } from './characters.ts'

describe('catálogo de personagens', () => {
  const files = [
    'data/avatar/male/m_def.bpet',
    'data/avatar/male/m_def.apet',
    'data/avatar/male/m_fc_01.mpet',
    'data/avatar/male/m_fc_a_z01.mpet',
    'data/avatar/male/m_ha_10.mpet',
    'data/avatar/male/m_ha_2.mpet',
    'data/avatar/male/m_ts_34_!hn!pv!la!lb!ft.mpet',
    'data/avatar/male/m_ts_35.mpet',
    'data/avatar/male/m_pv_01.mpet',
    'data/avatar/male/m_ft_01.mpet',
    'data/avatar/male/m_hn_01.mpet',
    'data/avatar/male/m_lg_00.mpet',
    'data/avatar/male/m_wi_01.mpet',
    'data/avatar/male/m_skin.jpg',
    'data/avatar/female/f_def.bpet',
    'data/avatar/female/f_ha_01.mpet',
    'data/avatar/female/f_ft_01_sub_lg.mpet',
    'data/avatar/female/f_lg_00.mpet',
    'data/map/hell_mountain01.bpet',
  ]

  it('lê slot e peças escondidas pelo nome', () => {
    expect(slotOf('x/m_ts_34_!hn!pv.mpet')).toBe('ts')
    expect(parsePartName('x/m_ts_34_!hn!pv!la.mpet')).toMatchObject({
      slot: 'ts',
      number: 34,
      accessory: false,
      hides: ['hn', 'pv', 'la'],
    })
    expect(parsePartName('x/h_fc_01_!fc.mpet')).toMatchObject({ number: 1, hides: [] })
    expect(parsePartName('x/h_fc_a_z01.mpet')).toMatchObject({ accessory: true })
    expect(parsePartName('x/h_ha_a09_!ha.mpet')).toMatchObject({ accessory: true, hides: [] })
    expect(parsePartName('x/c_ft_01_sub_lg.mpet').covers).toEqual(['lg'])
  })

  it('peça padrão: a base de menor número, sem acessórios (rosto fc_01_!fc)', () => {
    expect(defaultPart(['h/h_fc_a_z01.mpet', 'h/h_fc_02_!fc.mpet', 'h/h_fc_01_!fc.mpet'])).toBe(
      'h/h_fc_01_!fc.mpet',
    )
    expect(defaultPart(['h/h_ha_a09_!ha.mpet', 'h/h_ha_10.mpet', 'h/h_ha_01.mpet'])).toBe(
      'h/h_ha_01.mpet',
    )
    expect(defaultPart(['c/cc_ft_00.mpet', 'c/cc_ft_01.mpet'])).toBe('c/cc_ft_00.mpet')
  })

  it('agrupa esqueleto, animação e peças da mesma pasta, com roupa padrão completa', () => {
    const catalog = buildCharacterCatalog(files)
    expect(catalog).toHaveLength(2) // hell_mountain01.bpet não é personagem
    const [female, male] = catalog
    expect(male).toMatchObject({
      id: 'data/avatar/male/m_def',
      name: 'Nuri',
      animations: 'data/avatar/male/m_def.apet',
    })
    expect(male!.parts['ha']).toEqual([
      'data/avatar/male/m_ha_2.mpet',
      'data/avatar/male/m_ha_10.mpet',
    ])
    expect(male!.defaults).toEqual([
      'data/avatar/male/m_fc_01.mpet',
      'data/avatar/male/m_ha_2.mpet',
      'data/avatar/male/m_ts_35.mpet',
      'data/avatar/male/m_pv_01.mpet',
      'data/avatar/male/m_ft_01.mpet',
      'data/avatar/male/m_hn_01.mpet',
      'data/avatar/male/m_lg_00.mpet',
    ])
    // Sapato "_sub_lg" já inclui as pernas: a peça lg não entra.
    expect(female).toMatchObject({
      name: 'Hana',
      animations: undefined,
      defaults: ['data/avatar/female/f_ha_01.mpet', 'data/avatar/female/f_ft_01_sub_lg.mpet'],
    })
  })
})

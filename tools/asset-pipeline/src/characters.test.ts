import { describe, expect, it } from 'vitest'
import { buildCharacterCatalog, hiddenSlots, slotOf } from './characters.ts'

describe('catálogo de personagens', () => {
  const files = [
    'data/avatar/male/m_def.bpet',
    'data/avatar/male/m_def.apet',
    'data/avatar/male/m_fc_01.mpet',
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
    expect(hiddenSlots('x/m_ts_34_!hn!pv!la.mpet')).toEqual(['hn', 'pv', 'la'])
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

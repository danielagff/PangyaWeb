/**
 * Nome das peças de personagem (.mpet): `<letra>_<slot>_<código>[_…][_!xx…][_sub_xx]`.
 * - letra: o personagem (h = Kaz: h_def.bpet, h_ha_01.mpet…);
 * - slot: fc rosto, ha cabelo, ts tronco/camisa (ou vestido), pv calça/saia, ft pés,
 *   hn mãos, wi asas…;
 * - código numérico = peça base (ha_01 é o cabelo padrão; o rosto é fc_01_!fc); código
 *   com letra (fc_a_z01, ha_a09) = acessório, que vai junto com a base;
 * - `!xx` = esconde o slot xx (vestido `ts_…_!pv` esconde a saia); `!` do próprio slot
 *   (fc_01_!fc) não esconde nada além da própria base;
 * - `_sub_xx` = a peça também faz o papel do slot xx (sapato `_sub_lg` inclui as pernas).
 * Conferido com o jogo pelo usuário no mapeador de personagens.
 */
export interface PartName {
  prefix: string
  slot: string
  /** Terceiro pedaço do nome ("01", "a"…). */
  code: string
  /** Número do código (peças base), para ordenar; NaN em acessórios. */
  number: number
  accessory: boolean
  /** Outros slots que a peça esconde (sem o próprio). */
  hides: string[]
  /** Slots que a peça também cobre (`_sub_xx`). */
  covers: string[]
}

const stem = (path: string) => (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '').toLowerCase()

export function parsePartName(path: string): PartName {
  const name = stem(path)
  const pieces = name.split('_')
  const prefix = pieces[0] ?? ''
  const slot = pieces[1] ?? 'outro'
  const code = (pieces[2] ?? '').replace(/!.*/, '')
  const accessory = !/^\d+$/.test(code) && code !== 'def'
  const hides = [...name.matchAll(/!([a-z]+)/g)].map((m) => m[1]!).filter((s) => s !== slot)
  const covers = [...name.matchAll(/_sub_([a-z]+)/g)].map((m) => m[1]!)
  return {
    prefix,
    slot,
    code,
    number: code === 'def' ? -1 : accessory ? NaN : Number(code),
    accessory,
    hides,
    covers,
  }
}

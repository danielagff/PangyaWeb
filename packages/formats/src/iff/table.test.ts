import { zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { clubLayout } from './layouts.ts'
import { readGameData } from './game-data.ts'
import { IFF_HEADER_SIZE, parseIffTable } from './table.ts'

/** Monta uma tabela Club.iff sintética. */
function clubTable(clubs: { typeId: number; name: string; kind: number; model: string }[]) {
  const bytes = new Uint8Array(IFF_HEADER_SIZE + clubs.length * clubLayout.size)
  const view = new DataView(bytes.buffer)
  view.setUint16(0, clubs.length, true)
  view.setUint32(4, 13, true)
  clubs.forEach((club, i) => {
    const at = IFF_HEADER_SIZE + i * clubLayout.size
    view.setUint32(at, 1, true) // active
    view.setUint32(at + 4, club.typeId, true)
    bytes.set(new TextEncoder().encode(club.name), at + 8)
    bytes.set(new TextEncoder().encode(club.model), at + 192)
    view.setUint16(at + 232, club.kind, true)
    view.setUint16(at + 234, 7, true) // power
  })
  return bytes
}

describe('parseIffTable', () => {
  it('lê cabeçalho e registros', () => {
    const table = parseIffTable(
      clubTable([
        { typeId: 0x0c000000, name: 'Wood', kind: 0, model: 'club_w' },
        { typeId: 0x0c000003, name: 'Putter', kind: 3, model: 'club_p' },
      ]),
      clubLayout,
    )
    expect(table.version).toBe(13)
    expect(table.records).toHaveLength(2)
    expect(table.records[1]).toMatchObject({
      typeId: 0x0c000003,
      name: 'Putter',
      model: 'club_p',
      kind: 3,
      stats: [7, 0, 0, 0, 0],
    })
  })

  it('rejeita tabela cujo tamanho não bate com o layout', () => {
    const bytes = clubTable([{ typeId: 1, name: 'x', kind: 0, model: 'm' }])
    expect(() =>
      parseIffTable(bytes.subarray(0, bytes.length - 1), clubLayout, 'Club.iff'),
    ).toThrow(/Club\.iff: tamanho/)
  })

  it('aponta tabela ausente no arquivo .iff', () => {
    const zip = zipSync({ 'Club.iff': clubTable([]) })
    expect(() => readGameData(zip)).toThrow(/Character\.iff não encontrado/)
  })
})

import { describe, expect, it } from 'vitest'
import { PakVfs, sortPaks } from './vfs.ts'

describe('sortPaks', () => {
  it('monta pacotes base antes dos patches numerados', () => {
    expect(
      sortPaks(['ProjectG986.pak', 'projectg_city.pak', 'ProjectG984.pak', 'ProjectG_Jp_Blue.pak']),
    ).toEqual(['projectg_city.pak', 'ProjectG_Jp_Blue.pak', 'ProjectG984.pak', 'ProjectG986.pak'])
  })
})

describe('PakVfs', () => {
  const entry = (path: string, size: number) =>
    ({ path, size, type: 'raw', offset: 0, compressedSize: size }) as const

  it('o último pacote montado sobrescreve, sem diferenciar maiúsculas', () => {
    const vfs = new PakVfs()
    vfs.mount('base.pak', [entry('Data/Item.iff', 1)])
    vfs.mount('ProjectG986.pak', [entry('data/item.iff', 2)])
    expect(vfs.size).toBe(1)
    expect(vfs.get('DATA\\ITEM.IFF')).toMatchObject({ pak: 'ProjectG986.pak', size: 2 })
  })

  it('ignora diretórios', () => {
    const vfs = new PakVfs()
    vfs.mount('a.pak', [
      { path: 'model', type: 'directory', offset: 0, size: 0, compressedSize: 0 },
    ])
    expect(vfs.size).toBe(0)
  })
})

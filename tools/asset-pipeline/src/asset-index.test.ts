import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildAssetIndex } from './asset-index.ts'

describe('buildAssetIndex', () => {
  it('indexa pelo nome em minúsculas; repetidos viram lista do mais curto ao mais longo', () => {
    const root = mkdtempSync(join(tmpdir(), 'assets-'))
    for (const path of ['round10_spring wind/ase/Tree.pet', 'data/ase/tree.pet', 'x/house.pet']) {
      mkdirSync(join(root, path, '..'), { recursive: true })
      writeFileSync(join(root, path), '')
    }
    expect(buildAssetIndex(root)).toEqual({
      'tree.pet': ['data/ase/tree.pet', 'round10_spring wind/ase/Tree.pet'],
      'house.pet': 'x/house.pet',
    })
  })
})

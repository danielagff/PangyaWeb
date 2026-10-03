import { describe, expect, it } from 'vitest'
import { parseFrameCommands } from './frame-commands.ts'

describe('comandos dos quadros (FRAM)', () => {
  it('separa vários comandos, com e sem aspas', () => {
    expect(
      parseFrameCommands(
        '*ball_dist 5.4 *grip_pos -0.02 *fx("@우드샷파워준비" "PowerShot_Cluster.seq" "club_near")',
      ),
    ).toEqual([
      { name: 'ball_dist', args: ['5.4'] },
      { name: 'grip_pos', args: ['-0.02'] },
      { name: 'fx', args: ['@우드샷파워준비', 'PowerShot_Cluster.seq', 'club_near'] },
    ])
  })

  it('comandos sem argumento e nomes com hífen dentro das aspas', () => {
    expect(parseFrameCommands('*swing *snd("f-점프") *stepsnd() *shot')).toEqual([
      { name: 'swing', args: [] },
      { name: 'snd', args: ['f-점프'] },
      { name: 'stepsnd', args: [] },
      { name: 'shot', args: [] },
    ])
  })

  it('ignora lixo antes do primeiro comando e aspas coladas', () => {
    expect(parseFrameCommands('v*hidebone("a" "b")*showbone("c")')).toEqual([
      { name: 'hidebone', args: ['a', 'b'] },
      { name: 'showbone', args: ['c'] },
    ])
  })
})

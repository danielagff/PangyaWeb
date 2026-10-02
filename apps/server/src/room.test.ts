import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { HoleWorld, loadHoleData, type ServerMessage } from '@pangya/game'
import { describe, expect, it } from 'vitest'
import { DiskFiles, listCourses } from './files.ts'
import { Room } from './room.ts'

const original = resolve(import.meta.dirname, '../../../assets/original')
const hasBlue = existsSync(resolve(original, 'data/round02_blue/map/blue_01.gbin'))

/** Jogador falso: guarda tudo o que o servidor manda. */
function peer() {
  const inbox: ServerMessage[] = []
  return { inbox, send: (m: ServerMessage) => inbox.push(m) }
}

describe.skipIf(!hasBlue)('sala com o Blue Lagoon (assets locais)', () => {
  const files = new DiskFiles(original)

  it('lista o curso de exemplo', () => {
    expect(listCourses(original)).toContainEqual(
      expect.objectContaining({ round: 'round02_blue', prefix: 'blue' }),
    )
  })

  it('dois jogadores jogam o buraco 1 até o fim, um de cada vez', async () => {
    const room = new Room(files, { holeEndDelay: 0 })
    const a = peer()
    const b = peer()
    const ida = room.connect(a)
    const idb = room.connect(b)
    await room.handle(ida, { t: 'hello', name: 'Ana' })
    await room.handle(idb, { t: 'hello', name: 'Bia' })
    expect(room.match.host).toBe(ida)

    await room.handle(idb, {
      t: 'start',
      course: { round: 'round02_blue', prefix: 'blue', holes: [1] },
    })
    expect(b.inbox.at(-1)).toMatchObject({ t: 'error' }) // só o anfitrião começa

    await room.handle(ida, {
      t: 'start',
      course: { round: 'round02_blue', prefix: 'blue', holes: [1] },
    })
    expect(room.match.phase).toBe('playing')

    // Fora da vez: recusado.
    const other = room.match.turn === ida ? idb : ida
    await room.handle(other, { t: 'shot', request: { club: '1W', percent: 1, aim: 0 } })
    expect((other === ida ? a : b).inbox.at(-1)).toMatchObject({ t: 'error' })

    // Cada um joga a tacada sugerida mirando no pin até o buraco acabar.
    const world = new HoleWorld(
      await loadHoleData(
        files,
        { round: 'round02_blue', prefix: 'blue', hole: 1 },
        { withModels: false },
      ),
    )
    for (let i = 0; i < 40 && room.match.phase === 'playing'; i++) {
      const turn = room.match.turn!
      const state = room.match.players.find((p) => p.id === turn)!.state!
      const { club, percent } = world.suggestClub(state)
      await room.handle(turn, {
        t: 'shot',
        request: { club, percent, aim: world.aimAtPin(state.ball) },
      })
    }
    expect(room.match.phase).toBe('finished')
    expect(room.match.players.every((p) => p.card.length === 1)).toBe(true)
    // Os dois receberam as mesmas tacadas.
    const shots = (inbox: ServerMessage[]) => inbox.filter((m) => m.t === 'shot').length
    expect(shots(a.inbox)).toBe(shots(b.inbox))
    expect(shots(a.inbox)).toBeGreaterThanOrEqual(4)
  })
})

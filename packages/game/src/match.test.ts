import { describe, expect, it } from 'vitest'
import {
  advanceHole,
  applyMatchShot,
  createMatch,
  joinMatch,
  leaveMatch,
  startMatchHole,
  totals,
} from './match.ts'

const pin = { x: 0, y: 0, z: 400 }
const tee = { x: 0, y: 0, z: 0 }
const setup = { par: 3, tee, wind: { speed: 2, degree: 90 } }
const course = { round: 'r', prefix: 'p', holes: [1, 2] }
const at = (z: number) => ({ x: 0, y: 0, z })

function twoPlayers() {
  let m = createMatch()
  m = joinMatch(m, 'a', 'Ana')
  m = joinMatch(m, 'b', 'Bia')
  return startMatchHole(m, course, setup)
}

describe('partida multiplayer', () => {
  it('o primeiro a entrar é o anfitrião e começa no tee', () => {
    const m = twoPlayers()
    expect(m).toMatchObject({ host: 'a', phase: 'playing', turn: 'a' })
    expect(m.players.map((p) => p.state?.ball)).toEqual([tee, tee])
  })

  it('depois do tee joga quem está mais longe do pin', () => {
    let m = twoPlayers()
    m = applyMatchShot(m, 'a', { type: 'stop', at: at(300), surface: 'fairway' }, pin)
    expect(m.turn).toBe('b') // b ainda no tee
    m = applyMatchShot(m, 'b', { type: 'stop', at: at(200), surface: 'fairway' }, pin)
    expect(m.turn).toBe('b') // b está mais longe
    expect(() => applyMatchShot(m, 'a', { type: 'hole', at: pin }, pin)).toThrow(/vez/)
  })

  it('fecha o buraco no cartão, dá a honra a quem foi melhor e termina a partida', () => {
    let m = twoPlayers()
    m = applyMatchShot(m, 'a', { type: 'stop', at: at(390), surface: 'green' }, pin)
    m = applyMatchShot(m, 'b', { type: 'hole', at: pin }, pin) // hole in one
    m = applyMatchShot(m, 'a', { type: 'hole', at: pin }, pin)
    expect(m.phase).toBe('holeEnd')
    expect(m.players.map((p) => p.card)).toEqual([
      [{ hole: 1, strokes: 2, par: 3 }],
      [{ hole: 1, strokes: 1, par: 3 }],
    ])
    m = advanceHole(m, setup)
    expect(m).toMatchObject({ holeIndex: 1, turn: 'b' })
    m = applyMatchShot(m, 'b', { type: 'hole', at: pin }, pin)
    m = applyMatchShot(m, 'a', { type: 'hole', at: pin }, pin)
    expect(m.phase).toBe('finished')
    expect(totals(m.players[1]!)).toEqual({ strokes: 2, par: 6, diff: -4 })
  })

  it('quem cai perde a vez e volta com o mesmo nome mantendo o placar', () => {
    let m = twoPlayers()
    m = leaveMatch(m, 'a')
    expect(m).toMatchObject({ turn: 'b', host: 'b' })
    m = joinMatch(m, 'a2', 'Ana')
    expect(m.players).toHaveLength(2)
    expect(m.players[0]).toMatchObject({ id: 'a2', connected: true })
    expect(m.host).toBe('a2')
  })

  it('no lobby, quem sai é removido', () => {
    let m = joinMatch(createMatch(), 'a', 'Ana')
    m = leaveMatch(m, 'a')
    expect(m.players).toEqual([])
    expect(m.host).toBeUndefined()
  })
})

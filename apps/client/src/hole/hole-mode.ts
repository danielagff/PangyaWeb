import {
  applyShot,
  describeShot,
  isChipIn,
  randomWind,
  scoreName,
  scoreToPar,
  startHole,
  type HoleRef,
} from '@pangya/game'
import { chosenCharacter } from '../character/character.ts'
import { reactionForScore } from '../character/motions.ts'
import { playerPower } from '../settings.ts'
import { HoleView } from './hole-view.ts'

/** Cartão de placar carregado de buraco em buraco pela URL: "4:4,3:3" (tacadas:par). */
function readCard(): { strokes: number; par: number }[] {
  const raw = new URLSearchParams(location.search).get('cartao') ?? ''
  return raw
    .split(',')
    .filter(Boolean)
    .map((item) => {
      const [strokes = 0, par = 0] = item.split(':').map(Number)
      return { strokes, par }
    })
}

function holeUrl(hole: number, card: { strokes: number; par: number }[]) {
  const params = new URLSearchParams(location.search)
  params.set('buraco', String(hole))
  if (card.length) params.set('cartao', card.map((c) => `${c.strokes}:${c.par}`).join(','))
  else params.delete('cartao')
  return `${location.pathname}?${params}`
}

/** Jogo sozinho: um buraco, com o placar seguindo pela URL de buraco em buraco. */
export async function startHoleMode(ref: HoleRef) {
  const view = await HoleView.create(ref)
  const { world } = view
  const card = readCard()
  const character =
    new URLSearchParams(location.search).get('personagem') ?? (await chosenCharacter())
  const me = { id: 'eu', name: 'Você', color: 0xffffff, character, power: playerPower() }
  let state = startHole(world.par, world.tee)
  // Vento sorteado no início do buraco (no modo sozinho dá para mudar no painel).
  const wind = randomWind()
  view.setWind(wind)

  const total = card.reduce((n, c) => n + c.strokes, 0)
  const totalPar = card.reduce((n, c) => n + c.par, 0)
  view.hudExtra = card.length ? `Total ${total} (${scoreToPar(total, totalPar)})` : ''
  view.setPlayers([{ ...me, state }], me.id, true)

  view.onShoot = async (request) => {
    const played = world.play(state, request, wind)
    const from = state.ball
    await view.animateShot(me.id, played.frames, {
      aim: request.aim,
      club: request.club,
      events: played.events,
      ...(played.impact !== undefined && { impact: played.impact }),
    })
    state = applyShot(state, played.outcome)
    view.showResult(describeShot(from, played))
    // Reação do personagem: comemora ao embocar, lamenta água/O.B.
    const type = played.outcome.type
    const pose =
      type === 'hole'
        ? view.react(me.id, reactionForScore(state.strokes, state.par))
        : type === 'water' || type === 'outOfBounds'
          ? view.react(me.id, 'trouble')
          : 0
    if (pose) await new Promise((r) => setTimeout(r, Math.min(pose, 3) * 1000))
    view.setPlayers([{ ...me, state }], state.finished ? undefined : me.id, true)
    if (state.finished) endHole()
  }

  function endHole() {
    const holed = state.result === 'holed'
    const name = holed ? scoreName(state.strokes, state.par) : 'Desistência'
    const extra = isChipIn(state) ? ' — Chip-in!' : ''
    const nextCard = [...card, { strokes: state.strokes, par: state.par }]
    const sum = nextCard.reduce((n, c) => n + c.strokes, 0)
    const sumPar = nextCard.reduce((n, c) => n + c.par, 0)
    view.overlay(`
      <h2>${name}${extra}</h2>
      <p>${state.strokes} tacadas no par ${state.par} (${scoreToPar(state.strokes, state.par)})
        ${state.penalties ? `· ${state.penalties} de penalidade` : ''}</p>
      <p>Placar: ${nextCard.map((c) => c.strokes).join(' · ')} — total ${sum}
        (${scoreToPar(sum, sumPar)})</p>
      <div>
        ${ref.hole < 18 ? `<a class="button" href="${holeUrl(ref.hole + 1, nextCard)}">Próximo buraco</a>` : ''}
        <a class="button secondary" href="${holeUrl(ref.hole, card)}">Jogar de novo</a>
        <a class="button secondary" href="/">Menu</a>
      </div>`)
  }
}

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
import { courseName, describePlan, formatHoles, parseHoles, soloUrl } from '../menu/courses.ts'
import { saveRecord } from '../menu/records.ts'
import { cardTotals, scorecardHtml } from '../menu/scorecard.ts'
import { playerPower } from '../settings.ts'
import { HoleView } from './hole-view.ts'

type CardEntry = { strokes: number; par: number }

/** Cartão de placar carregado de buraco em buraco pela URL: "4:4,3:3" (tacadas:par). */
function readCard(): CardEntry[] {
  const raw = new URLSearchParams(location.search).get('cartao') ?? ''
  return raw
    .split(',')
    .filter(Boolean)
    .map((item) => {
      const [strokes = 0, par = 0] = item.split(':').map(Number)
      return { strokes, par }
    })
}

/**
 * Buracos da rodada (`buracos=1-9` na URL, escolhidos no menu). Link antigo, sem o plano:
 * do primeiro buraco jogado até o 18, como antes.
 */
function readPlan(hole: number, played: number): number[] {
  const plan = parseHoles(new URLSearchParams(location.search).get('buracos'))
  if (plan.includes(hole)) return plan
  const from = Math.max(1, hole - played)
  return Array.from({ length: Math.max(18, hole) - from + 1 }, (_, i) => from + i)
}

function holeUrl(hole: number, plan: number[], card: CardEntry[]) {
  const params = new URLSearchParams(location.search)
  params.set('buraco', String(hole))
  params.set('buracos', formatHoles(plan))
  if (card.length) params.set('cartao', card.map((c) => `${c.strokes}:${c.par}`).join(','))
  else params.delete('cartao')
  return `${location.pathname}?${params}`
}

const today = () => new Date().toISOString().slice(0, 10)

/** Jogo sozinho: um buraco por página, com o placar seguindo pela URL até o fim do plano. */
export async function startHoleMode(ref: HoleRef) {
  const view = await HoleView.create(ref)
  const { world } = view
  const allCard = readCard()
  const plan = readPlan(ref.hole, allCard.length)
  /** Posição deste buraco na rodada; o cartão guarda os anteriores, na ordem do plano. */
  const at = plan.indexOf(ref.hole)
  const card = allCard.slice(0, at)
  const character =
    new URLSearchParams(location.search).get('personagem') ?? (await chosenCharacter())
  const me = { id: 'eu', name: 'Você', color: 0xffffff, character, power: playerPower() }
  let state = startHole(world.par, world.tee)
  // Vento sorteado no início do buraco (no modo sozinho dá para mudar no painel).
  const wind = randomWind()
  view.setWind(wind)

  const total = card.reduce((n, c) => n + c.strokes, 0)
  const totalPar = card.reduce((n, c) => n + c.par, 0)
  view.hudExtra = [
    plan.length > 1 ? `Rodada: buraco ${at + 1} de ${plan.length}` : '',
    card.length ? `Total ${total} (${scoreToPar(total, totalPar)})` : '',
  ]
    .filter(Boolean)
    .join(' · ')
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
    const nextCard = [...card, { strokes: state.strokes, par: state.par }]
    const strokes = plan.map((_, i) => nextCard[i]?.strokes)
    const pars = plan.map((_, i) => nextCard[i]?.par)
    const table = scorecardHtml(plan, pars, [{ name: 'Você', strokes }])
    const next = plan[at + 1]
    const box = next === undefined ? roundEnd(strokes, pars, table) : holeEnd(next, nextCard, table)
    // Enter = botão principal (próximo buraco / jogar de novo).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      box.querySelector<HTMLAnchorElement>('[data-primary]')?.click()
    }
    window.addEventListener('keydown', onKey)
  }

  /** Quadro do fim de um buraco, com o cartão até aqui. */
  function holeEnd(next: number, nextCard: CardEntry[], table: string) {
    const holed = state.result === 'holed'
    const name = holed ? scoreName(state.strokes, state.par) : 'Desistência'
    const extra = isChipIn(state) ? ' — Chip-in!' : ''
    return view.overlay(`
      <h2>${name}${extra}</h2>
      <p>${state.strokes} tacadas no par ${state.par} (${scoreToPar(state.strokes, state.par)})
        ${state.penalties ? `· ${state.penalties} de penalidade` : ''}</p>
      <div class="card-wrap">${table}</div>
      <div>
        <a class="button" data-primary href="${holeUrl(next, plan, nextCard)}">Próximo buraco (Enter)</a>
        <a class="button secondary" href="${holeUrl(ref.hole, plan, card)}">Jogar este de novo</a>
        <a class="button secondary" href="/">Menu</a>
      </div>`)
  }

  /** Fim da rodada: cartão completo, total e recorde. */
  function roundEnd(strokes: (number | undefined)[], pars: (number | undefined)[], table: string) {
    const t = cardTotals(strokes, pars)
    const holed = state.result === 'holed'
    const last = holed ? scoreName(state.strokes, state.par) : 'Desistência'
    // Recorde só de rodada completa (todos os buracos do plano jogados).
    let record = ''
    if (t.played === plan.length) {
      const { previous, isNew } = saveRecord(ref.round, plan, {
        strokes: t.strokes,
        par: t.par,
        date: today(),
      })
      record = isNew
        ? `<p class="record new">🏆 Novo recorde!${previous ? ` (antes: ${previous.strokes})` : ''}</p>`
        : `<p class="record">Recorde: ${previous!.strokes} (${scoreToPar(previous!.strokes, previous!.par)})</p>`
    }
    const course = { round: ref.round, prefix: ref.prefix }
    return view.overlay(`
      <h2>Fim da rodada!</h2>
      <p class="round-total"><strong>${t.strokes}</strong> tacadas
        (${scoreToPar(t.strokes, t.par)})</p>
      <p>${courseName(course)} · ${describePlan(plan)} · último buraco: ${last}</p>
      ${record}
      <div class="card-wrap">${table}</div>
      <div>
        <a class="button" data-primary href="${soloUrl(course, plan)}">Jogar de novo (Enter)</a>
        <a class="button secondary" href="/#curso">Outro curso</a>
        <a class="button secondary" href="/">Menu</a>
      </div>`)
  }
}

import {
  decodeFrames,
  scoreName,
  scoreToPar,
  totals,
  type Course,
  type MatchState,
  type ServerMessage,
} from '@pangya/game'
import { HoleView, type ViewPlayer } from '../hole/hole-view.ts'
import { connect } from './connection.ts'

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const colorCss = (color: number) => `#${color.toString(16).padStart(6, '0')}`

function rememberedName() {
  try {
    return localStorage.getItem('pangyaweb.nome') ?? ''
  } catch {
    return ''
  }
}
function rememberName(name: string) {
  try {
    localStorage.setItem('pangyaweb.nome', name)
  } catch {
    // sem armazenamento (janela anônima): só não lembra o nome
  }
}

/** Placar da partida, ordenado pelo total (menor primeiro). */
function scoreboard(match: MatchState) {
  const holes = match.course?.holes ?? []
  const ranked = [...match.players].sort((a, b) => totals(a).strokes - totals(b).strokes)
  const head = holes.map((h) => `<th>${h}</th>`).join('')
  const rows = ranked
    .map((p) => {
      const cells = holes
        .map((h) => {
          const c = p.card.find((x) => x.hole === h)
          return `<td>${c ? c.strokes : ''}</td>`
        })
        .join('')
      const t = totals(p)
      return (
        `<tr><td style="color:${colorCss(p.color)}">${escapeHtml(p.name)}${p.connected ? '' : ' (saiu)'}</td>` +
        `${cells}<td><strong>${t.strokes}</strong> (${scoreToPar(t.strokes, t.par)})</td></tr>`
      )
    })
    .join('')
  return `<table class="scoreboard"><tr><th>Jogador</th>${head}<th>Total</th></tr>${rows}</table>`
}

/** Multiplayer: sala de espera, chat e o buraco em turnos, com o servidor como juiz. */
export function startOnlineMode() {
  let myId = ''
  let match: MatchState | undefined
  let view: HoleView | undefined
  let viewKey = ''
  let loading: Promise<void> | undefined
  /** Tacadas recebidas, animadas uma de cada vez; o estado novo espera a animação. */
  let animating: Promise<void> = Promise.resolve()
  let courses: Course[] = []
  /** Fase/buraco do último quadro de resultado mostrado (para não repetir). */
  let overlayKey = ''

  // ---- sala de espera ----
  const lobby = document.createElement('div')
  lobby.className = 'lobby'
  lobby.innerHTML = `
    <h1>PangyaWeb — sala</h1>
    <form class="join">
      <input name="name" maxlength="16" placeholder="Seu nome" required />
      <button>Entrar</button>
    </form>
    <div class="room" hidden>
      <h2>Jogadores</h2>
      <ul class="players"></ul>
      <div class="host" hidden>
        <h2>Partida</h2>
        <label>Curso <select name="course"></select></label>
        <label>Buracos <select name="holes">
          <option value="1">1 buraco</option><option value="3">3 buracos</option>
          <option value="9">9 buracos</option><option value="18">18 buracos</option>
        </select></label>
        <label>Começar no buraco <input name="first" type="number" min="1" max="18" value="1" /></label>
        <button class="start">Começar partida</button>
      </div>
      <p class="wait" hidden>Aguardando o anfitrião começar a partida…</p>
    </div>
    <p class="error"></p>
    <p><a href="/">← Menu</a></p>
  `
  document.body.appendChild(lobby)
  const $ = <T extends Element>(selector: string) => lobby.querySelector(selector) as T
  const nameInput = $<HTMLInputElement>('input[name=name]')
  nameInput.value = rememberedName()

  // ---- chat (sala e jogo) ----
  const chat = document.createElement('div')
  chat.className = 'chat'
  chat.innerHTML = `<div class="log"></div><input placeholder="Mensagem (Enter)" maxlength="200" />`
  document.body.appendChild(chat)
  const chatLog = chat.querySelector('.log') as HTMLDivElement
  const chatInput = chat.querySelector('input') as HTMLInputElement
  const say = (html: string) => {
    const line = document.createElement('div')
    line.innerHTML = html
    chatLog.append(line)
    while (chatLog.children.length > 8) chatLog.firstElementChild!.remove()
    chatLog.scrollTop = chatLog.scrollHeight
  }

  const server = connect(onMessage, () =>
    say('<em>Conexão com o servidor caiu. Recarregue a página.</em>'),
  )

  $('form.join').addEventListener('submit', (e) => {
    e.preventDefault()
    const name = nameInput.value.trim()
    if (!name) return
    rememberName(name)
    server.send({ t: 'hello', name })
  })
  chatInput.addEventListener('keydown', (e) => {
    e.stopPropagation() // espaço e setas no chat não mexem no jogo
    if (e.key === 'Enter' && chatInput.value.trim()) {
      server.send({ t: 'chat', text: chatInput.value })
      chatInput.value = ''
    }
  })
  $('button.start').addEventListener('click', () => {
    const course = courses[Number($<HTMLSelectElement>('select[name=course]').value)]
    if (!course) return
    const count = Number($<HTMLSelectElement>('select[name=holes]').value)
    const first = Number($<HTMLInputElement>('input[name=first]').value) || 1
    const start = Math.max(0, course.holes.indexOf(first))
    const holes = course.holes.slice(start, start + count)
    server.send({ t: 'start', course: { ...course, holes } })
  })

  void fetch('/api/courses')
    .then((r) => (r.ok ? (r.json() as Promise<Course[]>) : []))
    .then((list) => {
      courses = list
      $<HTMLSelectElement>('select[name=course]').innerHTML = list
        .map((c, i) => `<option value="${i}">${c.round} (${c.holes.length} buracos)</option>`)
        .join('')
    })
    .catch(() => {})

  function renderLobby(m: MatchState) {
    const joined = m.players.some((p) => p.id === myId)
    $<HTMLFormElement>('form.join').hidden = joined
    $<HTMLDivElement>('.room').hidden = !joined
    $('.players').innerHTML = m.players
      .map(
        (p) =>
          `<li style="color:${colorCss(p.color)}">${escapeHtml(p.name)}` +
          `${p.id === m.host ? ' 👑' : ''}${p.id === myId ? ' (você)' : ''}` +
          `${p.connected ? '' : ' (saiu)'}</li>`,
      )
      .join('')
    const isHost = m.host === myId
    $<HTMLDivElement>('.host').hidden = !isHost
    $<HTMLParagraphElement>('.wait').hidden = isHost || !joined
  }

  // ---- jogo ----
  function viewPlayers(m: MatchState): ViewPlayer[] {
    return m.players
      .filter((p) => p.state)
      .map((p) => ({ id: p.id, name: p.name, color: p.color, state: p.state! }))
  }

  async function showMatch(m: MatchState) {
    if (m.phase === 'lobby' || !m.course) {
      lobby.hidden = false
      renderLobby(m)
      return
    }
    const hole = m.course.holes[m.holeIndex]!
    const key = `${m.course.round}/${m.course.prefix}/${hole}`
    if (key !== viewKey) {
      view?.dispose()
      view = undefined
      viewKey = key
      lobby.hidden = true
      const created = HoleView.create(
        { round: m.course.round, prefix: m.course.prefix, hole },
        { lockWind: true },
      ).then((v) => {
        view = v
        v.onShoot = (request) => server.send({ t: 'shot', request })
      })
      loading = created
      await created
      if (viewKey !== key) return // outro buraco chegou enquanto carregava
    } else if (loading) {
      await loading
    }
    if (!view || !match) return
    applyToView(match)
  }

  function applyToView(m: MatchState) {
    if (!view) return
    view.setWind(m.wind)
    const me = m.players.find((p) => p.id === myId)
    const t = me ? totals(me) : undefined
    view.hudExtra =
      `Vento ${m.wind.speed} m` +
      (t && me!.card.length ? ` · Seu total ${t.strokes} (${scoreToPar(t.strokes, t.par)})` : '')
    const playing = m.phase === 'playing'
    view.setPlayers(viewPlayers(m), playing ? m.turn : undefined, playing && m.turn === myId)
    const key = `${m.phase}:${m.holeIndex}`
    if ((m.phase === 'holeEnd' || m.phase === 'finished') && key !== overlayKey) {
      overlayKey = key
      const results = m.players
        .filter((p) => p.state)
        .map((p) => {
          const s = p.state!
          const label = s.result === 'holed' ? scoreName(s.strokes, s.par) : 'Desistência'
          return `<li style="color:${colorCss(p.color)}">${escapeHtml(p.name)}: ${s.strokes} — ${label}</li>`
        })
        .join('')
      const finished = m.phase === 'finished'
      const box = view.overlay(`
        <h2>${finished ? 'Fim da partida!' : `Buraco ${m.course!.holes[m.holeIndex]} concluído`}</h2>
        <ul class="results">${results}</ul>
        ${scoreboard(m)}
        <p>${finished ? '' : 'Próximo buraco em alguns segundos…'}</p>
        ${finished ? '<div><a class="button" href="#" data-back>Voltar à sala</a></div>' : ''}`)
      box.querySelector('[data-back]')?.addEventListener('click', (e) => {
        e.preventDefault()
        view?.dispose()
        view = undefined
        viewKey = ''
        overlayKey = ''
        lobby.hidden = false
        renderLobby({ ...m, phase: 'lobby' })
      })
    }
  }

  function onMessage(message: ServerMessage) {
    switch (message.t) {
      case 'welcome':
        myId = message.id
        if (nameInput.value.trim()) server.send({ t: 'hello', name: nameInput.value.trim() })
        break
      case 'match': {
        const previous = match
        match = message.match
        $<HTMLParagraphElement>('.error').textContent = ''
        // O estado novo só aparece depois da animação da tacada que o gerou.
        const m = message.match
        animating = animating.then(() => {
          if (previous?.phase === 'finished' && m.phase === 'finished') return
          return showMatch(m)
        })
        break
      }
      case 'shot': {
        const name = match?.players.find((p) => p.id === message.playerId)?.name ?? '?'
        const frames = decodeFrames(message.frames)
        animating = animating.then(async () => {
          if (loading) await loading
          if (!view) return
          await view.animateShot(message.playerId, frames, {
            events: message.events,
            ...(message.impact !== undefined && { impact: message.impact }),
          })
          view.showResult(`${name}: ${message.message}`)
          say(`<strong>${escapeHtml(name)}</strong>: ${escapeHtml(message.message)}`)
        })
        break
      }
      case 'chat':
        say(`<strong>${escapeHtml(message.from)}</strong>: ${escapeHtml(message.text)}`)
        break
      case 'error':
        $<HTMLParagraphElement>('.error').textContent = message.message
        say(`<em>⚠ ${escapeHtml(message.message)}</em>`)
        // Libera o painel de novo se a tacada foi recusada.
        if (match && view) applyToView(match)
        break
    }
  }
}

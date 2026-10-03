/**
 * Menu do jogo (spec 15): título → personagem (prévia 3D e força) → curso e buracos.
 * Cada tela tem endereço próprio (#sozinho, #amigos, #curso), então o "voltar" do navegador
 * funciona. Tudo dá para fazer só com o teclado: setas escolhem, Enter confirma, Esc volta.
 */
import { scoreToPar, type Course } from '@pangya/game'
import {
  chosenCharacter,
  loadCatalog,
  rememberCharacter,
  type CharacterEntry,
} from '../character/character.ts'
import { SOUND_EVENTS } from '../audio/sound-events.ts'
import { sound } from '../audio/sounds.ts'
import { volumePanel } from '../audio/volume-panel.ts'
import { powerInput } from '../settings.ts'
import { CharacterPreview } from './character-preview.ts'
import { courseName, describePlan, HOLE_COUNTS, planHoles, soloUrl } from './courses.ts'
import { readRecord } from './records.ts'

type Screen = 'title' | 'solo' | 'friends' | 'course'

const SCREEN_HASH: Record<Screen, string> = {
  title: '',
  solo: '#sozinho',
  friends: '#amigos',
  course: '#curso',
}

const screenFromHash = (): Screen =>
  (Object.entries(SCREEN_HASH).find(([, hash]) => hash && hash === location.hash)?.[0] as
    Screen | undefined) ?? 'title'

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Última escolha de curso no menu (para abrir no mesmo lugar da próxima vez). */
interface CourseChoice {
  round: string
  count: number
  first: number
}
const CHOICE_KEY = 'pangyaweb.menu.curso'
function readChoice(): Partial<CourseChoice> {
  try {
    return JSON.parse(localStorage.getItem(CHOICE_KEY) ?? '{}') as Partial<CourseChoice>
  } catch {
    return {}
  }
}
function saveChoice(choice: CourseChoice) {
  try {
    localStorage.setItem(CHOICE_KEY, JSON.stringify(choice))
  } catch {
    // sem armazenamento: só não lembra
  }
}

/** Cursos do servidor da partida; sem ele (pnpm dev sozinho), o Blue Lagoon de exemplo. */
function loadCourses(): Promise<Course[]> {
  return fetch('/api/courses')
    .then((r) => (r.ok ? (r.json() as Promise<Course[]>) : []))
    .catch(() => [] as Course[])
    .then((list) =>
      list.length
        ? list
        : [
            {
              round: 'round02_blue',
              prefix: 'blue',
              holes: Array.from({ length: 18 }, (_, i) => i + 1),
            },
          ],
    )
}

/** Teclas que não devem mexer no menu quando o foco está num campo. */
const typing = (e: KeyboardEvent) =>
  e.target instanceof HTMLInputElement ||
  e.target instanceof HTMLSelectElement ||
  e.target instanceof HTMLTextAreaElement

export function showMenu() {
  const root = document.createElement('div')
  root.className = 'menu'
  document.body.appendChild(root)
  const courses = loadCourses()
  const catalog = loadCatalog()

  /** Ações da tela atual (teclado) e limpeza ao sair dela. */
  let keys: (e: KeyboardEvent) => void = () => {}
  let leave: () => void = () => {}

  const urlFor = (screen: Screen) => `${location.pathname}${location.search}${SCREEN_HASH[screen]}`
  /** Quantas telas do menu há antes desta no histórico (0 = abriu direto nela). */
  const depth = () => (history.state as { menuDepth?: number } | null)?.menuDepth ?? 0

  /** Vai para outra tela (entra no histórico: o "voltar" do navegador funciona). */
  function navigate(screen: Screen) {
    history.pushState({ menuDepth: depth() + 1 }, '', urlFor(screen))
    render()
  }

  /** Volta para a tela anterior: pelo histórico se veio pelo menu; senão, troca no lugar. */
  function goBack(screen: Screen) {
    if (depth() > 0) {
      history.back()
      return
    }
    history.replaceState(null, '', urlFor(screen))
    render()
  }

  function render() {
    leave()
    leave = () => {}
    keys = () => {}
    const screen = screenFromHash()
    root.dataset['screen'] = screen
    if (screen === 'title') titleScreen()
    else if (screen === 'course') void courseScreen()
    else void characterScreen(screen)
  }

  window.addEventListener('popstate', render)
  window.addEventListener('keydown', (e) => {
    if (typing(e)) {
      if (e.key === 'Escape') (e.target as HTMLElement).blur()
      return
    }
    // Sons do menu: setas mudam a seleção, Enter confirma, Esc volta.
    if (e.key.startsWith('Arrow')) void sound.play('uiMove')
    else if (e.key === 'Enter') void sound.play('uiConfirm')
    else if (e.key === 'Escape') void sound.play('uiBack')
    keys(e)
  })
  root.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a, button')) void sound.play('uiConfirm')
  })
  // Música do menu (começa no primeiro toque: o navegador só libera som depois dele).
  void sound.music(SOUND_EVENTS.find((e) => e.id === 'musicMenu'))

  // ---- título ----
  function titleScreen() {
    root.innerHTML = `
      <header class="menu-logo">
        <h1>Pangya<span>Web</span></h1>
        <p class="version">versão ${escapeHtml(__PANGYA_VERSION__)}</p>
      </header>
      <nav class="menu-buttons">
        <a class="menu-button primary" href="#sozinho" data-go="solo">Jogar sozinho</a>
        <a class="menu-button primary" href="#amigos" data-go="friends">Jogar com amigos</a>
        <a class="menu-button" href="?treino">Campo de treino</a>
        <a class="menu-button" href="mapeador.html">Mapeador de personagens</a>
        <a class="menu-button" href="mapeador.html#sons">Sons do jogo</a>
        <a class="menu-button" href="?diagnostico">Diagnóstico</a>
      </nav>
      <p class="menu-hint">↑ ↓ escolher · Enter confirmar</p>`
    root.append(volumePanel())
    const buttons = [...root.querySelectorAll<HTMLAnchorElement>('.menu-button')]
    for (const b of buttons) {
      const go = b.dataset['go'] as Screen | undefined
      if (go)
        b.addEventListener('click', (e) => {
          e.preventDefault()
          navigate(go)
        })
    }
    buttons[0]?.focus()
    keys = (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const at = buttons.indexOf(document.activeElement as HTMLAnchorElement)
      const step = e.key === 'ArrowDown' ? 1 : -1
      buttons[(at + step + buttons.length) % buttons.length]?.focus()
    }
  }

  // ---- personagem ----
  async function characterScreen(mode: 'solo' | 'friends') {
    root.innerHTML = `
      <header class="menu-header">
        <h2>Escolha o personagem</h2>
        <p>${mode === 'friends' ? 'Depois: a sala com os amigos' : 'Depois: o curso'}</p>
      </header>
      <div class="character-screen">
        <ul class="character-list"><li class="loading">Carregando personagens…</li></ul>
        <div class="character-stage"></div>
        <aside class="character-info">
          <h3 class="character-name"></h3>
          <div class="power"></div>
          <p class="menu-hint">Arrastar o boneco = girar</p>
        </aside>
      </div>
      <footer class="menu-footer">
        <a class="menu-button" href="#" data-back>← Voltar</a>
        <span class="menu-hint">← → escolher · Enter continuar · Esc voltar</span>
        <a class="menu-button primary" href="#" data-next>Continuar →</a>
      </footer>`
    const preview = new CharacterPreview()
    root.querySelector('.character-stage')!.append(preview.element)
    root.querySelector('.power')!.append(powerInput())
    let alive = true
    leave = () => {
      alive = false
      preview.dispose()
    }

    const back = () => goBack('title')
    const next = () => {
      if (mode === 'friends') location.href = '?online'
      else navigate('course')
    }
    root.querySelector('[data-back]')!.addEventListener('click', (e) => {
      e.preventDefault()
      back()
    })
    root.querySelector('[data-next]')!.addEventListener('click', (e) => {
      e.preventDefault()
      next()
    })

    const list = await catalog
    const current = await chosenCharacter()
    if (!alive) return
    /** Personagens e, por último, "sem personagem". */
    const options: (CharacterEntry | undefined)[] = [...list, undefined]
    let index = Math.max(
      0,
      options.findIndex((c) => c?.id === current),
    )
    if (current === undefined) index = list.length // escolheu "sem personagem" antes
    const listElement = root.querySelector('.character-list')!
    listElement.innerHTML = options
      .map(
        (c, i) =>
          `<li><button type="button" data-i="${i}">${c ? escapeHtml(c.name) : '(sem personagem)'}</button></li>`,
      )
      .join('')
    if (list.length === 0)
      listElement.insertAdjacentHTML(
        'afterbegin',
        '<li class="loading">Nenhum personagem extraído (rode a extração dos assets).</li>',
      )
    const buttons = [...listElement.querySelectorAll<HTMLButtonElement>('button')]

    const select = (i: number) => {
      index = (i + options.length) % options.length
      const entry = options[index]
      rememberCharacter(entry?.id ?? '')
      buttons.forEach((b, j) => b.classList.toggle('selected', j === index))
      buttons[index]?.scrollIntoView({ block: 'nearest' })
      root.querySelector('.character-name')!.textContent = entry?.name ?? 'Sem personagem'
      void preview.show(entry)
    }
    buttons.forEach((b, i) => b.addEventListener('click', () => select(i)))
    select(index)

    keys = (e) => {
      if (['ArrowLeft', 'ArrowUp'].includes(e.key)) select(index - 1)
      else if (['ArrowRight', 'ArrowDown'].includes(e.key)) select(index + 1)
      else if (e.key === 'Enter') next()
      else if (e.key === 'Escape') back()
      else return
      e.preventDefault()
    }
  }

  // ---- curso e buracos ----
  async function courseScreen() {
    root.innerHTML = `
      <header class="menu-header">
        <h2>Escolha o curso</h2>
        <p>Jogar sozinho</p>
      </header>
      <div class="course-screen">
        <ul class="course-list"><li class="loading">Procurando cursos…</li></ul>
        <aside class="course-options">
          <h3 class="course-name"></h3>
          <p class="course-folder"></p>
          <p>Buracos</p>
          <div class="hole-counts">${HOLE_COUNTS.map((n) => `<button type="button" data-count="${n}">${n}</button>`).join('')}</div>
          <label>Começar no buraco <select name="first"></select></label>
          <p class="course-plan"></p>
          <p class="course-record"></p>
        </aside>
      </div>
      <footer class="menu-footer">
        <a class="menu-button" href="#" data-back>← Voltar</a>
        <span class="menu-hint">↑ ↓ curso · ← → buracos · Enter começar · Esc voltar</span>
        <a class="menu-button primary" href="#" data-next>Começar ⛳</a>
      </footer>`
    let alive = true
    leave = () => (alive = false)
    const list = await courses
    if (!alive) return

    const saved = readChoice()
    let index = Math.max(
      0,
      list.findIndex((c) => c.round === saved.round),
    )
    let count: number = HOLE_COUNTS.find((n) => n === saved.count) ?? 18
    let first = saved.first ?? 1

    const listElement = root.querySelector('.course-list')!
    listElement.innerHTML = list
      .map(
        (c, i) =>
          `<li><button type="button" data-i="${i}"><strong>${escapeHtml(courseName(c))}</strong>` +
          `<small>${c.holes.length} buraco${c.holes.length === 1 ? '' : 's'}</small></button></li>`,
      )
      .join('')
    const courseButtons = [...listElement.querySelectorAll<HTMLButtonElement>('button')]
    const countButtons = [...root.querySelectorAll<HTMLButtonElement>('.hole-counts button')]
    const firstInput = root.querySelector<HTMLSelectElement>('select[name=first]')!

    const course = () => list[index]!
    const plan = () => planHoles(course().holes, first, count)

    function update() {
      const c = course()
      courseButtons.forEach((b, i) => b.classList.toggle('selected', i === index))
      courseButtons[index]?.scrollIntoView({ block: 'nearest' })
      countButtons.forEach((b) => {
        const n = Number(b.dataset['count'])
        b.classList.toggle('selected', n === count)
        b.disabled = n > c.holes.length && n !== HOLE_COUNTS[0]
      })
      if (!c.holes.includes(first)) first = c.holes[0] ?? 1
      firstInput.innerHTML = c.holes
        .map((h) => `<option value="${h}"${h === first ? ' selected' : ''}>${h}</option>`)
        .join('')
      root.querySelector('.course-name')!.textContent = courseName(c)
      root.querySelector('.course-folder')!.textContent = c.round
      const holes = plan()
      root.querySelector('.course-plan')!.textContent = describePlan(holes)
      const record = readRecord(c.round, holes)
      root.querySelector('.course-record')!.textContent = record
        ? `Recorde: ${record.strokes} (${scoreToPar(record.strokes, record.par)})`
        : ''
      saveChoice({ round: c.round, count, first })
    }

    const setCount = (n: number) => {
      // Sem buracos suficientes no curso, fica com o que der.
      count = Math.min(n, Math.max(course().holes.length, 1))
      update()
    }
    const stepCount = (step: number) => {
      const allowed = HOLE_COUNTS.filter((n) => n <= Math.max(course().holes.length, 1))
      const at = allowed.findIndex((n) => n >= count)
      setCount(allowed[Math.max(0, Math.min(allowed.length - 1, at + step))] ?? 1)
    }
    const start = () => {
      const holes = plan()
      if (holes.length) location.href = soloUrl(course(), holes)
    }
    const back = () => goBack('solo')

    courseButtons.forEach((b, i) =>
      b.addEventListener('click', () => {
        index = i
        update()
      }),
    )
    countButtons.forEach((b) =>
      b.addEventListener('click', () => setCount(Number(b.dataset['count']))),
    )
    firstInput.addEventListener('change', () => {
      first = Number(firstInput.value)
      update()
    })
    root.querySelector('[data-back]')!.addEventListener('click', (e) => {
      e.preventDefault()
      back()
    })
    root.querySelector('[data-next]')!.addEventListener('click', (e) => {
      e.preventDefault()
      start()
    })
    if (!list.length) return
    update()

    keys = (e) => {
      if (e.key === 'ArrowUp') index = (index - 1 + list.length) % list.length
      else if (e.key === 'ArrowDown') index = (index + 1) % list.length
      else if (e.key === 'ArrowLeft') return stepCount(-1)
      else if (e.key === 'ArrowRight') return stepCount(1)
      else if (e.key === 'Enter') return start()
      else if (e.key === 'Escape') return back()
      else return
      e.preventDefault()
      update()
    }
  }

  render()
}

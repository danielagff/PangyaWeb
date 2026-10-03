/**
 * Visualizador de personagens (?personagens), no estilo do Mixamo. Duas telas (tecla C):
 * - Catálogo: todas as animações em cartões, mexendo ao mesmo tempo (motion-catalog.ts).
 * - Estúdio: o boneco no centro, girando com o mouse (arrastar = girar, roda = zoom, botão
 *   direito = mover), linha do tempo para pausar e ver quadro a quadro.
 * Escolhe personagem, taco, peças por slot e toca cada animação, com campo de anotação por
 * item. "Copiar lista" gera um texto com tudo numerado, para dizer o que é cada
 * animação/peça e corrigir os nomes do jogo.
 */
import {
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Timer,
  Vector3,
  WebGLRenderer,
} from 'three'
import { parsePartName } from '@pangya/formats'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { clubModelFor, type ClubCategory } from './clubs.ts'
import {
  CharacterModel,
  loadCatalog,
  placeAtBall,
  readPartInfo,
  saveOutfit,
  type CharacterEntry,
} from './character.ts'
import { SoundMapper } from '../audio/sound-mapper.ts'
import { MotionCatalog } from './motion-catalog.ts'
import { describeMotion, MOTION_CATEGORIES } from './motion-names.ts'
import { golfMotions } from './motions.ts'

const BALL_RADIUS = 0.2
/** Tela aberta por último (catálogo, estúdio ou sons). */
const SCREEN_KEY = 'pangyaweb.mapeador.tela'
type Screen = 'catalogo' | 'estudio' | 'sons'

/** Slots das peças, traduzidos (conferidos com o jogo; "?" = ainda a confirmar). */
const SLOT_NAMES: Record<string, string> = {
  fc: 'Rosto',
  ha: 'Cabelo',
  ts: 'Tronco / camisa / vestido',
  pv: 'Calça / saia',
  ft: 'Pés / sapatos',
  hn: 'Mãos / luvas',
  wi: 'Asas',
  tl: 'Cauda?',
  earing: 'Brinco',
  hd: 'Cabeça?',
  hair: 'Cabelo extra?',
  glasses: 'Óculos',
  um: 'Guarda-chuva?',
  belt: 'Cinto',
  wr: 'Pulso?',
  lg: 'Pernas (corpo)',
  am: 'Braços (corpo)',
  la: 'Corpo (la)?',
  lb: 'Corpo (lb)?',
}
const SLOT_ORDER = Object.keys(SLOT_NAMES)
const slotName = (slot: string) => SLOT_NAMES[slot] ?? `Item: ${slot}`

/** Rótulo da peça: "nº 01", "acessório a z01", com o que esconde/cobre. */
function partLabel(path: string) {
  const p = parsePartName(path)
  const rest = fileName(path)
    .replace(/\.[^.]+$/, '')
    .split('_')
    .slice(2)
    .filter((x) => !x.startsWith('!') && x !== 'sub' && !p.covers.includes(x))
    .join(' ')
    .replace(/!.*/, '')
  const extra = [
    p.hides.length ? `esconde: ${p.hides.map(slotName).join(', ')}` : '',
    p.covers.length ? `inclui: ${p.covers.map(slotName).join(', ')}` : '',
  ].filter(Boolean)
  return `${p.accessory ? 'acessório' : 'nº'} ${rest}${extra.length ? ` · ${extra.join(' · ')}` : ''}`
}

/** Chave no conjunto vestido: a base e um acessório por slot. */
const keyOf = (path: string) => {
  const p = parsePartName(path)
  return p.accessory ? `${p.slot}+` : p.slot
}

const CLUBS: { value: ClubCategory | ''; label: string }[] = [
  { value: '', label: 'sem taco' },
  { value: 'wood', label: 'madeira' },
  { value: 'iron', label: 'ferro' },
  { value: 'wedge', label: 'wedge' },
  { value: 'putter', label: 'putter' },
]

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const fileName = (path: string) => path.split('/').pop() ?? path

function readNote(key: string) {
  try {
    return localStorage.getItem(`pangyaweb.nota.${key}`) ?? ''
  } catch {
    return ''
  }
}
/** Grava a nota e confere lendo de volta; false se o navegador não deixou salvar. */
function writeNote(key: string, value: string): boolean {
  try {
    if (value) localStorage.setItem(`pangyaweb.nota.${key}`, value)
    else localStorage.removeItem(`pangyaweb.nota.${key}`)
    return readNote(key) === value
  } catch {
    return false // sem armazenamento (janela anônima): a nota só vale nesta página
  }
}

/** Quantas notas salvas começam com `prefix`. */
function countNotes(prefix: string) {
  try {
    let n = 0
    for (let i = 0; i < localStorage.length; i++)
      if (localStorage.key(i)?.startsWith(`pangyaweb.nota.${prefix}`)) n++
    return n
  } catch {
    return 0
  }
}

export async function startCharacterViewer() {
  const characters = await loadCatalog()

  // ---- cena ----
  const renderer = new WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  document.body.appendChild(renderer.domElement)
  const scene = new Scene()
  scene.background = new Color(0x4a4f57)
  scene.add(new HemisphereLight(0xffffff, 0x50555c, 2.2))
  const key = new DirectionalLight(0xffffff, 1.4)
  key.position.set(20, 40, 30)
  scene.add(key)
  const back = new DirectionalLight(0xffffff, 0.6)
  back.position.set(-20, 20, -30)
  scene.add(back)
  const grid = new GridHelper(40, 40, 0x8a9099, 0x63686f)
  scene.add(grid)
  // Objetos da "posição de jogo" (bola, alvo, cabeça do taco); escondidos no estúdio.
  const ball = new Mesh(
    new SphereGeometry(BALL_RADIUS, 20, 10),
    new MeshLambertMaterial({ color: 0xffffff }),
  )
  ball.position.set(0, BALL_RADIUS, 0)
  scene.add(ball)
  // Ponto vermelho: onde o código acha que está a cabeça do taco.
  const headMarker = new Mesh(
    new SphereGeometry(0.08, 12, 6),
    new MeshBasicMaterial({ color: 0xff2020, depthTest: false }),
  )
  headMarker.renderOrder = 10
  scene.add(headMarker)
  // Seta do alvo: a câmera fica atrás da bola olhando para -Z, como no jogo.
  const target = new Mesh(
    new SphereGeometry(0.15, 8, 4),
    new MeshBasicMaterial({ color: 0xffeb3b }),
  )
  target.position.set(0, 0.15, -10)
  scene.add(target)

  const camera = new PerspectiveCamera(35, 1, 0.1, 500)
  camera.position.set(0, 5, 15)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 3, 0)
  controls.enableDamping = true
  controls.autoRotateSpeed = 4
  controls.update()

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
  }
  resize()
  window.addEventListener('resize', resize)

  // ---- painéis ----
  const left = document.createElement('div')
  left.className = 'viewer-side left'
  left.innerHTML = `
    <h1>Mapeador de personagens</h1>
    <p><button class="open-catalog">📚 Catálogo de animações (C)</button>
      <button class="open-sounds">🔊 Sons</button></p>
    <label>Personagem <select name="character"></select></label>
    <label>Taco <select name="club">${CLUBS.map((c) => `<option value="${c.value}">${c.label}</option>`).join('')}</select></label>
    <label>Ver <select name="mode">
      <option value="studio">estúdio (girar e ver)</option>
      <option value="ball">posição de jogo (na bola)</option>
    </select></label>
    <label><input type="checkbox" name="spin" /> girar sozinho</label>
    <p class="views">Câmera: <button data-view="0">frente</button><button data-view="90">lado</button><button data-view="180">costas</button><button data-view="270">outro lado</button><button data-view="top">de cima</button></p>
    <p class="hint">Arrastar = girar · roda = zoom · botão direito = mover · H = esconder painéis</p>
    <label><input type="checkbox" name="loop" checked /> repetir animação</label>
    <label>Velocidade <input type="range" name="speed" min="0" max="2" step="0.05" value="1" /> <output>1×</output></label>
    <p class="status"></p>
    <p class="saved-count"></p>
    <p><button class="copy">Copiar lista (com anotações)</button></p>
    <h2>Animações</h2>
    <input class="search" type="search" placeholder="Buscar (ex.: putter, birdie, 우드)" />
    <label><input type="checkbox" name="endings" /> mostrar trechos finais ("final")</label>
    <div class="motions"></div>`
  const right = document.createElement('div')
  right.className = 'viewer-side right'
  right.innerHTML = `<h2>Peças (skins) por categoria</h2>
    <p class="outfit-state"></p>
    <p><button class="save-outfit">⭐ Usar esta roupa como padrão</button>
      <button class="reset-outfit">Voltar ao automático</button></p>
    <div class="parts"></div>
    <h2>Texturas não achadas</h2><ul class="missing"></ul>`
  const timeline = document.createElement('div')
  timeline.className = 'viewer-timeline'
  timeline.innerHTML = `<button class="toggle" title="Espaço">⏸</button>
    <button class="step" data-step="-1" title="← quadro anterior">◀</button>
    <input type="range" min="0" max="1" step="0.001" value="0" />
    <button class="step" data-step="1" title="→ próximo quadro">▶</button>
    <span class="frame">—</span>`
  document.body.append(left, right, timeline)
  const catalog = new MotionCatalog({
    notes: {
      read: (name) => readNote(noteKey('anim', name)),
      bind: (input, name) => bindNote(input, noteKey('anim', name)),
    },
    onOpen: (name) => openInStudio(name),
  })
  catalog.tools.innerHTML = `
    <label>Personagem <select name="character"></select></label>
    <label>Taco <select name="club">${CLUBS.map((c) => `<option value="${c.value}">${c.label}</option>`).join('')}</select></label>
    <button class="copy">Copiar lista</button>
    <button class="studio">🎬 Estúdio (C)</button>
    <button class="sounds">🔊 Sons</button>
    <span class="catalog-status"></span>`
  catalog.element.hidden = true
  document.body.append(catalog.element)
  // Tela dos sons do jogo (não depende do personagem).
  const soundMapper = new SoundMapper(characters)
  soundMapper.tools.innerHTML = `<button class="catalog">📚 Animações</button>
    <button class="studio">🎬 Estúdio</button>`
  document.body.append(soundMapper.element)
  let screen: Screen = 'estudio'
  left.querySelector('button.open-sounds')!.addEventListener('click', () => showScreen('sons'))
  catalog.tools.querySelector('button.sounds')!.addEventListener('click', () => showScreen('sons'))
  soundMapper.tools
    .querySelector('button.catalog')!
    .addEventListener('click', () => showScreen('catalogo'))
  soundMapper.tools
    .querySelector('button.studio')!
    .addEventListener('click', () => showScreen('estudio'))
  const $ = <T extends Element>(root: Element, selector: string) =>
    root.querySelector(selector) as T
  const characterInput = $<HTMLSelectElement>(left, 'select[name=character]')
  const clubInput = $<HTMLSelectElement>(left, 'select[name=club]')
  const modeInput = $<HTMLSelectElement>(left, 'select[name=mode]')
  const spinInput = $<HTMLInputElement>(left, 'input[name=spin]')
  const scrub = $<HTMLInputElement>(timeline, 'input')
  const toggleButton = $<HTMLButtonElement>(timeline, '.toggle')
  const frameLabel = $<HTMLSpanElement>(timeline, '.frame')
  const loopInput = $<HTMLInputElement>(left, 'input[name=loop]')
  const speedInput = $<HTMLInputElement>(left, 'input[name=speed]')
  const status = (text: string) => {
    for (const box of [$(left, '.status'), $(catalog.tools, '.catalog-status')])
      box.textContent = text
  }
  const searchInput = $<HTMLInputElement>(left, 'input.search')
  const endingsInput = $<HTMLInputElement>(left, 'input[name=endings]')
  searchInput.addEventListener('input', () => filterMotions())
  endingsInput.addEventListener('change', () => filterMotions())
  const catalogCharacter = $<HTMLSelectElement>(catalog.tools, 'select[name=character]')
  const catalogClub = $<HTMLSelectElement>(catalog.tools, 'select[name=club]')

  /** Salva a cada letra digitada e mostra ✓ salvo (borda verde) no campo. */
  function bindNote(input: HTMLInputElement, key: string) {
    const mark = (state: '' | 'saved' | 'failed') => {
      input.classList.toggle('saved', state === 'saved')
      input.classList.toggle('failed', state === 'failed')
      input.title =
        state === 'saved'
          ? 'Salvo neste navegador'
          : state === 'failed'
            ? 'NÃO salvou (janela anônima?)'
            : ''
    }
    mark(input.value ? 'saved' : '')
    input.addEventListener('input', () => {
      const value = input.value.trim()
      const ok = writeNote(key, value)
      mark(!ok ? 'failed' : value ? 'saved' : '')
      updateCount()
    })
  }
  function updateCount() {
    const n = countNotes(`${entry.id}|`)
    $(left, '.saved-count').textContent =
      `📝 ${n} anotaç${n === 1 ? 'ão salva' : 'ões salvas'} deste personagem (ficam neste navegador, mesmo fechando)`
  }

  if (characters.length === 0) {
    status('Nenhum personagem no catálogo (rode a extração dos assets).')
    if (location.hash === '#sons') {
      document.body.classList.add('catalog-open')
      soundMapper.show(true)
    }
    return
  }
  characterInput.innerHTML = characters
    .map((c, i) => `<option value="${i}">${escapeHtml(c.name)} (${escapeHtml(c.id)})</option>`)
    .join('')
  catalogCharacter.innerHTML = characterInput.innerHTML

  // ---- estado ----
  let entry: CharacterEntry = characters[0]!
  /** Peça escolhida por slot ('' = nenhuma). */
  let equipped = new Map<string, string>()
  let model: CharacterModel | undefined
  let motion: string | undefined
  let loadToken = 0
  const noteKey = (kind: string, name: string) => `${entry.id}|${kind}|${name}`

  function slots() {
    return Object.keys(entry.parts).sort((a, b) => {
      const ia = SLOT_ORDER.indexOf(a)
      const ib = SLOT_ORDER.indexOf(b)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b)
    })
  }

  async function rebuild() {
    const token = ++loadToken
    void refreshCatalog()
    status('Carregando…')
    const parts = [...equipped.values()].filter(Boolean)
    let next: CharacterModel
    try {
      next = await CharacterModel.load(entry, parts)
    } catch (err) {
      status(`Erro: ${String(err)}`)
      return
    }
    if (token !== loadToken) return
    const first = !model
    if (model) scene.remove(model.root)
    model = next
    scene.add(model.root)
    await applyClub()
    if (first) frame()
    if (token !== loadToken) return
    renderMotions()
    renderMissing()
    status(`${entry.name}: ${model.motions.length} animações, ${parts.length} peças`)
  }

  async function applyClub() {
    if (!model) return
    const category = clubInput.value as ClubCategory | ''
    await model.setClub(category ? await clubModelFor(category) : undefined)
    model.addressKey = '' // remede com o taco novo
    model.address(category ? golfMotions(model.motions, category).idle : undefined)
    place()
    if (motion) model.play(motion, loopInput.checked, 0)
  }

  const studio = () => modeInput.value === 'studio'

  function place() {
    if (!model) return
    const atBall = !studio()
    ball.visible = target.visible = atBall
    if (atBall) {
      placeAtBall(model, ball.position, new Vector3(1, 0, 0), () => 0, 0)
    } else {
      model.root.position.set(0, 0, 0)
      // De frente para +Z (para a câmera): o modelo olha para -X no próprio espaço
      // (o mesmo ajuste de CHARACTER_TUNING.facingDegrees no buraco).
      model.root.rotation.y = Math.PI / 2
    }
  }

  /** Enquadra o personagem (ou a cena da bola) de um ângulo, em graus em volta do Y. */
  function frame(view: number | 'top' = 0) {
    const box = new Box3()
    if (model) box.setFromObject(model.root, true)
    if (!studio()) box.expandByObject(ball)
    if (box.isEmpty()) box.set(new Vector3(-1, 0, -1), new Vector3(1, 6, 1))
    const center = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3())
    const radius = Math.max(size.y, size.x, size.z) / 2
    const distance = (radius / Math.tan((camera.fov * Math.PI) / 360)) * 1.7
    const direction =
      view === 'top'
        ? new Vector3(0, 1, 0.01)
        : new Vector3(Math.sin((view * Math.PI) / 180), 0.15, Math.cos((view * Math.PI) / 180))
    controls.target.copy(center)
    camera.position.copy(center).addScaledVector(direction.normalize(), distance)
    controls.update()
  }

  // ---- catálogo ----
  let catalogToken = 0
  let catalogStale = true

  /** O catálogo tem um boneco próprio (mesma roupa e taco do estúdio), carregado ao abrir. */
  async function refreshCatalog() {
    if (!catalog.visible) {
      catalogStale = true
      return
    }
    catalogStale = false
    const token = ++catalogToken
    catalog.setModel(undefined)
    const category = clubInput.value as ClubCategory | ''
    try {
      const next = await CharacterModel.load(entry, [...equipped.values()].filter(Boolean))
      await next.setClub(category ? await clubModelFor(category) : undefined)
      if (token === catalogToken) catalog.setModel(next)
    } catch (err) {
      status(`Erro: ${String(err)}`)
    }
  }

  function showScreen(next: Screen) {
    screen = next
    catalog.element.hidden = next !== 'catalogo'
    soundMapper.show(next === 'sons')
    document.body.classList.toggle('catalog-open', next !== 'estudio')
    try {
      localStorage.setItem(SCREEN_KEY, next)
    } catch {
      // sem armazenamento: abre no catálogo da próxima vez
    }
    if (next === 'catalogo') {
      catalogCharacter.value = characterInput.value
      catalogClub.value = clubInput.value
      if (catalogStale) void refreshCatalog()
    } else if (next === 'estudio') {
      renderMotions() // mostra as anotações feitas no catálogo
    }
  }

  /** Clique no boneco do catálogo: toca o movimento no estúdio. */
  function openInStudio(name: string) {
    showScreen('estudio')
    motion = name
    model?.play(name, loopInput.checked, 0)
    setPaused(false)
    renderMotions()
    left.querySelector('.motions li.active')?.scrollIntoView({ block: 'center' })
  }

  function setPaused(paused: boolean) {
    if (!model) return
    model.paused = paused
    toggleButton.textContent = paused ? '▶' : '⏸'
  }

  /** Movimentos agrupados por categoria (na ordem da tela), com o índice original. */
  function motionGroups() {
    const motions = (model?.motions ?? []).map((m, i) => ({ ...m, i, ...describeMotion(m.name) }))
    return MOTION_CATEGORIES.map((category) => ({
      category,
      items: motions.filter((m) => m.category === category),
    })).filter((g) => g.items.length > 0)
  }

  function renderMotions() {
    const list = $<HTMLDivElement>(left, '.motions')
    const motions = model?.motions ?? []
    list.innerHTML = motionGroups()
      .map(
        (g) =>
          `<details open><summary>${g.category} <small>(${g.items.length})</small></summary><ul>${g.items
            .map(
              (
                m,
              ) => `<li data-i="${m.i}" class="${m.name === motion ? 'active' : ''} ${m.name.endsWith('끝') ? 'ending' : ''}">
          <button class="play">${escapeHtml(m.text || '(sem tradução)')}</button>
          <small>${escapeHtml(m.name)} · ${m.frameEnd - m.frameStart} quadros</small>
          <input class="note" placeholder="o que é?" value="${escapeHtml(readNote(noteKey('anim', m.name)))}" />
        </li>`,
            )
            .join('')}</ul></details>`,
      )
      .join('')
    list.querySelectorAll('li').forEach((li) => {
      const m = motions[Number(li.dataset.i)]!
      $(li, '.play').addEventListener('click', () => {
        motion = m.name
        model?.play(m.name, loopInput.checked, 0)
        setPaused(false)
        list.querySelectorAll('li').forEach((x) => x.classList.toggle('active', x === li))
      })
      const note = $<HTMLInputElement>(li, '.note')
      bindNote(note, noteKey('anim', m.name))
    })
    filterMotions()
  }

  /** Busca (português, coreano ou anotação) e esconder os trechos finais ("끝"). */
  function filterMotions() {
    const query = searchInput.value.trim().toLowerCase()
    const endings = endingsInput.checked
    left.querySelectorAll<HTMLLIElement>('.motions li').forEach((li) => {
      const text = (li.textContent + ' ' + $<HTMLInputElement>(li, '.note').value).toLowerCase()
      li.hidden =
        (!endings && li.classList.contains('ending')) || (query !== '' && !text.includes(query))
    })
    left.querySelectorAll<HTMLDetailsElement>('.motions details').forEach((d) => {
      d.hidden = [...d.querySelectorAll('li')].every((li) => li.hidden)
    })
  }

  function renderParts() {
    const box = $<HTMLDivElement>(right, '.parts')
    const list = (slot: string, key: string, paths: string[], title: string) => {
      if (paths.length === 0) return ''
      const rows = ['', ...paths]
        .map((path) => {
          const checked = (equipped.get(key) ?? '') === path ? 'checked' : ''
          const label = path ? escapeHtml(partLabel(path)) : '<em>nenhum</em>'
          const extra = path
            ? `<small>${escapeHtml(fileName(path))}</small>
               <input class="note" data-path="${escapeHtml(path)}" placeholder="o que é?" value="${escapeHtml(readNote(noteKey('peca', path)))}" />
               <details data-path="${escapeHtml(path)}"><summary>texturas</summary><div></div></details>`
            : ''
          return `<li><label><input type="radio" name="slot-${escapeHtml(key)}" value="${escapeHtml(path)}" ${checked} /> ${label}</label>${extra}</li>`
        })
        .join('')
      return `<h4>${title} (${paths.length})</h4><ul>${rows}</ul>`
    }
    box.innerHTML = slots()
      .map((slot) => {
        const paths = entry.parts[slot]!
        const bases = paths.filter((p) => !parsePartName(p).accessory)
        const accessories = paths.filter((p) => parsePartName(p).accessory)
        const worn = [equipped.get(slot), equipped.get(`${slot}+`)]
          .filter(Boolean)
          .map((p) => partLabel(p!))
          .join(' + ')
        return `<details class="slot"><summary>${escapeHtml(slotName(slot))} <small>${escapeHtml(slot)} · ${escapeHtml(worn || 'nada')}</small></summary>
          ${list(slot, slot, bases, 'Peça base')}${list(slot, `${slot}+`, accessories, 'Acessórios')}</details>`
      })
      .join('')
    box.querySelectorAll<HTMLInputElement>('input[type=radio]').forEach((radio) =>
      radio.addEventListener('change', () => {
        const key = radio.name.slice('slot-'.length)
        equipped.set(key, radio.value)
        // Peça que esconde outros slots (vestido esconde a saia): tira as bases deles.
        if (radio.value)
          for (const hidden of parsePartName(radio.value).hides) equipped.delete(hidden)
        const open = [...box.querySelectorAll<HTMLDetailsElement>('details.slot')].map(
          (d) => d.open,
        )
        renderParts()
        box
          .querySelectorAll<HTMLDetailsElement>('details.slot')
          .forEach((d, i) => (d.open = open[i] ?? false))
        void rebuild()
      }),
    )
    box
      .querySelectorAll<HTMLInputElement>('input.note')
      .forEach((note) => bindNote(note, noteKey('peca', note.dataset.path!)))
    updateCount()
    box.querySelectorAll<HTMLDetailsElement>('details[data-path]').forEach((details) =>
      details.addEventListener('toggle', () => {
        const target = $<HTMLDivElement>(details, 'div')
        if (!details.open || target.dataset.loaded) return
        target.dataset.loaded = '1'
        target.textContent = '…'
        void readPartInfo(details.dataset.path!).then((info) => {
          if (!info) {
            target.textContent = 'arquivo não encontrado'
            return
          }
          const textures = info.textures
            .map(
              (t) =>
                `<li>${escapeHtml(t.name)}${t.files.length > 1 ? ` → ${escapeHtml(t.files.slice(0, -1).join(', '))}` : ''}</li>`,
            )
            .join('')
          const faces = info.faces.length
            ? `<p>Rostos (FANM): ${info.faces.map((f) => `${escapeHtml(f.name)} [${escapeHtml(f.material)}, grupo ${f.group}]`).join('; ')}</p>`
            : ''
          target.innerHTML = `<p>${info.bones} ossos · ${info.triangles} triângulos</p><ul>${textures}</ul>${faces}`
        })
      }),
    )
  }

  function renderMissing() {
    const missing = model?.missingTextures ?? []
    $<HTMLUListElement>(right, '.missing').innerHTML = missing.length
      ? missing.map((t) => `<li>${escapeHtml(t)}</li>`).join('')
      : '<li>nenhuma 👍</li>'
  }

  function selectCharacter(index: number) {
    entry = characters[index]!
    motion = undefined
    equipped = new Map(entry.defaults.map((path) => [keyOf(path), path]))
    renderOutfitState()
    renderParts()
    void rebuild()
  }

  /** Mostra se a roupa padrão deste personagem é a automática ou a escolhida aqui. */
  function renderOutfitState() {
    const custom = entry.autoDefaults && entry.defaults.join() !== entry.autoDefaults.join()
    $(right, '.outfit-state').textContent = custom
      ? '⭐ Roupa padrão escolhida por você (o jogo usa esta).'
      : 'Roupa padrão automática (menor número de cada categoria).'
  }

  async function storeOutfit(parts: string[]) {
    if (!(await saveOutfit(entry.id, parts))) {
      status('Não consegui salvar a roupa padrão (o servidor/mapeador está ligado?).')
      return
    }
    entry.defaults = parts.length ? parts : (entry.autoDefaults ?? entry.defaults)
    renderOutfitState()
    status(parts.length ? 'Roupa padrão salva! O jogo já usa esta.' : 'Voltou à roupa automática.')
  }

  function copyList() {
    const lines = [`PERSONAGEM ${entry.name} (${entry.id})`, '', 'ANIMAÇÕES']
    for (const g of motionGroups()) {
      lines.push(`[${g.category}]`)
      for (const m of g.items) {
        const note = readNote(noteKey('anim', m.name))
        lines.push(
          `  ${m.i + 1}. ${m.name} (${m.frameEnd - m.frameStart} quadros)` +
            (m.text ? ` — tradução: ${m.text}` : '') +
            (note ? ` — NOTA: ${note}` : ''),
        )
      }
    }
    lines.push('', 'PEÇAS')
    const worn = new Set(equipped.values())
    for (const slot of slots()) {
      lines.push(`[${slot} — ${slotName(slot)}]`)
      for (const path of entry.parts[slot]!) {
        const note = readNote(noteKey('peca', path))
        const on = worn.has(path) ? ' (vestida)' : ''
        lines.push(
          `  - ${fileName(path)} — ${partLabel(path)}${on}${note ? ` — NOTA: ${note}` : ''}`,
        )
      }
    }
    lines.push('', `ROUPA VESTIDA: ${[...worn].filter(Boolean).map(fileName).join(', ')}`)
    const missing = model?.missingTextures ?? []
    if (missing.length) lines.push('', `TEXTURAS NÃO ACHADAS: ${missing.join(', ')}`)
    const text = lines.join('\n')
    navigator.clipboard.writeText(text).then(
      () => status('Lista copiada! Cole na conversa.'),
      () => {
        const area = document.createElement('textarea')
        area.value = text
        area.className = 'viewer-copy'
        document.body.append(area)
        area.select()
        status('Não deu para copiar sozinho: selecione o texto (Ctrl+C).')
      },
    )
  }

  characterInput.addEventListener('change', () => selectCharacter(Number(characterInput.value)))
  clubInput.addEventListener('change', () => {
    void applyClub()
    void refreshCatalog()
  })
  catalogCharacter.addEventListener('change', () => {
    characterInput.value = catalogCharacter.value
    selectCharacter(Number(catalogCharacter.value))
  })
  catalogClub.addEventListener('change', () => {
    clubInput.value = catalogClub.value
    void applyClub()
    void refreshCatalog()
  })
  $(catalog.tools, 'button.copy').addEventListener('click', copyList)
  $(catalog.tools, 'button.studio').addEventListener('click', () => showScreen('estudio'))
  $(left, 'button.open-catalog').addEventListener('click', () => showScreen('catalogo'))
  modeInput.addEventListener('change', () => {
    place()
    frame()
  })
  spinInput.addEventListener('change', () => (controls.autoRotate = spinInput.checked))
  left.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) =>
    button.addEventListener('click', () => {
      const view = button.dataset.view!
      frame(view === 'top' ? 'top' : Number(view))
    }),
  )
  const step = (frames: number) => {
    if (!model) return
    setPaused(true)
    model.seek(Math.round(model.time * 30 + frames) / 30)
  }
  toggleButton.addEventListener('click', () => setPaused(!model?.paused))
  timeline
    .querySelectorAll<HTMLButtonElement>('.step')
    .forEach((button) => button.addEventListener('click', () => step(Number(button.dataset.step))))
  scrub.addEventListener('input', () => {
    if (!model) return
    setPaused(true)
    model.seek(Number(scrub.value) * model.duration)
  })
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return
    if (e.target instanceof HTMLSelectElement) return
    if (screen === 'sons') return
    if (e.code === 'KeyC') showScreen(screen === 'catalogo' ? 'estudio' : 'catalogo')
    else if (screen === 'catalogo') return
    else if (e.code === 'KeyH') document.body.classList.toggle('viewer-clean')
    else if (e.code === 'Space') {
      e.preventDefault()
      setPaused(!model?.paused)
    } else if (e.code === 'ArrowLeft') step(-1)
    else if (e.code === 'ArrowRight') step(1)
  })
  loopInput.addEventListener('change', () => {
    if (motion) model?.play(motion, loopInput.checked, 0)
  })
  speedInput.addEventListener('input', () => {
    $(left, 'output').textContent = `${speedInput.value}×`
  })
  $(left, 'button.copy').addEventListener('click', copyList)
  $(right, 'button.save-outfit').addEventListener(
    'click',
    () => void storeOutfit([...equipped.values()].filter(Boolean)),
  )
  $(right, 'button.reset-outfit').addEventListener('click', () => {
    void storeOutfit([]).then(() => selectCharacter(Number(characterInput.value)))
  })

  selectCharacter(0)
  let saved = 'catalogo'
  try {
    saved = localStorage.getItem(SCREEN_KEY) ?? saved
  } catch {
    // sem armazenamento: começa no catálogo
  }
  // mapeador.html#sons (botão "Sons do jogo" do menu) abre direto nos sons.
  showScreen(
    location.hash === '#sons'
      ? 'sons'
      : saved === 'estudio' || saved === 'sons'
        ? saved
        : 'catalogo',
  )

  const timer = new Timer()
  renderer.setAnimationLoop((time) => {
    timer.update(time)
    const dt = Math.min(timer.getDelta(), 0.1)
    if (screen === 'sons') return // tela dos sons cobre tudo
    if (screen === 'catalogo') {
      catalog.render(renderer, dt)
      return
    }
    if (model) {
      model.update(dt * Number(speedInput.value))
      const head = studio() ? undefined : model.clubHead()
      headMarker.visible = Boolean(head)
      if (head) headMarker.position.copy(model.root.localToWorld(head))
      const duration = model.duration
      if (duration > 0) {
        if (document.activeElement !== scrub) scrub.value = String(model.time / duration)
        frameLabel.textContent = `quadro ${Math.round(model.time * 30)} / ${Math.round(duration * 30)}`
      }
    }
    controls.update()
    renderer.render(scene, camera)
  })
}

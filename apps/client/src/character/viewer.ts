/**
 * Visualizador de personagens (?personagens): escolhe personagem, taco, peças por slot e
 * toca cada animação, com campo de anotação por item. "Copiar lista" gera um texto com
 * tudo numerado, para dizer o que é cada animação/peça e corrigir os nomes do jogo.
 */
import {
  AmbientLight,
  CircleGeometry,
  Color,
  DirectionalLight,
  GridHelper,
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
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { clubModelFor, type ClubCategory } from './clubs.ts'
import {
  CharacterModel,
  loadCatalog,
  placeAtBall,
  readPartInfo,
  type CharacterEntry,
} from './character.ts'
import { golfMotions, motionMeaning } from './motions.ts'

const BALL_RADIUS = 0.2

/** Slots conhecidos (palpite; o resto aparece pelo código). */
const SLOT_NAMES: Record<string, string> = {
  fc: 'rosto?',
  ha: 'cabelo?',
  ts: 'tronco/camisa?',
  pv: 'calça/saia?',
  ft: 'sapatos?',
  hn: 'mãos/luvas?',
  lg: 'pernas (corpo)?',
  am: 'braços (corpo)?',
  la: 'la?',
  lb: 'lb?',
}
const SLOT_ORDER = Object.keys(SLOT_NAMES)

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
function writeNote(key: string, value: string) {
  try {
    if (value) localStorage.setItem(`pangyaweb.nota.${key}`, value)
    else localStorage.removeItem(`pangyaweb.nota.${key}`)
  } catch {
    // sem armazenamento: a nota só vale nesta página
  }
}

export async function startCharacterViewer() {
  const catalog = await loadCatalog()

  // ---- cena ----
  const renderer = new WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  document.body.appendChild(renderer.domElement)
  const scene = new Scene()
  scene.background = new Color(0x87c5ff)
  scene.add(new AmbientLight(0xffffff, 1.2))
  const sun = new DirectionalLight(0xffffff, 1.6)
  sun.position.set(-20, 40, 30)
  scene.add(sun)
  const ground = new Mesh(new CircleGeometry(12, 48), new MeshLambertMaterial({ color: 0x5fae4a }))
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)
  const grid = new GridHelper(24, 24, 0x2e6b22, 0x4b8f3a)
  grid.position.y = 0.01
  scene.add(grid)
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

  const camera = new PerspectiveCamera(45, 1, 0.1, 500)
  camera.position.set(0, 5, 15)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(-1.5, 2.5, 0)
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
    <h1>Personagens</h1>
    <label>Personagem <select name="character"></select></label>
    <label>Taco <select name="club">${CLUBS.map((c) => `<option value="${c.value}">${c.label}</option>`).join('')}</select></label>
    <label><input type="checkbox" name="atBall" checked /> ao lado da bola (posição de jogo)</label>
    <label><input type="checkbox" name="loop" checked /> repetir animação</label>
    <label>Velocidade <input type="range" name="speed" min="0" max="2" step="0.05" value="1" /> <output>1×</output></label>
    <p class="status"></p>
    <p><button class="copy">Copiar lista (com anotações)</button> <a href="/">Menu</a></p>
    <h2>Animações</h2>
    <ol class="motions"></ol>`
  const right = document.createElement('div')
  right.className = 'viewer-side right'
  right.innerHTML = `<h2>Peças (skins) por slot</h2><div class="parts"></div>
    <h2>Texturas não achadas</h2><ul class="missing"></ul>`
  document.body.append(left, right)
  const $ = <T extends Element>(root: Element, selector: string) =>
    root.querySelector(selector) as T
  const characterInput = $<HTMLSelectElement>(left, 'select[name=character]')
  const clubInput = $<HTMLSelectElement>(left, 'select[name=club]')
  const atBallInput = $<HTMLInputElement>(left, 'input[name=atBall]')
  const loopInput = $<HTMLInputElement>(left, 'input[name=loop]')
  const speedInput = $<HTMLInputElement>(left, 'input[name=speed]')
  const status = (text: string) => ($(left, '.status').textContent = text)

  if (catalog.length === 0) {
    status('Nenhum personagem no catálogo (rode a extração dos assets).')
    return
  }
  characterInput.innerHTML = catalog
    .map((c, i) => `<option value="${i}">${escapeHtml(c.name)} (${escapeHtml(c.id)})</option>`)
    .join('')

  // ---- estado ----
  let entry: CharacterEntry = catalog[0]!
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

  function slotOf(path: string) {
    return slots().find((s) => entry.parts[s]!.includes(path))
  }

  async function rebuild() {
    const token = ++loadToken
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
    if (model) scene.remove(model.root)
    model = next
    scene.add(model.root)
    await applyClub()
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

  function place() {
    if (!model) return
    if (atBallInput.checked) {
      placeAtBall(model, ball.position, new Vector3(1, 0, 0), () => 0)
    } else {
      model.root.position.set(0, 0, -2)
      model.root.rotation.y = 0
    }
  }

  function renderMotions() {
    const list = $<HTMLOListElement>(left, '.motions')
    const motions = model?.motions ?? []
    list.innerHTML = motions
      .map((m, i) => {
        const meaning = motionMeaning(m.name)
        return `<li data-i="${i}" class="${m.name === motion ? 'active' : ''}">
          <button class="play">${escapeHtml(m.name)}</button>
          <small>${m.frameEnd - m.frameStart} quadros${meaning ? ` · ${escapeHtml(meaning)}` : ''}</small>
          <input class="note" placeholder="o que é?" value="${escapeHtml(readNote(noteKey('anim', m.name)))}" />
        </li>`
      })
      .join('')
    list.querySelectorAll('li').forEach((li) => {
      const m = motions[Number(li.dataset.i)]!
      $(li, '.play').addEventListener('click', () => {
        motion = m.name
        model?.play(m.name, loopInput.checked, 0)
        list.querySelectorAll('li').forEach((x) => x.classList.toggle('active', x === li))
      })
      const note = $<HTMLInputElement>(li, '.note')
      note.addEventListener('change', () => writeNote(noteKey('anim', m.name), note.value.trim()))
    })
  }

  function renderParts() {
    const box = $<HTMLDivElement>(right, '.parts')
    box.innerHTML = slots()
      .map((slot) => {
        const paths = entry.parts[slot]!
        const rows = ['', ...paths]
          .map((path) => {
            const checked = (equipped.get(slot) ?? '') === path ? 'checked' : ''
            const label = path ? escapeHtml(fileName(path)) : '<em>nenhuma</em>'
            const note = path
              ? `<input class="note" data-path="${escapeHtml(path)}" placeholder="o que é?" value="${escapeHtml(readNote(noteKey('peca', path)))}" />
                 <details data-path="${escapeHtml(path)}"><summary>texturas</summary><div></div></details>`
              : ''
            return `<li><label><input type="radio" name="slot-${slot}" value="${escapeHtml(path)}" ${checked} /> ${label}</label>${note}</li>`
          })
          .join('')
        return `<section><h3>${escapeHtml(slot)} <small>${SLOT_NAMES[slot] ?? ''} · ${paths.length}</small></h3><ul>${rows}</ul></section>`
      })
      .join('')
    box.querySelectorAll<HTMLInputElement>('input[type=radio]').forEach((radio) =>
      radio.addEventListener('change', () => {
        const slot = radio.name.slice('slot-'.length)
        equipped.set(slot, radio.value)
        void rebuild()
      }),
    )
    box
      .querySelectorAll<HTMLInputElement>('input.note')
      .forEach((note) =>
        note.addEventListener('change', () =>
          writeNote(noteKey('peca', note.dataset.path!), note.value.trim()),
        ),
      )
    box.querySelectorAll<HTMLDetailsElement>('details').forEach((details) =>
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
    entry = catalog[index]!
    motion = undefined
    equipped = new Map()
    for (const path of entry.defaults) {
      const slot = slotOf(path)
      if (slot) equipped.set(slot, path)
    }
    renderParts()
    void rebuild()
  }

  function copyList() {
    const lines = [`PERSONAGEM ${entry.name} (${entry.id})`, '', 'ANIMAÇÕES']
    ;(model?.motions ?? []).forEach((m, i) => {
      const meaning = motionMeaning(m.name)
      const note = readNote(noteKey('anim', m.name))
      lines.push(
        `${i + 1}. ${m.name} (${m.frameEnd - m.frameStart} quadros)` +
          (meaning ? ` — palpite: ${meaning}` : '') +
          (note ? ` — NOTA: ${note}` : ''),
      )
    })
    lines.push('', 'PEÇAS')
    for (const slot of slots()) {
      lines.push(`[${slot}]`)
      for (const path of entry.parts[slot]!) {
        const note = readNote(noteKey('peca', path))
        const on = equipped.get(slot) === path ? ' (vestida)' : ''
        lines.push(`  - ${fileName(path)}${on}${note ? ` — NOTA: ${note}` : ''}`)
      }
    }
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
  clubInput.addEventListener('change', () => void applyClub())
  atBallInput.addEventListener('change', place)
  loopInput.addEventListener('change', () => {
    if (motion) model?.play(motion, loopInput.checked, 0)
  })
  speedInput.addEventListener('input', () => {
    $(left, 'output').textContent = `${speedInput.value}×`
  })
  $(left, 'button.copy').addEventListener('click', copyList)

  selectCharacter(0)

  const timer = new Timer()
  renderer.setAnimationLoop((time) => {
    timer.update(time)
    const dt = Math.min(timer.getDelta(), 0.1)
    if (model) {
      model.update(dt * Number(speedInput.value))
      const head = model.clubHead()
      headMarker.visible = Boolean(head)
      if (head) headMarker.position.copy(model.root.localToWorld(head))
    }
    controls.update()
    renderer.render(scene, camera)
  })
}

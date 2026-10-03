/**
 * Catálogo de animações do mapeador, no estilo do Mixamo: uma grade com um cartão por
 * movimento do personagem, todos se mexendo ao mesmo tempo, com busca, filtro por categoria
 * e a anotação de cada um. Clicar no boneco abre o movimento no estúdio (quadro a quadro).
 *
 * Desenho: um boneco só e o canvas do mapeador, atrás da grade (que é transparente nas
 * prévias). A cada quadro, para cada cartão visível: põe a pose do movimento no tempo do
 * cartão e desenha só no retângulo dele (scissor) — o truque do exemplo "multiple elements"
 * do three.js. Cartões fora da tela não custam nada.
 */
import {
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Sphere,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from 'three'
import type { CharacterModel } from './character.ts'
import { describeMotion, MOTION_CATEGORIES, type MotionCategory } from './motion-names.ts'

const FPS = 30
/** Pausa no fim de cada volta (s), para dar para ver a pose final. */
const LOOP_PAUSE = 0.5
/** Enquadramentos novos por quadro (cada um mede o boneco em várias poses do movimento). */
const FRAMINGS_PER_FRAME = 3
const FRAMING_SAMPLES = 8
const FOV = 30
/** De frente, um pouco de lado e de cima (o boneco olha para +Z). */
const VIEW_DIRECTION = new Vector3(Math.sin(0.45), 0.28, Math.cos(0.45)).normalize()
const BACKGROUND = 0x1e2228
const CARD_BACKGROUND = new Color(0x4a4f57)
const IDLE = '기본자세'
const SIZE_KEY = 'pangyaweb.catalogo.tamanho'

interface Card {
  name: string
  category: MotionCategory
  /** Trecho final de outro movimento (nome terminado em "끝"). */
  ending: boolean
  element: HTMLElement
  preview: HTMLElement
  note: HTMLInputElement
  /** Texto da busca (tradução e nome coreano). */
  search: string
  time: number
  /** Esfera que cabe o movimento inteiro (medida na primeira vez que o cartão aparece). */
  frame?: Sphere
}

export interface CatalogNotes {
  read(name: string): string
  bind(input: HTMLInputElement, name: string): void
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function savedSize() {
  try {
    return Number(localStorage.getItem(SIZE_KEY)) || 200
  } catch {
    return 200
  }
}

export class MotionCatalog {
  readonly element = document.createElement('div')
  /** Lugar no cabeçalho para os controles do mapeador (personagem, taco, botões). */
  readonly tools: HTMLElement
  private readonly grid: HTMLElement
  private readonly chips: HTMLElement
  private readonly count: HTMLElement
  private readonly search: HTMLInputElement
  private readonly endings: HTMLInputElement
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.1, 500)
  private readonly size = new Vector2()
  private model: CharacterModel | undefined
  /** Enquadramento da postura parada: o tamanho do boneco é o mesmo em todos os cartões. */
  private base = new Sphere(new Vector3(0, 3, 0), 3.5)
  private cards: Card[] = []
  private category: MotionCategory | '' = ''

  constructor(private readonly options: { notes: CatalogNotes; onOpen: (name: string) => void }) {
    this.element.className = 'motion-catalog'
    this.element.innerHTML = `
      <header>
        <h1>Catálogo de animações</h1>
        <span class="catalog-count"></span>
        <div class="catalog-tools"></div>
        <input class="search" type="search" placeholder="Buscar (ex.: putter, birdie, 우드, sua anotação)" />
        <label><input type="checkbox" name="endings" /> trechos finais</label>
        <label>Tamanho <input type="range" name="size" min="130" max="380" step="10" /></label>
        <p class="hint">Todas se mexem ao mesmo tempo · passe o mouse para ver do começo ·
          clique no boneco para abrir no estúdio (quadro a quadro) · anote o que é cada uma</p>
        <div class="catalog-chips"></div>
      </header>
      <div class="catalog-grid"></div>`
    const $ = <T extends Element>(selector: string) => this.element.querySelector(selector) as T
    this.tools = $('.catalog-tools')
    this.grid = $('.catalog-grid')
    this.chips = $('.catalog-chips')
    this.count = $('.catalog-count')
    this.search = $('input.search')
    this.endings = $('input[name=endings]')
    const size = $<HTMLInputElement>('input[name=size]')
    size.value = String(savedSize())
    const applySize = () => this.grid.style.setProperty('--card', `${size.value}px`)
    applySize()
    size.addEventListener('input', () => {
      applySize()
      try {
        localStorage.setItem(SIZE_KEY, size.value)
      } catch {
        // sem armazenamento: vale só nesta página
      }
    })
    this.search.addEventListener('input', () => this.filter())
    this.endings.addEventListener('change', () => this.filter())

    this.scene.background = CARD_BACKGROUND
    this.scene.add(new HemisphereLight(0xffffff, 0x50555c, 2.2))
    const key = new DirectionalLight(0xffffff, 1.4)
    key.position.set(20, 40, 30)
    this.scene.add(key)
    const back = new DirectionalLight(0xffffff, 0.6)
    back.position.set(-20, 20, -30)
    this.scene.add(back)
    this.scene.add(new GridHelper(40, 40, 0x8a9099, 0x63686f))
    this.count.textContent = 'Carregando…'
  }

  get visible() {
    return !this.element.hidden
  }

  /** Troca o boneco (um modelo só do catálogo, com a roupa e o taco escolhidos). */
  setModel(model: CharacterModel | undefined) {
    if (this.model) this.scene.remove(this.model.root)
    this.model = model
    this.cards = []
    this.grid.innerHTML = ''
    if (!model) {
      this.count.textContent = 'Carregando…'
      return
    }
    model.root.position.set(0, 0, 0)
    model.root.rotation.y = Math.PI / 2 // de frente para +Z, como no estúdio
    this.scene.add(model.root)
    this.base = new Sphere(new Vector3(0, 3, 0), 0)
    if (model.clips.has(IDLE)) this.base = this.measure(IDLE)
    else {
      model.root.updateMatrixWorld(true)
      this.base = new Box3().setFromObject(model.root, true).getBoundingSphere(new Sphere())
    }
    if (!(this.base.radius > 0)) this.base = new Sphere(new Vector3(0, 3, 0), 3.5)
    this.build(model)
  }

  /** Cartões agrupados por categoria (na ordem do mapeador), numerados como na lista. */
  private build(model: CharacterModel) {
    const motions = model.motions.map((m, i) => ({ ...m, i, ...describeMotion(m.name) }))
    if (motions.length === 0) {
      this.grid.innerHTML = '<p class="empty">Este personagem não tem animações.</p>'
    }
    for (const category of MOTION_CATEGORIES) {
      const items = motions.filter((m) => m.category === category)
      if (items.length === 0) continue
      const section = document.createElement('section')
      section.dataset.category = category
      section.innerHTML = `<h2>${category}</h2><div class="catalog-cards"></div>`
      const list = section.querySelector('.catalog-cards')!
      for (const m of items) {
        const frames = m.frameEnd - m.frameStart
        const element = document.createElement('div')
        element.className = 'motion-card'
        element.innerHTML = `
          <div class="preview" title="Abrir no estúdio"><span class="number">${m.i + 1}</span></div>
          <div class="info">
            <strong>${escapeHtml(m.text || '(sem tradução)')}</strong>
            <small>${escapeHtml(m.name)} · ${frames} quadros (${(frames / FPS).toFixed(1)} s)</small>
            <input class="note" placeholder="o que é?" />
          </div>`
        const preview = element.querySelector<HTMLElement>('.preview')!
        const note = element.querySelector<HTMLInputElement>('.note')!
        note.value = this.options.notes.read(m.name)
        this.options.notes.bind(note, m.name)
        const card: Card = {
          name: m.name,
          category,
          ending: m.name.endsWith('끝'),
          element,
          preview,
          note,
          search: `${m.text} ${m.name} ${m.i + 1}`.toLowerCase(),
          time: 0,
        }
        preview.addEventListener('click', () => this.options.onOpen(m.name))
        preview.addEventListener('mouseenter', () => (card.time = 0))
        list.append(element)
        this.cards.push(card)
      }
      this.grid.append(section)
    }
    this.filter()
  }

  /** Busca (tradução, coreano, número ou anotação), trechos finais e categoria. */
  private filter() {
    const query = this.search.value.trim().toLowerCase()
    const endings = this.endings.checked
    const counts = new Map<MotionCategory | '', number>()
    let shown = 0
    for (const card of this.cards) {
      const text = `${card.search} ${card.note.value.toLowerCase()}`
      const matches = (endings || !card.ending) && (query === '' || text.includes(query))
      if (matches) {
        counts.set('', (counts.get('') ?? 0) + 1)
        counts.set(card.category, (counts.get(card.category) ?? 0) + 1)
      }
      card.element.hidden = !matches || (this.category !== '' && card.category !== this.category)
      if (!card.element.hidden) shown++
    }
    this.grid.querySelectorAll<HTMLElement>('section').forEach((section) => {
      section.hidden = [...section.querySelectorAll<HTMLElement>('.motion-card')].every(
        (c) => c.hidden,
      )
    })
    this.count.textContent = `${shown} de ${this.cards.length} animações`
    const chip = (value: MotionCategory | '', label: string) =>
      `<button data-category="${value}" class="${this.category === value ? 'active' : ''}">${label} <small>${counts.get(value) ?? 0}</small></button>`
    this.chips.innerHTML =
      chip('', 'Todas') +
      MOTION_CATEGORIES.filter((c) => this.cards.some((card) => card.category === c))
        .map((c) => chip(c, c))
        .join('')
    this.chips.querySelectorAll<HTMLButtonElement>('button').forEach((button) =>
      button.addEventListener('click', () => {
        this.category = button.dataset.category as MotionCategory | ''
        this.filter()
      }),
    )
  }

  /** Esfera que cabe o boneco em todas as poses do movimento (amostradas). */
  private measure(name: string): Sphere {
    const model = this.model!
    const duration = model.clips.get(name)?.duration ?? 0
    const box = new Box3()
    const pose = new Box3()
    for (let i = 0; i <= FRAMING_SAMPLES; i++) {
      model.pose(name, (duration * i) / FRAMING_SAMPLES)
      model.root.updateMatrixWorld(true)
      box.union(pose.setFromObject(model.root, true))
    }
    const sphere = box.isEmpty() ? this.base.clone() : box.getBoundingSphere(new Sphere())
    // Mesmo tamanho em todos os cartões; só afasta quando o movimento sai disso.
    sphere.radius = Math.max(sphere.radius, this.base.radius)
    return sphere
  }

  /** Câmera do cartão: a esfera inteira cabe no retângulo. */
  private aim(frame: Sphere, aspect: number) {
    const camera = this.camera
    camera.aspect = aspect
    const half = Math.tan((FOV * Math.PI) / 360)
    const fit = Math.atan(Math.min(half, half * aspect))
    const distance = (frame.radius / Math.sin(fit)) * 1.04
    camera.position.copy(frame.center).addScaledVector(VIEW_DIRECTION, distance)
    camera.lookAt(frame.center)
    camera.near = distance / 50
    camera.far = distance * 4
    camera.updateProjectionMatrix()
  }

  /** Desenha os cartões visíveis no canvas (que fica atrás da grade). */
  render(renderer: WebGLRenderer, dt: number) {
    const { x: width, y: height } = renderer.getSize(this.size)
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, width, height)
    renderer.setClearColor(BACKGROUND, 1)
    renderer.clear()
    const model = this.model
    if (!model || !this.visible) return
    const view = this.grid.getBoundingClientRect()
    // Primeiro mede onde estão todos (só leitura do layout), depois desenha.
    const shown: [Card, DOMRect][] = []
    for (const card of this.cards) {
      if (card.element.hidden) continue
      const rect = card.preview.getBoundingClientRect()
      if (rect.width > 0 && rect.bottom > view.top && rect.top < view.bottom) {
        shown.push([card, rect])
      }
    }
    renderer.setScissorTest(true)
    let measured = 0
    for (const [card, rect] of shown) {
      if (!card.frame && measured < FRAMINGS_PER_FRAME) {
        card.frame = this.measure(card.name)
        measured++
      }
      const duration = model.clips.get(card.name)?.duration ?? 0
      card.time = (card.time + dt) % (duration + LOOP_PAUSE)
      model.pose(card.name, Math.min(card.time, duration))
      model.root.updateMatrixWorld(true)
      this.aim(card.frame ?? this.base, rect.width / rect.height)
      const top = Math.max(rect.top, view.top)
      const bottom = Math.min(rect.bottom, view.bottom)
      renderer.setViewport(rect.left, height - rect.bottom, rect.width, rect.height)
      renderer.setScissor(rect.left, height - bottom, rect.width, bottom - top)
      renderer.render(this.scene, this.camera)
    }
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, width, height)
  }
}

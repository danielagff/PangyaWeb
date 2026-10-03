import {
  DEFAULT_POWER,
  HoleWorld,
  isPangya,
  loadHoleData,
  solveShot,
  type ShotEvent,
  type HoleRef,
  type HoleState,
  type ShotRequest,
} from '@pangya/game'
import type { SurfaceKind } from '@pangya/formats'
import {
  CUP_DEPTH,
  dropIntoCup,
  STEP_TIME,
  unitsToMeters,
  unitsToYards,
  yardsToUnits,
  type Wind,
} from '@pangya/physics'
import {
  AlwaysDepth,
  AlwaysStencilFunc,
  AmbientLight,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  EqualStencilFunc,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Raycaster,
  ReplaceStencilOp,
  RingGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  WebGLRenderer,
} from 'three'
import { SoundLibrary, type SynthSound } from '../audio/sounds.ts'
import { categoryOfClub, clubModelFor } from '../character/clubs.ts'
import { golfMotions, reactionMotion, type Reaction } from '../character/motions.ts'
import {
  placeAtBall,
  CharacterModel,
  loadCatalog,
  type CharacterEntry,
} from '../character/character.ts'

import { browserFiles } from './assets.ts'
import { aimDirection, toScene } from './coords.ts'
import { buildCourseScene, SKY_RADIUS, type CourseScene } from './course-scene.ts'
import { buildGreenGrid } from './green-grid.ts'
import type { PowerBar } from './power-bar.ts'
import { createShotHud, type ShotHud } from './shot-hud.ts'
import { lerpFactor, Smooth } from './smooth.ts'
import { SURFACE_LABELS } from './surface-colors.ts'
import { TextureLibrary } from './textures.ts'

/** Raio da bola na tela (unidades). Maior que o real (0,07) para ser vista, como no jogo. */
const BALL_RADIUS = 0.2
const MAX_TRAIL = 4000
/** Raio da cova desenhada (unidades); a captura da física usa GROUND_TUNING.cupRadius. */
const CUP_RADIUS = 0.45
/**
 * Altura desenhada da luz da cova (unidades, ~28 m), alta como no original; a parte que pega a
 * bola é CUP_BEAM.height. No topo dela fica o marcador do pin (desnível e distância).
 */
const BEAM_HEIGHT = 100
/** Raio da coluna de luz (unidades) e a largura mínima dela na tela (px). */
const BEAM_RADIUS = 0.9
const BEAM_MIN_PIXELS = 6
/** Segundos antes de a bola cair em que a câmera livre do voo volta ao normal. */
const FREE_CAMERA_UNTIL_LANDING = 0.8
const UP = new Vector3(0, 1, 0)
/** Altura da vista aérea (unidades): perto da cova até o buraco inteiro. */
const AERIAL = { minHeight: 12, maxHeight: 3000 }
/**
 * Vista aérea segurando as teclas: Shift+↑/↓ = zoom (fator por segundo); ↑/↓ = andar pela
 * linha da mira (fração da altura por segundo, para valer em qualquer zoom).
 */
const AERIAL_ZOOM_RATE = 1
/** ↑/↓: começa devagar (`slow`) e acelera até `fast` (fração da altura por segundo). */
const AERIAL_PAN = { slow: 0.1, fast: 0.45, rampSeconds: 1.5 }

/**
 * Mira (graus): um toque gira um passo fino; segurando, depois de `holdDelay` s, gira sozinha
 * cada vez mais rápido (de `speed[0]` a `speed[1]` graus/s em `rampSeconds`). No green, tudo
 * mais fino.
 */
const AIM_TUNING = {
  step: 0.1,
  greenStep: 0.05,
  holdDelay: 0.25,
  speed: [2, 25],
  greenSpeed: [0.6, 8],
  rampSeconds: 2.5,
}
/** Segundos entre os recálculos exatos do ponto de queda enquanto a mira gira. */
const LANDING_REFRESH = 0.12
const DEG = Math.PI / 180
/** Teclas de mira e o sentido (positivo = esquerda). */
const AIM_KEYS: Record<string, 1 | -1> = { ArrowLeft: 1, KeyA: 1, ArrowRight: -1, KeyD: -1 }

/** "Sempre PANGYA" (desenvolvimento, só sozinho), lembrado neste navegador. */
const AUTO_PANGYA_KEY = 'pangyaweb.semprePangya'
function readAutoPangya() {
  try {
    return localStorage.getItem(AUTO_PANGYA_KEY) === '1'
  } catch {
    return false
  }
}
function saveAutoPangya(on: boolean) {
  try {
    localStorage.setItem(AUTO_PANGYA_KEY, on ? '1' : '0')
  } catch {
    // sem armazenamento: vale só nesta página
  }
}

/**
 * Desenhos por cima do jogo, como no original: na vista aérea, a linha vermelha da bola até o
 * X (onde a bola cai a 100% com o taco e a mira atuais) com a distância; sempre, o marcador do
 * pin (bandeira, triângulo, desnível em m e distância) — no topo da luz da cova na câmera
 * normal, na cova na vista aérea.
 */
const COURSE_OVERLAY = `<svg class="course-overlay" width="100%" height="100%" aria-hidden="true">
  <line class="aim-line" />
  <g class="x-mark">
    <path d="M-7 -7 L7 7 M7 -7 L-7 7" class="x-outline" />
    <path d="M-7 -7 L7 7 M7 -7 L-7 7" class="x-cross" />
    <text class="x-label" y="-14" text-anchor="middle"></text>
  </g>
  <g class="pin-mark">
    <path d="M0 -13 L0 -38" class="pin-pole" />
    <path d="M0 -38 L13 -33 L0 -28 Z" class="pin-flag" />
    <path d="M-7 -13 L7 -13 L0 0 Z" class="pin-tip" />
    <text class="pin-height" x="11" y="-4"></text>
    <text class="pin-distance" y="17" text-anchor="middle"></text>
  </g>
</svg>`

/**
 * Luz da cova (no lugar da bandeira), como no original: coluna verde-água alta, mais clara no
 * meio e sumindo no topo. Ela "puxa" a bola que passa baixo o bastante (CUP_BEAM.height, na
 * física); o desenho é só a coluna.
 */
function cupBeam() {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256
  const g = canvas.getContext('2d')!
  const gradient = g.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, 'rgba(255,255,255,0)')
  gradient.addColorStop(0.12, 'rgba(255,255,255,1)')
  gradient.addColorStop(1, 'rgba(255,255,255,1)')
  g.fillStyle = gradient
  g.fillRect(0, 0, 4, 256)
  const fade = new CanvasTexture(canvas)
  const column = (radius: number, color: number, opacity: number) => {
    const material = new MeshBasicMaterial({
      color,
      map: fade,
      transparent: true,
      opacity,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
    })
    const mesh = new Mesh(new CylinderGeometry(radius, radius, BEAM_HEIGHT, 24, 1, true), material)
    mesh.position.y = BEAM_HEIGHT / 2
    mesh.renderOrder = 2
    return mesh
  }
  const outer = column(BEAM_RADIUS, 0x2ec4b6, 0.45)
  const core = column(BEAM_RADIUS / 3, 0xb8fff6, 0.85)
  const group = new Group()
  group.add(outer, core)
  return { group, material: outer.material as MeshBasicMaterial }
}

/** Ordem de desenho da cova (depois do terreno e dos objetos opacos). */
const CUP_ORDER = 10

/**
 * Cova de verdade, um buraco no green: a boca marca o stencil (só onde está visível, sem
 * morro na frente) e, dentro dela, a parede e o fundo são desenhados por cima do terreno,
 * regravando a profundidade — assim a bola que cai aparece lá dentro (ela é desenhada
 * depois, com CUP_ORDER + 3). `normal` inclina a cova com o green.
 */
function cupHole(normal: Vector3, at: Vector3) {
  const group = new Group()
  group.position.copy(at)
  group.quaternion.setFromUnitVectors(UP, normal)
  const flat = -Math.PI / 2

  const mouth = new Mesh(
    new CircleGeometry(CUP_RADIUS, 32),
    new MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: AlwaysStencilFunc,
      stencilZPass: ReplaceStencilOp,
    }),
  )
  mouth.rotation.x = flat
  mouth.renderOrder = CUP_ORDER

  // Dentro da boca: desenha por cima do terreno e grava a profundidade de dentro da cova.
  const inside = {
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: EqualStencilFunc,
    depthFunc: AlwaysDepth,
    fog: false,
  } as const
  // Parede com a borda branca de plástico em cima, escurecendo para o fundo.
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 64
  const g = canvas.getContext('2d')!
  const shade = g.createLinearGradient(0, 0, 0, 64)
  shade.addColorStop(0, '#f2f2f2')
  shade.addColorStop(0.18, '#d8d8d8')
  shade.addColorStop(0.2, '#4a4a4a')
  shade.addColorStop(1, '#141414')
  g.fillStyle = shade
  g.fillRect(0, 0, 4, 64)
  const wall = new Mesh(
    new CylinderGeometry(CUP_RADIUS, CUP_RADIUS, CUP_DEPTH, 32, 1, true),
    new MeshBasicMaterial({ ...inside, map: new CanvasTexture(canvas), side: BackSide }),
  )
  wall.position.y = -CUP_DEPTH / 2
  wall.renderOrder = CUP_ORDER + 1
  const bottom = new Mesh(
    new CircleGeometry(CUP_RADIUS, 32),
    new MeshBasicMaterial({ ...inside, color: 0x101010 }),
  )
  bottom.rotation.x = flat
  bottom.position.y = -CUP_DEPTH
  bottom.renderOrder = CUP_ORDER + 1

  const rim = new Mesh(
    new RingGeometry(CUP_RADIUS, CUP_RADIUS * 1.12, 32),
    new MeshBasicMaterial({ color: 0xf5f5f5, polygonOffset: true, polygonOffsetFactor: -4 }),
  )
  rim.rotation.x = flat
  group.add(mouth, wall, bottom, rim)
  return group
}

/** Rosa dos ventos: mostrador redondo, seta azul (girada pelo vento) e selo com os metros. */
const WIND_DIAL = `
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <linearGradient id="wind-ring" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f4f6f8" /><stop offset="0.5" stop-color="#9aa4ae" />
        <stop offset="1" stop-color="#e3e7ea" />
      </linearGradient>
      <radialGradient id="wind-face" cx="0.5" cy="0.4" r="0.6">
        <stop offset="0" stop-color="#2e7d5b" /><stop offset="1" stop-color="#0f3d2a" />
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="48" fill="#26323a" />
    <circle cx="50" cy="50" r="44" fill="url(#wind-ring)" />
    <circle cx="50" cy="50" r="35" fill="url(#wind-face)" stroke="#0b1f16" stroke-width="2" />
  </svg>
  <svg class="arrow" viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <linearGradient id="wind-arrow" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#7fd4ff" /><stop offset="0.5" stop-color="#2f8fe0" />
        <stop offset="1" stop-color="#1257a8" />
      </linearGradient>
    </defs>
    <path d="M50 20 L72 48 L59 48 L59 78 L41 78 L41 48 L28 48 Z"
      fill="url(#wind-arrow)" stroke="#0b3566" stroke-width="2.5" stroke-linejoin="round" />
  </svg>
  <div class="speed">0m</div>`

export interface ViewPlayer {
  id: string
  name: string
  color: number
  state: HoleState
  /** Personagem (id do catálogo); sem ele, só a bola. */
  character?: string | undefined
  /** Atributo power (força) do jogador. */
  power?: number
}

/** Etiqueta com o nome acima da bola (multiplayer). */
function nameTag(name: string, color: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const g = canvas.getContext('2d')!
  g.font = 'bold 34px system-ui, sans-serif'
  g.textAlign = 'center'
  g.lineWidth = 6
  g.strokeStyle = 'rgba(0,0,0,0.7)'
  g.strokeText(name, 128, 44)
  g.fillStyle = `#${color.toString(16).padStart(6, '0')}`
  g.fillText(name, 128, 44)
  const sprite = new Sprite(
    new SpriteMaterial({ map: new CanvasTexture(canvas), depthTest: false, fog: false }),
  )
  sprite.scale.set(16, 4, 1)
  sprite.renderOrder = 4
  return sprite
}

/**
 * Tudo o que se vê de um buraco: cenário, bolas dos jogadores, câmera, mira, painel e HUD.
 * Não decide regras nem simula — quem usa (modo sozinho ou online) chama `animateShot`
 * com a trajetória e `setPlayers` com o estado novo.
 */
export class HoleView {
  readonly world: HoleWorld
  readonly panel: ShotHud
  private readonly renderer: WebGLRenderer
  private readonly scene: Scene
  private readonly camera: PerspectiveCamera
  private readonly course: CourseScene
  private readonly elements: HTMLElement[] = []
  private readonly hud: HTMLElement
  private readonly status: HTMLElement
  private readonly balls = new Map<string, { ball: Mesh; tag: Sprite | undefined }>()
  private readonly target: Mesh
  private readonly greenGrid: LineSegments
  private readonly boxLines: LineSegments
  private readonly trailPositions: Float32BufferAttribute
  private readonly trailGeometry = new BufferGeometry()
  private readonly ray = new Raycaster()
  private readonly keys = new Set<string>()
  private readonly cleanups: (() => void)[] = []
  private readonly bar: PowerBar
  private readonly windBox: HTMLElement
  private beamMaterial!: MeshBasicMaterial
  private beam!: Group
  /** Câmera livre no voo: giro (A/D) e vista de cima (S), até a bola quase cair. */
  private flightYaw = 0
  private flightTop = false
  /** Câmera parada pelo __debugCup (testes). */
  private debugFreeze = false
  private wind: Wind = { speed: 0, degree: 0 }

  private players: ViewPlayer[] = []
  private active: ViewPlayer | undefined
  private controllable = false
  private phase: 'aim' | 'flying' | 'idle' = 'idle'
  private aim = 0
  private shotForward = aimDirection(0)
  private targetDirty = true
  private readyAt = 0
  /** Quando começou o toque de mira atual (segurando, gira sozinha depois de um tempo). */
  private turnStart = 0
  /**
   * Pontos de queda exatos (cena), calculados com a mira `aim`: `ring` com a força atual (anel
   * amarelo) e `full` a 100% (o X da vista aérea). Enquanto a mira gira, eles giram junto em
   * volta da bola e o cálculo exato (caro) é refeito a cada `LANDING_REFRESH` s.
   */
  private landing: { aim: number; at: number; ring: Vector3; full: Vector3 } | undefined
  /**
   * Vista aérea (M ou 0), olhando a linha da mira de cima: `along` = quanto o centro está à
   * frente da bola na linha (↑/↓), `height` = altura (Shift+↑/↓). `follow`: o centro fica no X
   * (Delete+0) até a câmera ser movida.
   */
  private aerial: { along: number; height: number; follow: boolean } | undefined
  /** Câmera aérea suavizada (molas): giro, quanto à frente na linha, altura e chão. */
  private aerialCam: { yaw: Smooth; along: Smooth; height: Smooth; ground: Smooth } | undefined
  /** Entrando na vista aérea: de onde a câmera saiu e quando (passagem suave). */
  private aerialFrom: { position: Vector3; look: Vector3; at: number } | undefined
  /** X desenhado (suavizado): ângulo em relação à mira e distância da bola. */
  private readonly shownX = { offset: new Smooth(0, 0.08), reach: new Smooth(0, 0.08) }
  /** Duração do quadro atual (s), para as suavizações contarem pelo tempo. */
  private frameDt = 1 / 60
  /** Quando ↑/↓ começaram a ser segurados (acelera andando pela linha). */
  private aerialMoveStart = 0
  private readonly drawings: HTMLDivElement
  /** Ferramentas de desenvolvimento (tecla P: sempre PANGYA) — só no modo sozinho. */
  private readonly devTools: boolean
  private autoPangya = false
  private surfaceView = false
  private fogOn = true
  private flight:
    | {
        playerId: string
        frames: Float32Array
        start: number
        done: () => void
        events: ShotEvent[]
        /** Quantos eventos da linha do tempo já tocaram. */
        fired: number
        impact: number | undefined
        /** Quadro em que a bola toca o chão pela primeira vez. */
        landing: number
        /** Quadro mostrado agora. */
        index: number
      }
    | undefined
  readonly sounds: SoundLibrary
  private readonly characters = new Map<string, Promise<CharacterModel | undefined>>()
  private readonly ready = new Map<string, CharacterModel>()
  /** Taco sendo preparado por personagem (evita repetir a cada mudança do painel). */
  private readonly addressing = new Map<CharacterModel, string>()
  /** Movimento escolhido com a tecla N (depuração). */
  private motionIndex = -1
  /** O backswing já começou com a barra (a tacada continua do topo). */
  private backswing = false
  private walking = false

  /** Chamado quando o jogador da vez bate (espaço ou botão). */
  onShoot: (request: ShotRequest) => void = () => {}

  private constructor(
    world: HoleWorld,
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
    scene: Scene,
    course: CourseScene,
    status: HTMLElement,
    options: { lockWind: boolean; title: string; devTools: boolean },
  ) {
    this.world = world
    this.devTools = options.devTools
    this.sounds = new SoundLibrary(world.data.ref.round)
    this.renderer = renderer
    this.camera = camera
    this.scene = scene
    this.course = course
    this.status = status
    this.elements.push(renderer.domElement, status)

    const data = world.data
    // Luzes só para os materiais de depuração (mapa de pisos, modelos sem textura).
    scene.add(new AmbientLight(0xffffff, 0.75))
    const sun = new DirectionalLight(0xffffff, 1.1)
    sun.position.set(300, 800, 200)
    scene.add(sun)

    // Tecla C: caixas de colisão dos objetos (depuração).
    const edges = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]
    this.boxLines = new LineSegments(
      new BufferGeometry().setAttribute(
        'position',
        new Float32BufferAttribute(
          data.obstacles.flatMap((b) =>
            edges.flatMap((i) => {
              const [x, y, z] = b.corners[i]!
              return toScene(x, y, z).toArray()
            }),
          ),
          3,
        ),
      ),
      new LineBasicMaterial({ color: 0xff4081 }),
    )
    this.boxLines.visible = false
    scene.add(this.boxLines)

    // Cova (disco escuro com borda, deitado na inclinação do green) e a luz que puxa a bola.
    const cupHit = world.grid.groundAt(world.cup.x, world.cup.z)
    const [nx, ny, nz] = cupHit ? world.grid.normalOf(cupHit.triangle) : [0, 1, 0]
    scene.add(
      cupHole(new Vector3(nx, ny, -nz).normalize(), toScene(world.cup.x, world.cup.y, world.cup.z)),
    )
    const beam = cupBeam()
    beam.group.position.copy(toScene(world.cup.x, world.cup.y, world.cup.z))
    beam.group.name = 'luz-da-cova'
    scene.add(beam.group)
    this.beamMaterial = beam.material
    this.beam = beam.group

    this.greenGrid = buildGreenGrid(
      world.grid,
      (t) => data.collision.surfaces[t]?.kind === 'green',
      { x: world.cup.x, z: world.cup.z },
    )
    this.greenGrid.visible = false
    scene.add(this.greenGrid)

    this.trailPositions = new Float32BufferAttribute(new Float32Array(MAX_TRAIL * 3), 3)
    this.trailGeometry.setAttribute('position', this.trailPositions)
    this.trailGeometry.setDrawRange(0, 0)
    const trail = new Line(this.trailGeometry, new LineBasicMaterial({ color: 0xffeb3b }))
    trail.frustumCulled = false
    scene.add(trail)

    // Anel onde a tacada cai (força, spin e curva atuais, sem vento), como no jogo.
    this.target = new Mesh(
      new RingGeometry(2.2, 3.4, 32),
      new MeshBasicMaterial({ color: 0xffeb3b, side: DoubleSide, depthTest: false, fog: false }),
    )
    this.target.rotation.x = -Math.PI / 2
    this.target.renderOrder = 3
    scene.add(this.target)

    this.hud = document.createElement('div')
    this.hud.className = 'hud'
    document.body.appendChild(this.hud)
    this.elements.push(this.hud)

    this.panel = createShotHud(() => this.shoot())
    this.cleanups.push(() => this.panel.dispose())
    this.bar = this.panel.bar
    this.hud.dataset.title = options.title
    this.windBox = document.createElement('div')
    this.windBox.className = 'wind'
    this.drawings = document.createElement('div')
    this.drawings.className = 'course-overlay-box'
    this.drawings.innerHTML = COURSE_OVERLAY
    document.body.appendChild(this.drawings)
    this.elements.push(this.drawings)
    if (this.devTools) {
      this.setAutoPangya(readAutoPangya(), false)
      // Calibrador da régua: o 2º espaço usa a força dele.
      this.bar.setSnapToMark(true)
    }
    this.windBox.innerHTML = WIND_DIAL
    document.body.appendChild(this.windBox)
    this.elements.push(this.windBox)
    this.panel.onChange(() => {
      this.targetDirty = true
      const model = this.active && this.ready.get(this.active.id)
      if (model?.root.visible && this.phase === 'aim' && !this.bar.active) void this.address(model)
    })

    this.listen(window, 'keydown', (e) => {
      const key = (e as KeyboardEvent).code
      if (key === 'KeyM' || key === 'Digit0' || key === 'Numpad0') {
        // Delete + 0: vista aérea já aproximada onde a tacada cai (força máxima).
        this.toggleAerial(this.keys.has('Delete') && key !== 'KeyM')
      }
      if (key === 'Delete') this.keys.add(key)
      if (key === 'KeyT') this.course.setSurfaceView((this.surfaceView = !this.surfaceView))
      if (key === 'KeyF') this.course.setFog((this.fogOn = !this.fogOn) && !this.aerial)
      if (key === 'KeyC') this.boxLines.visible = !this.boxLines.visible
      if (key === 'KeyN') this.cycleMotion()
      if (key === 'KeyV') {
        this.panel.showResult(
          this.sounds.toggleMute() ? '🔇 som desligado (V)' : '🔊 som ligado (V)',
        )
      }
      if (key === 'KeyP' && this.devTools && !(e as KeyboardEvent).repeat) {
        this.setAutoPangya(!this.autoPangya)
      }
      if (key === 'KeyG' && this.devTools && !(e as KeyboardEvent).repeat) this.runCalculator()
      if (key === 'KeyS' && this.flight && this.freeFlightCamera()) this.flightTop = !this.flightTop
      // Vista aérea: ↑/↓ andam pela linha da mira, Shift+↑/↓ = zoom (segurando, suave).
      if (['ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight'].includes(key)) {
        if (key.startsWith('Arrow')) e.preventDefault()
        if (key.startsWith('Arrow') && !(e as KeyboardEvent).repeat) {
          this.aerialMoveStart = performance.now()
        }
        this.keys.add(key)
      }
      // Mira: um toque = passo fino; segurando, gira sozinha cada vez mais rápido.
      const turn = AIM_KEYS[key]
      if (turn) {
        e.preventDefault()
        this.keys.add(key)
        if (!(e as KeyboardEvent).repeat) this.nudgeAim(turn)
      }
    })
    // O mouse nunca move a câmera (como no jogo). A roda sempre troca o taco — também na
    // vista aérea, onde o X vai para onde o novo taco alcança.
    const canvas = renderer.domElement
    this.listen(canvas, 'contextmenu', (e) => e.preventDefault())
    this.listen(canvas, 'wheel', (e) => {
      e.preventDefault()
      if (this.phase === 'aim' && this.controllable) {
        this.panel.cycleClub((e as WheelEvent).deltaY > 0 ? 1 : -1)
      }
    })
    this.listen(window, 'keyup', (e) => this.keys.delete((e as KeyboardEvent).code))
    // Janela perdeu o foco com tecla apertada: solta tudo (senão a mira gira sozinha).
    this.listen(window, 'blur', () => this.keys.clear())
    this.listen(window, 'resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    })
    this.listen(renderer.domElement, 'webglcontextlost', (e) => {
      e.preventDefault()
      this.showError('A placa de vídeo perdeu o contexto WebGL. Recarregue a página.')
    })

    let last = performance.now()
    renderer.setAnimationLoop((now) => {
      try {
        this.frame(now, Math.min(0.1, (now - last) / 1000))
        last = now
      } catch (err) {
        renderer.setAnimationLoop(null)
        this.showError(
          `Erro ao desenhar: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
        )
      }
    })

    // Depuração (testes automatizados): câmera perto da cova para ver a luz.
    ;(window as unknown as { __debugCup: (near?: boolean) => void }).__debugCup = (near) => {
      const at = toScene(world.cup.x, world.cup.y, world.cup.z)
      this.aerial = undefined
      this.phase = 'idle'
      camera.position.copy(at).add(near ? new Vector3(0.7, 2.4, 0.7) : new Vector3(14, 7, 14))
      camera.lookAt(at.clone().add(new Vector3(0, near ? -0.2 : 4, 0)))
      this.debugFreeze = true
    }
    // Depuração: bola caindo na cova (vista de perto), para conferir o buraco.
    ;(window as unknown as { __debugDrop: () => void }).__debugDrop = () => {
      if (!this.active) return
      const cup = world.cup
      const from = { x: cup.x + 3, y: cup.y, z: cup.z + 1 }
      const roll = Array.from({ length: 30 }, (_, i) => {
        const f = i / 30
        return [from.x + (cup.x + 0.3 - from.x) * f, cup.y, from.z + (cup.z + 0.1 - from.z) * f]
      }).flat()
      const frames = Float32Array.from([
        ...roll,
        ...dropIntoCup({ x: cup.x + 0.3, y: cup.y, z: cup.z + 0.1 }, cup),
      ])
      void this.animateShot(this.active.id, frames, {})
    }
    ;(window as unknown as { __debugScene: Scene }).__debugScene = scene
    ;(window as unknown as { __debug: () => unknown }).__debug = () => ({
      camera: camera.position.toArray().map((v) => Math.round(v)),
      cameraExact: camera.position.toArray(),
      phase: this.phase,
      aim: this.aim,
      active: this.active?.id,
      motion: this.active && this.ready.get(this.active.id)?.playing,
      players: this.players.map((p) => ({ id: p.id, state: p.state })),
      balls: [...this.balls].map(([id, e]) => ({
        id,
        visible: e.ball.visible,
        at: e.ball.position.toArray().map((v) => Math.round(v * 100) / 100),
      })),
      cup: toScene(world.cup.x, world.cup.y, world.cup.z).toArray(),
    })
  }

  private listen(target: EventTarget, type: string, handler: (e: Event) => void) {
    target.addEventListener(type, handler)
    this.cleanups.push(() => target.removeEventListener(type, handler))
  }

  /**
   * Carrega o buraco e monta a cena (com progresso no canto da tela). `lockWind`: vento vem
   * do servidor (sala). `devTools`: atalhos de desenvolvimento (P = sempre PANGYA) — só no
   * modo sozinho, para não valer na sala com os amigos.
   */
  static async create(
    ref: HoleRef,
    options: { lockWind?: boolean; devTools?: boolean } = {},
  ): Promise<HoleView> {
    const status = document.createElement('div')
    status.className = 'hole-status'
    status.textContent = 'Carregando buraco…'
    document.body.appendChild(status)
    try {
      const renderer = new WebGLRenderer({ antialias: true, stencil: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(window.innerWidth, window.innerHeight)
      document.body.appendChild(renderer.domElement)
      const camera = new PerspectiveCamera(
        55,
        window.innerWidth / window.innerHeight,
        1,
        SKY_RADIUS * 2.4,
      )
      const data = await loadHoleData(browserFiles, ref)
      const world = new HoleWorld(data)
      const scene = new Scene()
      const textures = new TextureLibrary(ref.round, renderer.capabilities.getMaxAnisotropy())
      const course = await buildCourseScene(data, scene, textures, (done, total) => {
        status.textContent = `Carregando texturas… ${done}/${total}`
      })
      const view = new HoleView(world, renderer, camera, scene, course, status, {
        lockWind: options.lockWind ?? false,
        devTools: options.devTools ?? false,
        title: `${ref.prefix} — buraco ${ref.hole}`,
      })
      status.textContent =
        `${world.grid.triangleCount} triângulos · ${data.objects.length} modelos` +
        (data.missingModels.length ? ` (${data.missingModels.length} faltando)` : '') +
        ` · ${course.texturesLoaded} texturas` +
        (course.texturesMissing.length ? ` (${course.texturesMissing.length} faltando)` : '') +
        ` · ${world.obstacles.size} caixas de colisão (${data.obstacleSource})` +
        ' · A/D mirar (toque = passo fino) · roda: taco · Alt: power shot (2× = 2 PS)' +
        ' · espaço: barra (3 toques) · clique na bola do mostrador: spin/curva' +
        ' · M ou 0: vista aérea (↑/↓ anda na linha, Shift+↑/↓ zoom, espaço volta;' +
        ' Delete+0: no X) · calibrador: clique na barra, Z desce, X sobe' +
        (options.devTools
          ? ' (o 2º espaço usa a força dele) · P: sempre PANGYA · G: calculadora (mira e força para cair na cova)'
          : '') +
        ' · no voo: A/D gira, S de cima · T pisos · F névoa · C colisão'
      if (course.texturesMissing.length) {
        console.info('texturas não encontradas:', course.texturesMissing)
      }
      return view
    } catch (err) {
      status.classList.add('error')
      status.textContent = `Não foi possível abrir o buraco:\n${err instanceof Error ? err.message : String(err)}`
      throw err
    }
  }

  showError(message: string) {
    this.status.classList.add('error')
    this.status.textContent = message
  }

  setWind(wind: Wind) {
    this.wind = wind
    this.updateWind()
  }

  /** Seta do vento relativa à mira (para cima = a favor da tacada). */
  private updateWind() {
    const wind = this.wind
    const relative = wind.degree - (this.aim * 180) / Math.PI
    const arrow = this.windBox.querySelector('.arrow') as SVGElement
    arrow.style.transform = `rotate(${-relative}deg)`
    ;(this.windBox.querySelector('.speed') as HTMLElement).textContent = `${wind.speed}m`
  }

  /** Linha extra no HUD (placar, mensagens). */
  hudExtra = ''

  private ballOf(player: ViewPlayer, withTag: boolean) {
    let entry = this.balls.get(player.id)
    if (!entry) {
      const ball = new Mesh(
        new SphereGeometry(BALL_RADIUS, 20, 10),
        new MeshLambertMaterial({
          color: player.color,
          emissive: player.color,
          emissiveIntensity: 0.3,
        }),
      )
      // Depois da cova (que reescreve a profundidade na boca dela): a bola aparece lá dentro.
      ball.renderOrder = CUP_ORDER + 3
      const tag = withTag ? nameTag(player.name, player.color) : undefined
      if (tag) this.scene.add(tag)
      this.scene.add(ball)
      entry = { ball, tag }
      this.balls.set(player.id, entry)
    }
    return entry
  }

  private placeBall(id: string, position: Vector3) {
    const entry = this.balls.get(id)
    if (!entry) return
    entry.ball.position.copy(position)
    entry.tag?.position.copy(position).add(new Vector3(0, 9, 0))
  }

  /**
   * Estado novo dos jogadores. `activeId` é quem joga agora; `controllable` diz se é este
   * navegador que controla a tacada (mira, painel e espaço).
   */
  setPlayers(players: ViewPlayer[], activeId: string | undefined, controllable: boolean) {
    const many = players.length > 1
    this.players = players
    for (const p of players) {
      const { ball, tag } = this.ballOf(p, many)
      // Quem já embocou some do green.
      ball.visible = !(p.state.finished && p.state.result === 'holed')
      if (tag) tag.visible = ball.visible
      this.placeBall(p.id, toScene(p.state.ball.x, p.state.ball.y + BALL_RADIUS, p.state.ball.z))
    }
    const changedTurn = this.active?.id !== activeId || this.phase !== 'aim'
    this.active = players.find((p) => p.id === activeId)
    this.controllable = controllable && !!this.active
    if (!this.active) {
      this.phase = 'idle'
      for (const model of this.ready.values()) model.root.visible = false
      this.panel.setEnabled(false, 'Fim do buraco')
      this.bar.setPinDistance(undefined)
      this.target.visible = false
      this.greenGrid.visible = false
      this.updateHud()
      return
    }
    this.phase = 'aim'
    this.readyAt = performance.now()
    const state = this.active.state
    this.showCharacter(this.active)
    if (changedTurn) {
      this.bar.cancel()
      this.backswing = false
      this.aim = this.world.aimAtPin(state.ball)
      this.panel.resetShot()
      if (this.controllable) {
        const { club, percent } = this.world.suggestClub(state)
        this.panel.setClub(club)
        this.panel.setPercent(percent)
      }
      this.panel.setPower(this.active.power ?? DEFAULT_POWER)
      this.trailGeometry.setDrawRange(0, 0)
    }
    this.panel.setEnabled(this.controllable, this.controllable ? '' : `Vez de ${this.active.name}…`)
    this.greenGrid.visible = this.world.lieKind(state) === 'green'
    this.targetDirty = true
    this.placeCamera(this.ballPosition(), 1)
    this.updateHud()
  }

  /** Carrega (uma vez) o personagem do jogador. */
  private characterOf(player: ViewPlayer): Promise<CharacterModel | undefined> {
    let model = this.characters.get(player.id)
    if (!model) {
      model = loadCatalog()
        .then((list) => list.find((c) => c.id === player.character))
        .then((entry: CharacterEntry | undefined) =>
          entry ? CharacterModel.load(entry) : undefined,
        )
        .then((m) => {
          if (m) {
            this.ready.set(player.id, m)
            m.root.visible = false
            this.scene.add(m.root)
            this.idle(m)
          }
          return m
        })
        .catch((err: unknown) => {
          console.warn('personagem:', err)
          return undefined
        })
      this.characters.set(player.id, model)
    }
    return model
  }

  /** Mostra só o personagem de quem joga, ao lado da bola, virado para ela. */
  private showCharacter(player: ViewPlayer) {
    for (const [id, model] of this.ready) model.root.visible = id === player.id
    if (!player.character) return
    void this.characterOf(player).then((model) => {
      if (!model || this.active?.id !== player.id) return
      model.root.visible = true
      this.placeCharacter(model)
      void this.address(model)
    })
  }

  /** Taco na mão e postura de preparação, com a cabeça do taco encostada na bola. */
  private async address(model: CharacterModel, club: string = this.panel.read().club) {
    const category = categoryOfClub(club)
    if (this.addressing.get(model) === category) return
    this.addressing.set(model, category)
    await this.equipClub(model, club)
    if (this.addressing.get(model) !== category) return // trocou de taco enquanto carregava
    model.address(this.golf(model, club).idle)
    this.addressing.delete(model)
    if (model.root.visible && this.phase === 'aim' && !this.bar.active) this.placeCharacter(model)
  }

  /** Movimentos de golfe do personagem para o taco (o do painel, se não informado). */
  private golf(model: CharacterModel, club: string = this.panel.read().club) {
    return golfMotions(model.motions, categoryOfClub(club))
  }

  /** Postura de preparação para o taco atual. */
  private idle(model: CharacterModel) {
    const name = this.golf(model).idle
    if (name && model.playing !== name) model.play(name)
  }

  /** Pose de reação (comemoração/decepção) do personagem; devolve a duração (s). */
  react(playerId: string, reaction: Reaction): number {
    const model = this.ready.get(playerId)
    if (!model?.root.visible) return 0
    return model.play(reactionMotion(model.motions, reaction), false, 0.2)
  }

  private placeCharacter(model: CharacterModel) {
    const ball = this.ballPosition()
    const forward = aimDirection(this.aim)
    // Destro: de frente para a bola, com o alvo à esquerda.
    const right = new Vector3(-forward.z, 0, forward.x)
    placeAtBall(
      model,
      ball,
      right,
      (at) => this.world.grid.groundAt(at.x, -at.z)?.y ?? ball.y - BALL_RADIUS,
      ball.y - BALL_RADIUS,
    )
  }

  /** Põe na mão o taco escolhido no painel (modelo da tabela de tacos do jogo). */
  private equipClub(model: CharacterModel, club: string = this.panel.read().club) {
    return clubModelFor(categoryOfClub(club)).then((path) => model.setClub(path))
  }

  /** Tecla N: percorre os movimentos do personagem da vez (para mapear os nomes). */
  private cycleMotion() {
    const model = this.active && this.ready.get(this.active.id)
    if (!model || model.motionNames.length === 0) {
      this.panel.showResult('Sem personagem/animações carregados.')
      return
    }
    this.motionIndex = (this.motionIndex + 1) % model.motionNames.length
    const name = model.motionNames[this.motionIndex]!
    model.play(name)
    this.panel.showResult(`Movimento ${this.motionIndex + 1}/${model.motionNames.length}: ${name}`)
  }

  /**
   * Tacada do personagem: continua do topo do backswing (se a barra o começou) ou faz o
   * swing inteiro. Devolve quanto falta (s) até o taco acertar a bola.
   */
  private startSwing(playerId: string, club: string | undefined): number {
    const fromTop = this.backswing
    this.backswing = false
    const model = this.ready.get(playerId)
    if (!model || !model.root.visible) return 0
    if (club) void this.equipClub(model, club)
    const motions = this.golf(model, club)
    if (!motions.swing) return 0
    const from = fromTop ? motions.top : 0
    model.play(motions.swing, false, fromTop ? 0.05 : 0.15, from)
    return Math.max(0, motions.impact - from)
  }

  private ballPosition() {
    const id = this.flight?.playerId ?? this.active?.id
    return (id && this.balls.get(id)?.ball.position.clone()) || new Vector3()
  }

  /** Pedido de tacada com os valores do painel e a mira atual. */
  request(): ShotRequest {
    const input = this.panel.read()
    return {
      club: input.club,
      percent: input.percent,
      shot: input.shot,
      powerShot: input.powerShot,
      spin: input.spin,
      curve: input.curve,
      aim: this.aim,
      power: this.active?.power ?? DEFAULT_POWER,
    }
  }

  /** Espaço/botão: barra de força (3 toques), tacada direta ou pula a animação. */
  private shoot() {
    if (this.flight) {
      this.flight.start = -Infinity
      return
    }
    // Espaço apertado para pular a animação logo quando ela acaba não vira nova tacada.
    if (this.phase !== 'aim' || !this.controllable || performance.now() - this.readyAt < 600) {
      return
    }
    // Na vista aérea, o espaço só volta para a câmera normal; o próximo começa a barra.
    if (this.aerial && !this.bar.active) {
      this.toggleAerial()
      return
    }
    if (this.bar.active) {
      this.bar.press()
      return
    }
    const model = this.active && this.ready.get(this.active.id)
    const backswing = model?.root.visible ? this.golf(model).backswing : undefined
    if (model && backswing) {
      model.play(backswing, false, 0.15)
      this.backswing = true
    }
    this.bar.start(
      ({ percent, impact }) => {
        this.panel.setPercent(percent)
        this.fire({ ...this.request(), percent, impact })
      },
      {
        // Deixou passar da zona: desistiu de bater agora; volta a mirar.
        onCancel: () => {
          this.backswing = false
          if (model?.root.visible) this.idle(model)
          this.readyAt = performance.now()
        },
      },
    )
  }

  /**
   * Escala da barra (alcance do taco a 100%). A distância do pin vai só para o calibrador
   * começar nela (na tela ela fica no marcador do pin).
   */
  private updateBarScale() {
    if (!this.active) return
    const state = this.active.state
    this.bar.setScale(this.world.shotRange(state, this.request()))
    this.bar.setPinDistance(this.world.distanceToPin(state.ball))
  }

  /**
   * Liga/desliga a vista aérea, olhando de cima a linha da mira (a bola embaixo, o X em
   * cima, como no original). M/0: a linha inteira e o pin; Delete+0: já perto do X (ou, se o
   * X passa do buraco, na distância do buraco — ver `followAlong`).
   */
  private toggleAerial(onTarget = false) {
    if (this.aerial && !onTarget) {
      this.aerial = undefined
      this.aerialCam = undefined
      this.aerialFrom = undefined
      this.course.setFog(this.fogOn)
      return
    }
    if (!this.active) return
    this.refreshLanding()
    const reach = this.landingReach()
    if (onTarget) {
      this.aerial = { along: this.followAlong(), height: 90, follow: true }
    } else {
      const ball = this.active.state.ball
      const pin = Math.hypot(this.world.cup.x - ball.x, this.world.cup.z - ball.z)
      const span = Math.max(reach, pin, 30)
      // A linha inteira e o pin, entre o HUD de cima e o de baixo.
      this.aerial = {
        along: span * 0.5,
        height: Math.min(AERIAL.maxHeight, Math.max(AERIAL.minHeight, span * 1.6 + 60)),
        follow: false,
      }
    }
    if (this.aerialCam) return // Delete+0 com a vista aérea já aberta: só muda o alvo
    // De cima, sem névoa (nítido como no original; de tão alto, a névoa apagava o campo).
    this.course.setFog(false)
    // Molas começando no lugar certo; a passagem da câmera normal para cá é suave (0,45 s).
    const ball = this.restingBall()!
    const ground = this.world.grid.groundAt(ball.x, -ball.z)?.y ?? ball.y
    this.aerialCam = {
      yaw: new Smooth(this.aim, 0.15),
      along: new Smooth(this.aerial.along, 0.2),
      height: new Smooth(this.aerial.height, 0.2),
      ground: new Smooth(ground, 0.35),
    }
    const look = new Vector3()
    this.camera.getWorldDirection(look)
    this.aerialFrom = {
      position: this.camera.position.clone(),
      look: this.camera.position.clone().addScaledVector(look, 40),
      at: performance.now(),
    }
  }

  /** Bola do jogador da vez, parada (cena). */
  private restingBall(): Vector3 | undefined {
    const ball = this.active?.state.ball
    return ball && toScene(ball.x, ball.y, ball.z)
  }

  /** Ponto de queda (`ring`: força atual; `full`: 100%), girado para a mira `aim`. */
  private landingPoint(which: 'ring' | 'full', aim = this.aim): Vector3 | undefined {
    const ball = this.restingBall()
    if (!this.landing || !ball) return undefined
    const point = this.landing[which].clone().sub(ball)
    return point.applyAxisAngle(UP, aim - this.landing.aim).add(ball)
  }

  /**
   * Mira desenhada: na vista aérea, o giro suavizado da câmera — a linha, o X e o anel giram
   * junto com a câmera (sem pular na frente dela a cada toque de mira).
   */
  private shownAim() {
    return this.aerialCam?.yaw.value ?? this.aim
  }

  /**
   * Onde o Delete+0 fica (distância na linha da mira): no X; mas se o X passa do buraco, na
   * linha da mira na distância do buraco (o buraco projetado na linha), como no original.
   */
  private followAlong() {
    const reach = this.landingReach()
    const ball = this.active?.state.ball
    if (!ball) return reach
    const { cup } = this.world
    const hole = -Math.sin(this.aim) * (cup.x - ball.x) + Math.cos(this.aim) * (cup.z - ball.z)
    return hole > 0 && reach > hole ? hole : reach
  }

  /** Distância (unidades, no plano) da bola até o X (100%). */
  private landingReach() {
    const ball = this.restingBall()
    const full = this.landingPoint('full')
    return ball && full ? Math.hypot(full.x - ball.x, full.z - ball.z) : 0
  }

  /**
   * X desenhado: o ponto de queda a 100% visto da bola (ângulo em relação à mira e distância),
   * suavizado para os recálculos da física não darem pulo na tela.
   */
  private shownFull(): Vector3 | undefined {
    const ball = this.restingBall()
    const full = this.landingPoint('full')
    if (!ball || !full) return undefined
    const dx = full.x - ball.x
    const dz = full.z - ball.z
    let offset = Math.atan2(-dx, -dz) - this.aim
    offset = Math.atan2(Math.sin(offset), Math.cos(offset))
    const reach = Math.hypot(dx, dz)
    const { shownX } = this
    if (this.frameDt <= 0 || Math.abs(shownX.reach.value - reach) > yardsToUnits(40)) {
      shownX.offset.snap(offset)
      shownX.reach.snap(reach)
    }
    const angle = this.shownAim() + shownX.offset.update(offset, this.frameDt)
    const point = ball.addScaledVector(
      aimDirection(angle),
      shownX.reach.update(reach, this.frameDt),
    )
    point.y = this.world.grid.groundAt(point.x, -point.z)?.y ?? full.y
    return point
  }

  /** Recalcula os pontos de queda exatos (física) com a mira atual. */
  private refreshLanding() {
    if (!this.active) return
    const state = this.active.state
    const request = this.request()
    const ring = this.world.predictLanding(state, request)
    const full = this.world.predictLanding(state, { ...request, percent: 1 })
    this.landing = {
      aim: this.aim,
      at: performance.now(),
      ring: toScene(ring.x, ring.y, ring.z),
      full: toScene(full.x, full.y, full.z),
    }
  }

  /** Um toque de mira: passo fino (mais fino no green). Segurando, `frame` continua. */
  private nudgeAim(direction: 1 | -1) {
    if (this.phase !== 'aim' || !this.controllable || this.bar.active) return
    const step = this.greenGrid.visible ? AIM_TUNING.greenStep : AIM_TUNING.step
    this.aim += direction * step * DEG
    this.turnStart = performance.now()
    const model = this.active && this.ready.get(this.active.id)
    if (model?.root.visible) this.placeCharacter(model)
  }

  /** ↑/↓ e Shift+↑/↓ segurados na vista aérea: anda pela linha e zoom, suaves. */
  private moveAerial(dt: number, now: number) {
    const aerial = this.aerial
    if (!aerial) return
    const move = (this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('ArrowDown') ? 1 : 0)
    const shift = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
    if (move && shift) {
      aerial.height = Math.min(
        AERIAL.maxHeight,
        Math.max(AERIAL.minHeight, aerial.height * Math.exp(-move * AERIAL_ZOOM_RATE * dt)),
      )
    } else if (move) {
      aerial.follow = false
      const ball = this.active?.state.ball
      const pin = ball ? Math.hypot(this.world.cup.x - ball.x, this.world.cup.z - ball.z) : 0
      const limit = Math.max(this.landingReach(), pin) + yardsToUnits(60)
      const held = Math.min(1, (now - this.aerialMoveStart) / 1000 / AERIAL_PAN.rampSeconds)
      const speed = AERIAL_PAN.slow + (AERIAL_PAN.fast - AERIAL_PAN.slow) * held
      aerial.along = Math.min(
        limit,
        Math.max(-yardsToUnits(30), aerial.along + move * aerial.height * speed * dt),
      )
    }
    if (aerial.follow) aerial.along = this.followAlong()
  }

  /**
   * Desenhos por cima do jogo (ver COURSE_OVERLAY). A linha é recortada no plano da câmera:
   * mesmo com a bola atrás da câmera (zoom perto do X), o pedaço visível continua na tela.
   */
  private updateOverlay() {
    const camera = this.camera
    camera.updateMatrixWorld() // a posição deste quadro (senão o desenho fica um quadro atrás)
    const width = window.innerWidth
    const height = window.innerHeight
    const nearZ = -camera.near * 1.01
    const toView = (p: Vector3) => p.clone().applyMatrix4(camera.matrixWorldInverse)
    const toScreen = (v: Vector3) => {
      const n = v.clone().applyMatrix4(camera.projectionMatrix)
      return { x: ((n.x + 1) / 2) * width, y: ((1 - n.y) / 2) * height }
    }
    const point = (p: Vector3) => {
      const v = toView(p)
      return v.z < nearZ ? toScreen(v) : undefined
    }
    const $ = (selector: string) => this.drawings.querySelector(selector) as SVGElement
    const show = (el: SVGElement, on: boolean) => (el.style.display = on ? '' : 'none')
    const aiming = this.phase === 'aim' && !!this.active

    // Vista aérea: linha da bola até o X e a distância.
    const ball = this.restingBall()
    const full = this.aerial && aiming && this.controllable ? this.shownFull() : undefined
    const line = $('.aim-line')
    const mark = $('.x-mark')
    let segment: [{ x: number; y: number }, { x: number; y: number }] | undefined
    if (ball && full) {
      let a = toView(ball)
      let b = toView(full)
      if (a.z < nearZ || b.z < nearZ) {
        if (a.z >= nearZ) a = a.clone().lerp(b, (a.z - nearZ) / (a.z - b.z))
        if (b.z >= nearZ) b = b.clone().lerp(a, (b.z - nearZ) / (b.z - a.z))
        segment = [toScreen(a), toScreen(b)]
      }
    }
    show(line, !!segment)
    if (segment) {
      line.setAttribute('x1', String(segment[0].x))
      line.setAttribute('y1', String(segment[0].y))
      line.setAttribute('x2', String(segment[1].x))
      line.setAttribute('y2', String(segment[1].y))
    }
    const x = full && point(full)
    show(mark, !!x)
    if (x) {
      mark.setAttribute('transform', `translate(${x.x} ${x.y})`)
      $('.x-label').textContent = `${unitsToYards(this.landingReach()).toFixed(2)}y`
    }

    // Pin: no topo da luz da cova (câmera normal) ou na cova (vista aérea).
    const cup = this.world.cup
    const anchor = toScene(cup.x, cup.y + (this.aerial ? 0 : BEAM_HEIGHT), cup.z)
    const pin = aiming ? point(anchor) : undefined
    const pinMark = $('.pin-mark')
    show(pinMark, !!pin)
    if (pin) {
      pinMark.setAttribute('transform', `translate(${pin.x} ${pin.y})`)
      const state = this.active!.state
      const rise = unitsToMeters(cup.y - state.ball.y)
      $('.pin-height').textContent = `${rise.toFixed(2)} m`
      $('.pin-distance').textContent = `${this.world.distanceToPin(state.ball).toFixed(2)}y`
    }
  }

  /**
   * A luz da cova engrossa com a distância, para ter sempre uns 6 px na tela (de longe ela
   * some de tão fina). Na vista aérea some: lá o pin é o marcador desenhado.
   */
  private fitBeam() {
    this.beam.visible = !this.aerial
    if (!this.beam.visible) return
    const at = this.beam.position
    const distance = Math.hypot(this.camera.position.x - at.x, this.camera.position.z - at.z)
    const pixelsPerUnit =
      window.innerHeight / 2 / Math.tan((this.camera.fov * DEG) / 2) / Math.max(distance, 1)
    const scale = Math.max(1, BEAM_MIN_PIXELS / 2 / pixelsPerUnit / BEAM_RADIUS)
    this.beam.scale.set(scale, 1, scale)
  }

  /**
   * Tecla G (só sozinho): calculadora. Acha a mira e a força para a bola cair direto na cova
   * (tacada normal, impacto perfeito) com o vento e o desnível de agora, e já deixa tudo
   * pronto: mira, taco (se o escolhido não alcança), bola no centro e o calibrador na força
   * — com o sempre PANGYA (P), é só dar os 2 toques de espaço.
   */
  private runCalculator() {
    if (this.phase !== 'aim' || !this.controllable || !this.active || this.bar.active) return
    const state = this.active.state
    const current = this.panel.read()
    const result = solveShot(this.world, state, this.wind, {
      club: current.club,
      powerShot: current.powerShot,
      power: this.active.power ?? DEFAULT_POWER,
    })
    if ('reason' in result) {
      const clubName = result.club === 'PT1' ? 'PT' : result.club
      this.panel.showResult(
        result.reason === 'putter'
          ? '🧮 Calculadora: no green ainda não calcula (só tacadas no ar).'
          : result.reason === 'outOfReach'
            ? `🧮 Não alcança nem com o ${clubName}: faltam ${result.shortBy!.toFixed(1)}y (power shot?).`
            : result.reason === 'obstacle'
              ? `🧮 Obstáculo no caminho a ${result.obstacleAt!.toFixed(1)}y (C mostra as caixas).`
              : '🧮 Não achei uma tacada que caia na cova daqui.',
      )
      return
    }
    this.panel.setClub(result.club)
    this.panel.setImpact(0, 0)
    this.panel.setPercent(result.percent)
    this.bar.setCalibratorValue(result.percent)
    const pinAim = this.world.aimAtPin(state.ball)
    this.aim = result.aim
    this.targetDirty = true
    const model = this.ready.get(this.active.id)
    if (model?.root.visible) void this.address(model)
    const offset = (result.aim - pinAim) / DEG
    const pin = this.world.distanceToPin(state.ball)
    const side =
      Math.abs(offset) < 0.005
        ? 'mira no pin'
        : `mira ${Math.abs(offset).toFixed(2)}° (${(pin * Math.tan(Math.abs(offset) * DEG)).toFixed(1)}y) à ${offset > 0 ? 'esquerda' : 'direita'} do pin`
    const yards = (result.percent * this.world.shotRange(state, this.request())).toFixed(1)
    const clubName = result.club === 'PT1' ? 'PT' : result.club
    this.panel.showResult(
      `🧮 ${clubName} · força ${(result.percent * 100).toFixed(2).replace('.', ',')}% (${yards}y) · ${side}` +
        (result.holed ? ' · entra de dunk' : ` · cai a ${result.miss.toFixed(2)}y do pin`) +
        (this.autoPangya ? '' : ' · acerte o PANGYA (ou P)'),
    )
  }

  /** Tecla P (só sozinho): impacto sempre PANGYA, para testar a física. */
  private setAutoPangya(on: boolean, announce = true) {
    this.autoPangya = on
    saveAutoPangya(on)
    this.bar.setAutoPangya(on)
    if (announce) {
      this.panel.showResult(on ? '✨ Sempre PANGYA ligado (P)' : 'Sempre PANGYA desligado (P)')
    }
  }

  private fire(request: ShotRequest) {
    this.phase = 'idle'
    this.panel.setEnabled(false, 'Batendo…')
    this.onShoot(request)
  }

  /**
   * Anima a trajetória da bola de `playerId`, tocando os sons da linha do tempo;
   * `delay` (s) segura a bola parada antes de sair (tempo do swing). Resolve quando ela para.
   */
  animateShot(
    playerId: string,
    frames: Float32Array,
    options: { aim?: number; events?: ShotEvent[]; impact?: number; club?: string } = {},
  ): Promise<void> {
    const { aim, events = [], impact, club } = options
    this.flight?.done()
    // A bola só sai quando o taco acerta (meio do swing do personagem).
    const delay = this.startSwing(playerId, club)
    this.phase = 'flying'
    this.shotForward = aimDirection(aim ?? this.aim)
    this.target.visible = false
    this.greenGrid.visible = false
    this.panel.setEnabled(false, 'Espaço: pular animação')
    const player = this.players.find((p) => p.id === playerId)
    if (player) this.ballOf(player, this.players.length > 1)
    this.flightYaw = 0
    this.flightTop = false
    return new Promise((resolve) => {
      this.flight = {
        playerId,
        frames,
        start: performance.now() + delay * 1000,
        done: resolve,
        events,
        fired: 0,
        impact,
        landing: this.landingIndex(frames),
        index: 0,
      }
    })
  }

  /** Primeiro quadro, depois do ponto mais alto, em que a bola chega ao chão. */
  private landingIndex(frames: Float32Array) {
    const count = frames.length / 3
    let apex = 0
    for (let i = 1; i < count; i++) if (frames[i * 3 + 1]! > frames[apex * 3 + 1]!) apex = i
    for (let i = apex; i < count; i++) {
      const ground = this.world.grid.groundAt(frames[i * 3]!, frames[i * 3 + 2]!)?.y
      if (ground !== undefined && frames[i * 3 + 1]! - ground <= 0.5) return i
    }
    return count - 1
  }

  /** A câmera livre do voo vale até pouco antes de a bola cair. */
  private freeFlightCamera() {
    const f = this.flight
    if (!f || f.start === -Infinity) return false
    return f.index < f.landing - FREE_CAMERA_UNTIL_LANDING / STEP_TIME
  }

  showResult(text: string) {
    this.panel.showResult(text)
  }

  /** Som de cada piso, do property.xml (bound_sound / roll_sound). */
  private surfaceSound(kind: string | undefined, which: 'boundSound' | 'rollSound') {
    return this.world.data.collision.surfaces.find((s) => s.kind === kind)?.[which] || undefined
  }

  /** Toca os eventos da linha do tempo até o quadro `index` (pulando: só o final). */
  private playEvents(index: number, skipped: boolean) {
    const flight = this.flight!
    while (flight.fired < flight.events.length && flight.events[flight.fired]!.frame <= index) {
      const e = flight.events[flight.fired++]!
      const last = flight.fired === flight.events.length
      if (skipped && !last && e.type !== 'hit') continue
      const sound: Partial<Record<ShotEvent['type'], [SynthSound, (string | undefined)?]>> = {
        hit: [
          flight.impact === undefined || isPangya(flight.impact)
            ? 'pangya'
            : Math.abs(flight.impact) > 1
              ? 'miss'
              : 'hit',
        ],
        bounce: ['bounce', this.surfaceSound(e.surface, 'boundSound')],
        roll: ['roll', this.surfaceSound(e.surface, 'rollSound')],
        obstacle: ['wood'],
        water: ['water'],
        hole: ['cup'],
      }
      const play = sound[e.type]
      if (play) void this.sounds.play(play[0], play[1])
    }
  }

  updateHud() {
    const p = this.active
    if (!p) {
      this.hud.innerHTML = `<strong>Buraco ${this.world.data.ref.hole}</strong> · Par ${this.world.par}${this.hudExtra ? '<br>' + this.hudExtra : ''}`
      return
    }
    const state = p.state
    const kind = this.world.lieKind(state)
    const label = SURFACE_LABELS[kind as SurfaceKind] ?? kind
    const lie = state.lie === 'tee' ? undefined : this.world.surfaceAt(state.ball.x, state.ball.z)
    // Força do piso já sorteada quando a bola parou (a tacada usa ela); senão, a faixa.
    const power =
      state.liePower !== undefined && state.lie !== 'tee'
        ? ` ${state.liePower}%`
        : lie
          ? ` (${lie.power.min}–${lie.power.max}%)`
          : ''
    const rise = unitsToMeters(this.world.cup.y - state.ball.y)
    const who = this.players.length > 1 ? `<strong>${p.name}</strong> · ` : ''
    this.hud.innerHTML =
      who +
      `<strong>Buraco ${this.world.data.ref.hole}</strong> · Par ${this.world.par} · ` +
      `Tacada ${state.strokes + 1}` +
      (state.penalties ? ` (${state.penalties} de penalidade)` : '') +
      ` · <strong>${this.world.distanceToPin(state.ball).toFixed(1)}y</strong> até o pin` +
      ` (${rise >= 0 ? '↑' : '↓'} ${Math.abs(rise).toFixed(2)} m) · Piso: ${label}${power}` +
      (this.hudExtra ? `<br>${this.hudExtra}` : '')
  }

  /** Anel amarelo onde a tacada cai com a força atual (girando junto com a mira). */
  private placeTarget() {
    const ring = this.landingPoint('ring', this.shownAim())
    if (ring) this.target.position.copy(ring).setY(ring.y + 0.3)
  }

  private placeCamera(focus: Vector3, lerp: number) {
    const { camera, world } = this
    const ball = this.restingBall()
    if (this.aerial && this.aerialCam && ball) {
      // De cima, com a linha da mira subindo na tela (a bola embaixo, o X em cima). Giro,
      // posição na linha, altura e chão seguem molas: sem trancos nos toques nem nos
      // recálculos.
      const cam = this.aerialCam
      const dt = this.frameDt
      const forward = aimDirection(cam.yaw.update(this.aim, dt))
      const along = cam.along.update(this.aerial.along, dt)
      const height = cam.height.update(this.aerial.height, dt)
      const center = ball.clone().addScaledVector(forward, along)
      const ground = world.grid.groundAt(center.x, -center.z)?.y ?? ball.y
      center.y = cam.ground.update(ground, dt)
      const position = center
        .clone()
        .add(new Vector3(0, height, 0))
        .addScaledVector(forward, -height * 0.12)
      let look = center
      const from = this.aerialFrom
      if (from) {
        const t = Math.min(1, (performance.now() - from.at) / 450)
        const k = t * t * (3 - 2 * t)
        position.copy(from.position.clone().lerp(position, k))
        look = from.look.clone().lerp(center, k)
        if (t >= 1) this.aerialFrom = undefined
      }
      camera.position.copy(position)
      camera.lookAt(look)
      return
    }
    let forward = this.phase === 'flying' ? this.shotForward : aimDirection(this.aim)
    const putting = this.phase === 'aim' && this.greenGrid.visible
    const free = this.phase === 'flying' && this.freeFlightCamera()
    if (free) forward = forward.clone().applyAxisAngle(UP, this.flightYaw)
    if (free && this.flightTop) {
      // Vista de cima da bola em voo (S).
      this.moveCamera(
        focus,
        focus
          .clone()
          .add(new Vector3(0, 70, 0))
          .addScaledVector(forward, -6),
        0.12,
      )
      camera.lookAt(focus)
      return
    }
    // Mirando: perto, atrás do jogador; voando: mais longe para acompanhar a bola.
    const flying = this.phase === 'flying'
    const back = putting ? 18 : flying ? 55 : 22
    const up = putting ? 9 : flying ? 20 : 8
    const desired = focus
      .clone()
      .addScaledVector(forward, -back)
      .add(new Vector3(0, up, 0))
    this.moveCamera(focus, desired, lerp)
    camera.lookAt(focus.clone().addScaledVector(forward, putting ? 25 : flying ? 60 : 40))
  }

  /**
   * Desliza a câmera até `desired`. As proteções valem para a posição real de cada quadro
   * (deslizando, a câmera poderia atravessar paredes do terreno).
   */
  private moveCamera(focus: Vector3, desired: Vector3, lerp: number) {
    // `lerp` é por quadro a 60 quadros/s; convertido para o tempo do quadro de verdade.
    const next = this.camera.position.clone().lerp(desired, lerpFactor(lerp, this.frameDt))
    const toCamera = next.clone().sub(focus)
    const distance = toCamera.length()
    if (distance > 0.001) {
      this.ray.set(focus, toCamera.normalize())
      this.ray.far = distance
      const hit = this.ray.intersectObjects(this.course.terrainMeshes, false)[0]
      if (hit) next.copy(focus).addScaledVector(toCamera, Math.max(4, hit.distance - 4))
    }
    const below = this.world.grid.groundAt(next.x, -next.z)
    if (below && next.y < below.y + 6) next.y = below.y + 6
    this.camera.position.copy(next)
  }

  private frameAt(frames: Float32Array, i: number) {
    return toScene(frames[i * 3]!, frames[i * 3 + 1]! + BALL_RADIUS, frames[i * 3 + 2]!)
  }

  private frame(now: number, dt: number) {
    this.frameDt = dt
    if (this.flight) {
      const { frames, playerId } = this.flight
      const count = frames.length / 3
      const skipped = this.flight.start === -Infinity
      const elapsed = (now - this.flight.start) / 1000
      const index = Math.max(0, Math.min(Math.floor(elapsed / STEP_TIME), count - 1))
      if (elapsed >= 0) this.playEvents(index, skipped)
      this.flight.index = index
      // Câmera livre do voo: A/D giram em volta da bola; perto de cair, volta ao normal.
      if (this.freeFlightCamera()) {
        const spin =
          (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) -
          (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0)
        this.flightYaw += spin * dt * 1.6
      } else {
        this.flightYaw *= 0.9
        this.flightTop = false
      }
      this.placeBall(playerId, this.frameAt(frames, index))
      const shown = Math.min(index + 1, MAX_TRAIL)
      for (let i = 0; i < shown; i++) {
        const p = this.frameAt(frames, i)
        this.trailPositions.setXYZ(i, p.x, p.y, p.z)
      }
      this.trailPositions.needsUpdate = true
      this.trailGeometry.setDrawRange(0, shown)
      if (!this.debugFreeze) this.placeCamera(this.ballPosition(), 0.08)
      if (index === count - 1) {
        const { done } = this.flight
        this.flight = undefined
        this.phase = 'idle'
        done()
      }
    } else if (this.phase === 'aim') {
      // Mira só antes de começar a barra: um toque = passo fino (nudgeAim); segurando, gira
      // sozinha cada vez mais rápido. O passo por quadro é limitado (sem pulos se o PC
      // engasgar).
      let turn = 0
      for (const [key, direction] of Object.entries(AIM_KEYS)) {
        if (this.keys.has(key)) turn = direction
      }
      if (!this.controllable || this.bar.active) turn = 0
      const model = this.active && this.ready.get(this.active.id)
      const held = (now - this.turnStart) / 1000 - AIM_TUNING.holdDelay
      if (turn && held > 0) {
        const [slow, fast] = this.greenGrid.visible ? AIM_TUNING.greenSpeed : AIM_TUNING.speed
        const speed = slow! + (fast! - slow!) * Math.min(1, held / AIM_TUNING.rampSeconds)
        this.aim += turn * speed * DEG * Math.min(dt, 1 / 30)
        if (model?.root.visible) this.placeCharacter(model)
      }
      // Andando de lado enquanto gira a mira; parado, volta à preparação.
      if (model?.root.visible && !this.bar.active && Boolean(turn) !== this.walking) {
        this.walking = Boolean(turn)
        const walk = this.golf(model).walk
        if (this.walking && walk) model.play(walk, true, 0.1)
        else this.idle(model)
      }
      if (this.targetDirty) {
        this.targetDirty = false
        this.updateBarScale()
        if (this.controllable) this.refreshLanding()
      } else if (
        this.controllable &&
        this.landing &&
        this.landing.aim !== this.aim &&
        (!turn || now - this.landing.at > LANDING_REFRESH * 1000)
      ) {
        this.refreshLanding() // mira girou: recálculo exato (no máximo a cada 0,12 s)
      }
      this.updateWind()
      this.target.visible = this.controllable
      this.moveAerial(dt, now)
      this.placeCamera(this.ballPosition(), 0.12)
      this.placeTarget() // depois da câmera: na vista aérea usa o giro dela deste quadro
    } else if (!this.debugFreeze) {
      this.placeCamera(this.ballPosition(), 0.08)
    }
    for (const model of this.ready.values()) if (model.root.visible) model.update(dt)
    this.updateOverlay()
    this.beamMaterial.opacity = 0.4 + 0.08 * Math.sin(now / 300)
    this.fitBeam()
    this.course.update(this.camera)
    this.renderer.render(this.scene, this.camera)
  }

  /** Mostra um quadro no centro da tela (fim do buraco/partida). */
  overlay(html: string) {
    const box = document.createElement('div')
    box.className = 'hole-end'
    box.innerHTML = html
    document.body.appendChild(box)
    this.elements.push(box)
    return box
  }

  dispose() {
    this.flight?.done()
    this.flight = undefined
    this.renderer.setAnimationLoop(null)
    this.renderer.dispose()
    for (const cleanup of this.cleanups) cleanup()
    for (const el of this.elements) el.remove()
  }
}

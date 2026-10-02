import {
  HoleWorld,
  isPangya,
  loadHoleData,
  type ShotEvent,
  type HoleRef,
  type HoleState,
  type ShotRequest,
} from '@pangya/game'
import type { SurfaceKind } from '@pangya/formats'
import { STEP_TIME, unitsToYards, type Wind } from '@pangya/physics'
import {
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
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
import {
  CHARACTER_TUNING,
  CharacterModel,
  loadCatalog,
  type CharacterEntry,
} from '../character/character.ts'
import { createShotPanel, type ShotPanel } from '../shot-panel.ts'
import { browserFiles } from './assets.ts'
import { aimDirection, toScene } from './coords.ts'
import { buildCourseScene, SKY_RADIUS, type CourseScene } from './course-scene.ts'
import { buildGreenGrid } from './green-grid.ts'
import { createPowerBar, type PowerBar } from './power-bar.ts'
import { SURFACE_LABELS } from './surface-colors.ts'
import { TextureLibrary } from './textures.ts'

/** Raio da bola na tela (unidades). Maior que o real (0,07) para ser vista, como no jogo. */
const BALL_RADIUS = 0.2
const MAX_TRAIL = 4000
/** Raio da cova desenhada (unidades); a captura da física usa GROUND_TUNING.cupRadius. */
const CUP_RADIUS = 0.45
/** Altura da bandeira do pin (unidades; ~2,5 jardas). */
const FLAG_HEIGHT = 8

export interface ViewPlayer {
  id: string
  name: string
  color: number
  state: HoleState
  /** Personagem (id do catálogo); sem ele, só a bola. */
  character?: string | undefined
}

/** Movimentos procurados pelo nome no .apet (nomes reais a confirmar com o cliente). */
const IDLE_MOTIONS = [/^(stand|idle|wait|ready|address)/i, /stand|idle|wait|ready/i]
const SWING_MOTIONS: Record<string, RegExp[]> = {
  wood: [/dr|wood|1w|driver/i],
  iron: [/iron|ir\b|_i\d/i],
  wedge: [/ap|approach|pw|sw|wedge/i],
  putter: [/put|pt/i],
}
const ANY_SWING = [/swing|shot/i]

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
  readonly panel: ShotPanel
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
  private wind: Wind = { speed: 0, degree: 0 }

  private players: ViewPlayer[] = []
  private active: ViewPlayer | undefined
  private controllable = false
  private phase: 'aim' | 'flying' | 'idle' = 'idle'
  private aim = 0
  private shotForward = aimDirection(0)
  private targetDirty = true
  private readyAt = 0
  private aerial = false
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
      }
    | undefined
  readonly sounds: SoundLibrary
  private readonly characters = new Map<string, Promise<CharacterModel | undefined>>()
  private readonly ready = new Map<string, CharacterModel>()
  /** Movimento escolhido com a tecla N (depuração). */
  private motionIndex = -1

  /** Chamado quando o jogador da vez bate (espaço ou botão). */
  onShoot: (request: ShotRequest) => void = () => {}

  private constructor(
    world: HoleWorld,
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
    scene: Scene,
    course: CourseScene,
    status: HTMLElement,
    options: { lockWind: boolean; title: string },
  ) {
    this.world = world
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

    // Cova (disco escuro com borda, deitado na inclinação do green) e bandeira do pin.
    const cupHit = world.grid.groundAt(world.cup.x, world.cup.z)
    const [nx, ny, nz] = cupHit ? world.grid.normalOf(cupHit.triangle) : [0, 1, 0]
    const cup = new Group()
    const hole = new Mesh(
      new CircleGeometry(CUP_RADIUS, 24),
      new MeshBasicMaterial({ color: 0x0a0a0a, polygonOffset: true, polygonOffsetFactor: -4 }),
    )
    const rim = new Mesh(
      new RingGeometry(CUP_RADIUS, CUP_RADIUS * 1.18, 24),
      new MeshBasicMaterial({ color: 0xf5f5f5, polygonOffset: true, polygonOffsetFactor: -4 }),
    )
    hole.rotation.x = rim.rotation.x = -Math.PI / 2
    cup.add(hole, rim)
    cup.position.copy(toScene(world.cup.x, world.cup.y + 0.02, world.cup.z))
    cup.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(nx, ny, -nz).normalize())
    scene.add(cup)
    const flag = new Group()
    const pole = new Mesh(
      new CylinderGeometry(0.06, 0.06, FLAG_HEIGHT),
      new MeshLambertMaterial({ color: 0xffffff, emissive: 0x555555 }),
    )
    pole.position.y = FLAG_HEIGHT / 2
    const cloth = new Mesh(
      new PlaneGeometry(2.4, 1.6),
      new MeshLambertMaterial({ color: 0xe53935, emissive: 0x551111, side: DoubleSide }),
    )
    cloth.position.set(1.2, FLAG_HEIGHT - 0.9, 0)
    flag.add(pole, cloth)
    flag.position.copy(toScene(world.cup.x, world.cup.y, world.cup.z))
    scene.add(flag)

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

    this.panel = createShotPanel(() => this.shoot(), {
      title: options.title,
      putter: true,
      lockWind: options.lockWind,
    })
    this.cleanups.push(() => this.panel.dispose())
    this.bar = createPowerBar()
    this.cleanups.push(() => this.bar.dispose())
    this.windBox = document.createElement('div')
    this.windBox.className = 'wind'
    this.windBox.innerHTML = '<div><div class="arrow">↑</div><div class="speed">0 m</div></div>'
    document.body.appendChild(this.windBox)
    this.elements.push(this.windBox)
    this.panel.onChange(() => {
      this.targetDirty = true
      const model = this.active && this.ready.get(this.active.id)
      if (model?.root.visible) this.equipClub(model)
    })

    this.listen(window, 'keydown', (e) => {
      const key = (e as KeyboardEvent).code
      if (key === 'KeyM') this.aerial = !this.aerial
      if (key === 'KeyT') this.course.setSurfaceView((this.surfaceView = !this.surfaceView))
      if (key === 'KeyF') this.course.setFog((this.fogOn = !this.fogOn))
      if (key === 'KeyC') this.boxLines.visible = !this.boxLines.visible
      if (key === 'KeyN') this.cycleMotion()
      if (key === 'KeyV') {
        this.panel.showResult(
          this.sounds.toggleMute() ? '🔇 som desligado (V)' : '🔊 som ligado (V)',
        )
      }
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        e.preventDefault()
        this.keys.add(key)
      }
    })
    this.listen(window, 'keyup', (e) => this.keys.delete((e as KeyboardEvent).code))
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

    // Depuração (testes automatizados).
    ;(window as unknown as { __debug: () => unknown }).__debug = () => ({
      camera: camera.position.toArray().map((v) => Math.round(v)),
      phase: this.phase,
      aim: this.aim,
      active: this.active?.id,
      players: this.players.map((p) => ({ id: p.id, state: p.state })),
    })
  }

  private listen(target: EventTarget, type: string, handler: (e: Event) => void) {
    target.addEventListener(type, handler)
    this.cleanups.push(() => target.removeEventListener(type, handler))
  }

  /** Carrega o buraco e monta a cena (com progresso no canto da tela). */
  static async create(ref: HoleRef, options: { lockWind?: boolean } = {}): Promise<HoleView> {
    const status = document.createElement('div')
    status.className = 'hole-status'
    status.textContent = 'Carregando buraco…'
    document.body.appendChild(status)
    try {
      const renderer = new WebGLRenderer({ antialias: true })
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
        title: `${ref.prefix} — buraco ${ref.hole}`,
      })
      status.textContent =
        `${world.grid.triangleCount} triângulos · ${data.objects.length} modelos` +
        (data.missingModels.length ? ` (${data.missingModels.length} faltando)` : '') +
        ` · ${course.texturesLoaded} texturas` +
        (course.texturesMissing.length ? ` (${course.texturesMissing.length} faltando)` : '') +
        ` · ${world.obstacles.size} caixas de colisão (${data.obstacleSource})` +
        ' · ←→ mirar · espaço bater · M aérea · T pisos · F névoa · C colisão'
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
    this.panel.setWind(wind.speed, wind.degree)
    this.updateWind()
  }

  /** Seta do vento relativa à mira (para cima = a favor da tacada). */
  private updateWind() {
    const wind = this.panel.read().wind ?? this.wind
    const relative = wind.degree - (this.aim * 180) / Math.PI
    const arrow = this.windBox.querySelector('.arrow') as HTMLElement
    arrow.style.transform = `rotate(${-relative}deg)`
    ;(this.windBox.querySelector('.speed') as HTMLElement).textContent = `${wind.speed} m`
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
      this.aim = this.world.aimAtPin(state.ball)
      if (this.controllable) {
        const { club, percent } = this.world.suggestClub(state)
        this.panel.setClub(club)
        this.panel.setPercent(percent)
      }
      this.trailGeometry.setDrawRange(0, 0)
    }
    this.panel.setEnabled(
      this.controllable,
      this.controllable ? 'Bater (espaço)' : `Vez de ${this.active.name}…`,
    )
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
            m.play(m.findMotion(...IDLE_MOTIONS) ?? m.motionNames[0])
            console.info(`personagem ${m.entry.name}: movimentos`, m.motionNames)
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
      this.equipClub(model)
    })
  }

  private placeCharacter(model: CharacterModel) {
    const ball = this.ballPosition()
    const forward = aimDirection(this.aim)
    // Destro: de frente para a bola, com o alvo à esquerda.
    const right = new Vector3(-forward.z, 0, forward.x)
    const at = ball.clone().addScaledVector(right, -CHARACTER_TUNING.ballDistance)
    at.y = (this.world.grid.groundAt(at.x, -at.z)?.y ?? ball.y - BALL_RADIUS) + 0
    model.root.position.copy(at)
    model.root.rotation.y =
      Math.atan2(-right.x, -right.z) + (CHARACTER_TUNING.facingDegrees * Math.PI) / 180
  }

  /** Põe na mão o taco escolhido no painel (modelo da tabela de tacos do jogo). */
  private equipClub(model: CharacterModel, club: string = this.panel.read().club) {
    void clubModelFor(categoryOfClub(club)).then((path) => model.setClub(path))
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

  /** Começa o swing do personagem; devolve quanto falta (s) até o taco acertar a bola. */
  private startSwing(playerId: string, club: string | undefined): number {
    const model = this.ready.get(playerId)
    if (!model || !model.root.visible) return 0
    const category =
      club === undefined
        ? ''
        : club.startsWith('PT')
          ? 'putter'
          : /W$/.test(club)
            ? 'wood'
            : /^(PW|SW)$/.test(club)
              ? 'wedge'
              : 'iron'
    const swing = model.findMotion(...(SWING_MOTIONS[category] ?? []), ...ANY_SWING)
    if (!swing) return 0
    if (club) this.equipClub(model, club)
    const duration = model.play(swing, false, 0.1)
    setTimeout(() => model.play(model.findMotion(...IDLE_MOTIONS) ?? swing), duration * 1000)
    return duration * CHARACTER_TUNING.impactAt
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
      shot: input.shot ?? 'dunk',
      powerShot: input.powerShot ?? 'none',
      spin: input.spin ?? 0,
      curve: input.curve ?? 0,
      aim: this.aim,
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
    if (!this.panel.usesBar()) {
      this.fire(this.request())
      return
    }
    if (this.bar.active) {
      this.bar.press()
      return
    }
    this.bar.start(({ percent, impact }) => {
      this.panel.setPercent(percent)
      this.fire({ ...this.request(), percent, impact })
    })
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
    return new Promise((resolve) => {
      this.flight = {
        playerId,
        frames,
        start: performance.now() + delay * 1000,
        done: resolve,
        events,
        fired: 0,
        impact,
      }
    })
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
    const power = lie ? ` (${lie.power.min}–${lie.power.max}%)` : ''
    const rise = unitsToYards(this.world.cup.y - state.ball.y)
    const who = this.players.length > 1 ? `<strong>${p.name}</strong> · ` : ''
    this.hud.innerHTML =
      who +
      `<strong>Buraco ${this.world.data.ref.hole}</strong> · Par ${this.world.par} · ` +
      `Tacada ${state.strokes + 1}` +
      (state.penalties ? ` (${state.penalties} de penalidade)` : '') +
      ` · <strong>${this.world.distanceToPin(state.ball).toFixed(1)}y</strong> até o pin` +
      ` (${rise >= 0 ? '↑' : '↓'} ${Math.abs(rise).toFixed(2)}y) · Piso: ${label}${power}` +
      (this.hudExtra ? `<br>${this.hudExtra}` : '')
  }

  private updateTarget() {
    this.targetDirty = false
    if (!this.active) return
    const p = this.world.predictLanding(this.active.state, this.request())
    this.target.position.copy(toScene(p.x, p.y + 0.3, p.z))
  }

  private placeCamera(focus: Vector3, lerp: number) {
    const { camera, world } = this
    if (this.aerial) {
      const tee = toScene(world.tee.x, 0, world.tee.z)
      const pin = toScene(world.cup.x, 0, world.cup.z)
      const middle = tee.clone().add(pin).multiplyScalar(0.5)
      const forward = pin.clone().sub(tee).normalize()
      camera.position.lerp(
        middle
          .clone()
          .add(new Vector3(0, 1100, 0))
          .addScaledVector(forward, -350),
        lerp,
      )
      camera.lookAt(middle)
      return
    }
    const forward = this.phase === 'flying' ? this.shotForward : aimDirection(this.aim)
    const putting = this.phase === 'aim' && this.greenGrid.visible
    // Mirando: perto, atrás do jogador; voando: mais longe para acompanhar a bola.
    const flying = this.phase === 'flying'
    const back = putting ? 18 : flying ? 55 : 22
    const up = putting ? 9 : flying ? 20 : 8
    const desired = focus
      .clone()
      .addScaledVector(forward, -back)
      .add(new Vector3(0, up, 0))
    // As proteções valem para a posição real de cada quadro (deslizando, a câmera
    // poderia atravessar paredes do terreno).
    const next = camera.position.clone().lerp(desired, lerp)
    const toCamera = next.clone().sub(focus)
    const distance = toCamera.length()
    if (distance > 0.001) {
      this.ray.set(focus, toCamera.normalize())
      this.ray.far = distance
      const hit = this.ray.intersectObjects(this.course.terrainMeshes, false)[0]
      if (hit) next.copy(focus).addScaledVector(toCamera, Math.max(4, hit.distance - 4))
    }
    const below = world.grid.groundAt(next.x, -next.z)
    if (below && next.y < below.y + 6) next.y = below.y + 6
    camera.position.copy(next)
    camera.lookAt(focus.clone().addScaledVector(forward, putting ? 25 : flying ? 60 : 40))
  }

  private frameAt(frames: Float32Array, i: number) {
    return toScene(frames[i * 3]!, frames[i * 3 + 1]! + BALL_RADIUS, frames[i * 3 + 2]!)
  }

  private frame(now: number, dt: number) {
    if (this.flight) {
      const { frames, playerId } = this.flight
      const count = frames.length / 3
      const skipped = this.flight.start === -Infinity
      const elapsed = (now - this.flight.start) / 1000
      const index = Math.max(0, Math.min(Math.floor(elapsed / STEP_TIME), count - 1))
      if (elapsed >= 0) this.playEvents(index, skipped)
      this.placeBall(playerId, this.frameAt(frames, index))
      const shown = Math.min(index + 1, MAX_TRAIL)
      for (let i = 0; i < shown; i++) {
        const p = this.frameAt(frames, i)
        this.trailPositions.setXYZ(i, p.x, p.y, p.z)
      }
      this.trailPositions.needsUpdate = true
      this.trailGeometry.setDrawRange(0, shown)
      this.placeCamera(this.ballPosition(), 0.08)
      if (index === count - 1) {
        const { done } = this.flight
        this.flight = undefined
        this.phase = 'idle'
        done()
      }
    } else if (this.phase === 'aim') {
      // Mira só antes de começar a barra.
      const turn =
        this.controllable && !this.bar.active
          ? (this.keys.has('ArrowLeft') ? 1 : 0) - (this.keys.has('ArrowRight') ? 1 : 0)
          : 0
      if (turn) {
        this.aim += turn * dt * (this.greenGrid.visible ? 0.25 : 0.6)
        this.targetDirty = true
        const model = this.active && this.ready.get(this.active.id)
        if (model?.root.visible) this.placeCharacter(model)
      }
      if (this.targetDirty) this.updateWind()
      if (this.controllable && this.targetDirty) this.updateTarget()
      this.target.visible = this.controllable
      this.placeCamera(this.ballPosition(), turn ? 0.3 : 0.08)
    } else {
      this.placeCamera(this.ballPosition(), 0.08)
    }
    for (const model of this.ready.values()) if (model.root.visible) model.update(dt)
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

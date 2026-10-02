import {
  HoleWorld,
  loadHoleData,
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
import { createShotPanel, type ShotPanel } from '../shot-panel.ts'
import { browserFiles } from './assets.ts'
import { aimDirection, toScene } from './coords.ts'
import { buildCourseScene, SKY_RADIUS, type CourseScene } from './course-scene.ts'
import { buildGreenGrid } from './green-grid.ts'
import { SURFACE_LABELS } from './surface-colors.ts'
import { TextureLibrary } from './textures.ts'

const BALL_RADIUS = 1.6
const MAX_TRAIL = 4000

export interface ViewPlayer {
  id: string
  name: string
  color: number
  state: HoleState
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
    { playerId: string; frames: Float32Array; start: number; done: () => void } | undefined

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

    // Tee e bandeira.
    const tee = new Mesh(
      new RingGeometry(3.5, 4.5, 24),
      new MeshBasicMaterial({ color: 0x1e88e5, side: DoubleSide }),
    )
    tee.rotation.x = -Math.PI / 2
    tee.position.copy(toScene(world.tee.x, world.tee.y + 0.2, world.tee.z))
    scene.add(tee)
    const flag = new Group()
    const pole = new Mesh(
      new CylinderGeometry(0.4, 0.4, 30),
      new MeshLambertMaterial({ color: 0xffffff }),
    )
    pole.position.y = 15
    const cloth = new Mesh(
      new PlaneGeometry(10, 6),
      new MeshLambertMaterial({ color: 0xe53935, side: DoubleSide }),
    )
    cloth.position.set(5, 26, 0)
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
    this.panel.onChange(() => {
      this.targetDirty = true
    })

    this.listen(window, 'keydown', (e) => {
      const key = (e as KeyboardEvent).code
      if (key === 'KeyM') this.aerial = !this.aerial
      if (key === 'KeyT') this.course.setSurfaceView((this.surfaceView = !this.surfaceView))
      if (key === 'KeyF') this.course.setFog((this.fogOn = !this.fogOn))
      if (key === 'KeyC') this.boxLines.visible = !this.boxLines.visible
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
    this.panel.setWind(wind.speed, wind.degree)
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
    entry.tag?.position.copy(position).add(new Vector3(0, 7, 0))
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
      this.panel.setEnabled(false, 'Fim do buraco')
      this.target.visible = false
      this.greenGrid.visible = false
      this.updateHud()
      return
    }
    this.phase = 'aim'
    this.readyAt = performance.now()
    const state = this.active.state
    if (changedTurn) {
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

  /** Espaço/botão: bate (na vez deste navegador) ou pula a animação em andamento. */
  private shoot() {
    if (this.flight) {
      this.flight.start = -Infinity
      return
    }
    // Espaço apertado para pular a animação logo quando ela acaba não vira nova tacada.
    if (this.phase !== 'aim' || !this.controllable || performance.now() - this.readyAt < 600) {
      return
    }
    this.phase = 'idle'
    this.panel.setEnabled(false, 'Batendo…')
    this.onShoot(this.request())
  }

  /** Anima a trajetória da bola de `playerId`; resolve quando ela para. */
  animateShot(playerId: string, frames: Float32Array, aim?: number): Promise<void> {
    this.flight?.done()
    this.phase = 'flying'
    this.shotForward = aimDirection(aim ?? this.aim)
    this.target.visible = false
    this.greenGrid.visible = false
    this.panel.setEnabled(false, 'Espaço: pular animação')
    const player = this.players.find((p) => p.id === playerId)
    if (player) this.ballOf(player, this.players.length > 1)
    return new Promise((resolve) => {
      this.flight = { playerId, frames, start: performance.now(), done: resolve }
    })
  }

  showResult(text: string) {
    this.panel.showResult(text)
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
    const back = putting ? 30 : 70
    const up = putting ? 16 : 28
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
    camera.lookAt(focus.clone().addScaledVector(forward, putting ? 25 : 60))
  }

  private frameAt(frames: Float32Array, i: number) {
    return toScene(frames[i * 3]!, frames[i * 3 + 1]! + BALL_RADIUS, frames[i * 3 + 2]!)
  }

  private frame(now: number, dt: number) {
    if (this.flight) {
      const { frames, playerId } = this.flight
      const count = frames.length / 3
      const index = Math.min(Math.floor((now - this.flight.start) / 1000 / STEP_TIME), count - 1)
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
      const turn = this.controllable
        ? (this.keys.has('ArrowLeft') ? 1 : 0) - (this.keys.has('ArrowRight') ? 1 : 0)
        : 0
      if (turn) {
        this.aim += turn * dt * (this.greenGrid.visible ? 0.25 : 0.6)
        this.targetDirty = true
      }
      if (this.controllable && this.targetDirty) this.updateTarget()
      this.target.visible = this.controllable
      this.placeCamera(this.ballPosition(), turn ? 0.3 : 0.08)
    } else {
      this.placeCamera(this.ballPosition(), 0.08)
    }
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

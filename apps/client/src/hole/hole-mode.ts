import {
  applyShot,
  isChipIn,
  scoreName,
  scoreToPar,
  startHole,
  type HoleState,
  type Point,
  type ShotOutcome,
} from '@pangya/game'
import {
  CLUB_IDS,
  CLUBS,
  DEFAULT_PLAYER,
  FlightSimulator,
  puttSpeed,
  simulateGround,
  STEP_TIME,
  Obstacles,
  TerrainGrid,
  unitsToYards,
  yardsToUnits,
  type ClubId,
  type GroundAt,
  type ShotInput,
} from '@pangya/physics'
import type { SurfaceClass, SurfaceKind } from '@pangya/formats'
import {
  AmbientLight,
  BufferGeometry,
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
  Vector3,
  WebGLRenderer,
} from 'three'
import { createShotPanel, PUTT_RANGE } from '../shot-panel.ts'
import { aimDirection, aimTowards, toScene } from './coords.ts'
import { buildCourseScene, SKY_RADIUS } from './course-scene.ts'
import { buildGreenGrid } from './green-grid.ts'
import { loadHole, type HoleRef } from './load-hole.ts'
import { SURFACE_LABELS } from './surface-colors.ts'
import { TextureLibrary } from './textures.ts'

const BALL_RADIUS = 1.6
const WATER = new Set(['water', 'waterPass'])

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

function holeUrl(ref: HoleRef, hole: number, card: { strokes: number; par: number }[]) {
  const params = new URLSearchParams(location.search)
  params.set('buraco', String(hole))
  if (card.length) params.set('cartao', card.map((c) => `${c.strokes}:${c.par}`).join(','))
  else params.delete('cartao')
  return `${location.pathname}?${params}`
}

/** Taco sugerido: o menor alcance (a 100%) que chega à distância; no green, o putter. */
function suggestClub(distanceYards: number, lie: string): ClubId {
  if (lie === 'green') return 'PT1'
  const ranked = CLUB_IDS.filter((c) => CLUBS[c].category !== 'putter')
    .map((club) => ({
      club,
      range: new FlightSimulator({ club, player: DEFAULT_PLAYER, percent: 1 }).range,
    }))
    .sort((a, b) => a.range - b.range)
  return ranked.find((c) => c.range >= distanceYards)?.club ?? '1W'
}

export async function startHoleMode(ref: HoleRef) {
  const renderer = new WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)

  const scene = new Scene()
  // Luzes só para os materiais de depuração (mapa de pisos, modelos sem textura).
  scene.add(new AmbientLight(0xffffff, 0.75))
  const sun = new DirectionalLight(0xffffff, 1.1)
  sun.position.set(300, 800, 200)
  scene.add(sun)

  const camera = new PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    1,
    SKY_RADIUS * 2.4,
  )
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  const status = document.createElement('div')
  status.className = 'hole-status'
  status.textContent = 'Carregando buraco…'
  document.body.appendChild(status)
  const showError = (message: string) => {
    status.classList.add('error')
    status.textContent = message
  }
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    showError('A placa de vídeo perdeu o contexto WebGL (memória de vídeo?). Recarregue a página.')
  })

  const hole = await loadHole(ref)
  const textures = new TextureLibrary(ref.round, renderer.capabilities.getMaxAnisotropy())
  const course = await buildCourseScene(hole, scene, textures, (done, total) => {
    status.textContent = `Carregando texturas… ${done}/${total}`
  })
  const grid = new TerrainGrid(hole.collision.triangles)

  const [px, , pz] = hole.pin
  const pinGround = grid.groundAt(px, pz)?.y ?? hole.pin[1]
  const cup = { x: px, y: pinGround, z: pz }
  const surfaceAt = (x: number, z: number): SurfaceClass | undefined => {
    const hit = grid.groundAt(x, z)
    return hit && hole.collision.surfaces[hit.triangle]
  }
  /** Terreno visto pela física do chão: altura, normal e piso (bound/roll do property.xml). */
  const groundAt: GroundAt = (x, z) => {
    const hit = grid.groundAt(x, z)
    if (!hit) return undefined
    return {
      y: hit.y,
      normal: grid.normalOf(hit.triangle),
      surface: hole.collision.surfaces[hit.triangle]!,
    }
  }
  const onGround = (p: Point): Point => ({ ...p, y: grid.groundAt(p.x, p.z)?.y ?? p.y })
  const obstacles = new Obstacles(hole.obstacles)

  // Tecla C: mostra as caixas de colisão dos objetos (depuração).
  const boxEdges = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]
  const boxLines = new LineSegments(
    new BufferGeometry().setAttribute(
      'position',
      new Float32BufferAttribute(
        hole.obstacles.flatMap((b) => boxEdges.flatMap((i) => toScene(...b.corners[i]!).toArray())),
        3,
      ),
    ),
    new LineBasicMaterial({ color: 0xff4081 }),
  )
  boxLines.visible = false
  scene.add(boxLines)

  status.textContent =
    `${grid.triangleCount} triângulos · ${hole.objects.length} modelos` +
    (hole.missingModels.length ? ` (${hole.missingModels.length} faltando)` : '') +
    ` · ${course.texturesLoaded} texturas` +
    (course.texturesMissing.length ? ` (${course.texturesMissing.length} faltando)` : '') +
    ` · ${obstacles.size} caixas de colisão (${hole.obstacleSource})` +
    ' · ←→ mirar · espaço bater · M aérea · T pisos · F névoa · C colisão'
  if (course.texturesMissing.length) {
    console.info('texturas não encontradas:', course.texturesMissing)
  }

  // Marcadores: anel discreto no tee e bandeira do pin.
  const teeGround = grid.groundAt(hole.tee[0], hole.tee[2])?.y ?? hole.tee[1]
  const tee = new Mesh(
    new RingGeometry(3.5, 4.5, 24),
    new MeshBasicMaterial({ color: 0x1e88e5, side: DoubleSide }),
  )
  tee.rotation.x = -Math.PI / 2
  tee.position.copy(toScene(hole.tee[0], teeGround + 0.2, hole.tee[2]))
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
  flag.position.copy(toScene(px, pinGround, pz))
  scene.add(flag)

  const greenGrid = buildGreenGrid(grid, (t) => hole.collision.surfaces[t]?.kind === 'green', {
    x: px,
    z: pz,
  })
  greenGrid.visible = false
  scene.add(greenGrid)

  const ball = new Mesh(
    new SphereGeometry(BALL_RADIUS, 20, 10),
    new MeshLambertMaterial({ color: 0xffffff }),
  )
  scene.add(ball)
  const MAX_TRAIL = 4000
  const trailPositions = new Float32BufferAttribute(new Float32Array(MAX_TRAIL * 3), 3)
  const trailGeometry = new BufferGeometry()
  trailGeometry.setAttribute('position', trailPositions)
  trailGeometry.setDrawRange(0, 0)
  const trail = new Line(trailGeometry, new LineBasicMaterial({ color: 0xffeb3b }))
  trail.frustumCulled = false
  scene.add(trail)

  // Alvo: onde a tacada cai com a força, spin e curva atuais (sem vento), como o anel do jogo.
  const target = new Mesh(
    new RingGeometry(2.2, 3.4, 32),
    new MeshBasicMaterial({ color: 0xffeb3b, side: DoubleSide, depthTest: false, fog: false }),
  )
  target.rotation.x = -Math.PI / 2
  target.renderOrder = 3
  scene.add(target)

  // ---- estado do jogo ----
  const card = readCard()
  let state: HoleState = startHole(hole.par, onGround({ x: hole.tee[0], y: 0, z: hole.tee[2] }))
  let phase: 'aim' | 'flying' | 'over' = 'aim'
  let aim = 0
  let message = ''

  const hud = document.createElement('div')
  hud.className = 'hud'
  document.body.appendChild(hud)

  const panel = createShotPanel(shoot, {
    title: `${ref.prefix} — buraco ${ref.hole}`,
    putter: true,
  })
  // Vento sorteado no início do buraco (o jogador pode mudar no painel).
  panel.setWind(Math.floor(Math.random() * 10), Math.floor(Math.random() * 360))
  panel.onChange(() => {
    targetDirty = true
  })

  const distanceToPin = () => unitsToYards(Math.hypot(px - state.ball.x, pz - state.ball.z))
  const ballLie = () => (state.lie === 'tee' ? undefined : surfaceAt(state.ball.x, state.ball.z))

  function updateHud() {
    const lie = ballLie()
    const kind = state.lie === 'tee' ? 'tee' : (lie?.kind ?? state.lie)
    const label = SURFACE_LABELS[kind as SurfaceKind] ?? kind
    const power = lie && state.lie !== 'tee' ? ` (${lie.power.min}–${lie.power.max}%)` : ''
    const total = card.reduce((n, c) => n + c.strokes, 0)
    const totalPar = card.reduce((n, c) => n + c.par, 0)
    // Desnível até o pin (positivo = pin mais alto), em jardas como o resto do HUD.
    const rise = unitsToYards(pinGround - state.ball.y)
    hud.innerHTML =
      `<strong>Buraco ${ref.hole}</strong> · Par ${hole.par} · ` +
      (state.finished ? `${state.strokes} tacadas` : `Tacada ${state.strokes + 1}`) +
      (state.penalties ? ` (${state.penalties} de penalidade)` : '') +
      ` · <strong>${distanceToPin().toFixed(1)}y</strong> até o pin` +
      ` (${rise >= 0 ? '↑' : '↓'} ${Math.abs(rise).toFixed(2)}y) · Piso: ${label}${power}` +
      (card.length ? ` · Total ${total} (${scoreToPar(total, totalPar)})` : '') +
      (message ? `<br>${message}` : '')
  }

  /** Coloca a bola para a próxima tacada: mira no pin, taco sugerido, grade no green. */
  let readyAt = 0
  function readyForShot() {
    phase = 'aim'
    readyAt = performance.now()
    ball.position.copy(toScene(state.ball.x, state.ball.y + BALL_RADIUS, state.ball.z))
    aim = aimTowards(state.ball.x, state.ball.z, px, pz)
    const lie = state.lie === 'tee' ? 'tee' : (ballLie()?.kind ?? state.lie)
    const club = suggestClub(distanceToPin(), lie)
    panel.setClub(club)
    panel.setPercent(club === 'PT1' ? Math.min(1, distanceToPin() / PUTT_RANGE) : 1)
    greenGrid.visible = lie === 'green'
    trailGeometry.setDrawRange(0, 0)
    targetDirty = true
    placeCamera(ball.position, 1)
    updateHud()
  }

  // ---- câmera ----
  let aerial = false
  let surfaceView = false
  let fogOn = true
  const keys = new Set<string>()
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') aerial = !aerial
    if (e.code === 'KeyT') course.setSurfaceView((surfaceView = !surfaceView))
    if (e.code === 'KeyF') course.setFog((fogOn = !fogOn))
    if (e.code === 'KeyC') boxLines.visible = !boxLines.visible
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault()
      keys.add(e.code)
    }
  })
  window.addEventListener('keyup', (e) => keys.delete(e.code))

  const ray = new Raycaster()
  let shotForward = aimDirection(0)
  const middle = toScene((hole.tee[0] + px) / 2, 0, (hole.tee[2] + pz) / 2)
  const holeForward = toScene(px - hole.tee[0], 0, pz - hole.tee[2]).normalize()
  function placeCamera(focus: Vector3, lerp: number) {
    if (aerial) {
      camera.position.lerp(
        middle
          .clone()
          .add(new Vector3(0, 1100, 0))
          .addScaledVector(holeForward, -350),
        lerp,
      )
      camera.lookAt(middle)
      return
    }
    const forward = phase === 'flying' ? shotForward : aimDirection(aim)
    const putting = phase === 'aim' && greenGrid.visible
    const back = putting ? 30 : 70
    const up = putting ? 16 : 28
    const desired = focus
      .clone()
      .addScaledVector(forward, -back)
      .add(new Vector3(0, up, 0))
    // A câmera desliza até a posição desejada; as proteções valem para a posição real
    // de cada quadro (deslizando, ela poderia atravessar paredes do terreno).
    const next = camera.position.clone().lerp(desired, lerp)
    // Terreno entre a bola e a câmera (ex.: bola no fundo de um penhasco): aproxima.
    const toCamera = next.clone().sub(focus)
    const distance = toCamera.length()
    if (distance > 0.001) {
      ray.set(focus, toCamera.normalize())
      ray.far = distance
      const hit = ray.intersectObjects(course.terrainMeshes, false)[0]
      if (hit) next.copy(focus).addScaledVector(toCamera, Math.max(4, hit.distance - 4))
    }
    // Sempre acima do chão logo abaixo dela (a cena tem Z invertido).
    const below = grid.groundAt(next.x, -next.z)
    if (below && next.y < below.y + 6) next.y = below.y + 6
    camera.position.copy(next)
    camera.lookAt(focus.clone().addScaledVector(forward, putting ? 25 : 60))
  }

  // ---- tacada ----
  let targetDirty = true
  function shotInput(): ShotInput {
    const lie = ballLie()
    // Força do piso: sorteada entre o mínimo e o máximo do property.xml (verificar).
    const ground =
      state.lie === 'tee' || !lie
        ? 100
        : lie.power.min + Math.random() * (lie.power.max - lie.power.min)
    const normal = grid.groundAt(state.ball.x, state.ball.z)
    return {
      ...panel.read(),
      aim,
      targetDistance: distanceToPin(),
      ground,
      ...(normal &&
        state.lie !== 'tee' && { lieNormal: arrayToVec(grid.normalOf(normal.triangle)) }),
    }
  }
  const arrayToVec = ([x, y, z]: [number, number, number]) => ({ x, y, z })

  /** Simula a tacada inteira: voo + chão (ou só rolagem, no putt). */
  function simulate(input: ShotInput, withGround: boolean) {
    const origin = { ...state.ball }
    if (CLUBS[input.club].category === 'putter') {
      const roll = surfaceAt(origin.x, origin.z)?.roll ?? 0.18
      const speed = puttSpeed(input.percent * PUTT_RANGE, roll)
      const ground = simulateGround(
        {
          position: origin,
          velocity: { x: -Math.sin(aim) * speed, y: 0, z: Math.cos(aim) * speed },
          rolling: true,
          cup,
        },
        groundAt,
        obstacles,
      )
      return { frames: ground.frames, carry: 0, flightFrames: 0, ground, landed: true }
    }
    const sim = new FlightSimulator(input, origin)
    const flight = sim.flyOverGround((x, z) => grid.groundAt(x, z)?.y, -1000, obstacles)
    if (!withGround || !flight.landed) {
      return {
        frames: flight.frames,
        carry: flight.carry,
        flightFrames: flight.frames.length / 3,
        ground: undefined,
        landed: flight.landed,
      }
    }
    const ground = simulateGround(
      { position: flight.landing, velocity: flight.velocity, spin: flight.spin, cup },
      groundAt,
      obstacles,
    )
    const frames = new Float32Array(flight.frames.length + ground.frames.length)
    frames.set(flight.frames)
    frames.set(ground.frames, flight.frames.length)
    return {
      frames,
      carry: flight.carry,
      flightFrames: flight.frames.length / 3,
      ground,
      hitObject: flight.obstacle !== undefined,
      landed: true,
    }
  }

  function updateTarget() {
    targetDirty = false
    const input = { ...shotInput(), wind: { speed: 0, degree: 0 }, ground: 100 }
    let x: number
    let z: number
    if (CLUBS[input.club].category === 'putter') {
      const d = yardsToUnits(input.percent * PUTT_RANGE)
      x = state.ball.x - Math.sin(aim) * d
      z = state.ball.z + Math.cos(aim) * d
    } else {
      const { frames } = simulate(input, false)
      x = frames[frames.length - 3]!
      z = frames[frames.length - 1]!
    }
    const y = grid.groundAt(x, z)?.y ?? state.ball.y
    target.position.copy(toScene(x, y + 0.3, z))
  }

  interface Flight {
    frames: Float32Array
    carry: number
    outcome: ShotOutcome
    start: number
    /** Quantas vezes a bola bateu em objetos (árvores, casas…). */
    hits: number
  }
  let flight: Flight | undefined

  /** Onde recolocar a bola que caiu na água: último ponto da trajetória sobre chão seco. */
  function waterDrop(frames: Float32Array): Point {
    for (let i = frames.length / 3 - 1; i >= 0; i--) {
      const x = frames[i * 3]!
      const z = frames[i * 3 + 2]!
      const surface = surfaceAt(x, z)
      if (surface && !WATER.has(surface.kind)) return onGround({ x, y: 0, z })
    }
    return state.ball
  }

  function shoot() {
    if (phase === 'flying' && flight) {
      flight.start = -Infinity // espaço durante o voo: pula a animação
      return
    }
    // Espaço apertado para pular a animação logo quando ela acaba não vira nova tacada.
    if (phase !== 'aim' || performance.now() - readyAt < 600) return
    const input = shotInput()
    const result = simulate(input, true)
    if (result.frames.some((v) => !Number.isFinite(v))) {
      showError(`Tacada gerou posição inválida (NaN). Entrada: ${JSON.stringify(input)}`)
      return
    }
    const end = result.ground?.final ?? {
      x: result.frames[result.frames.length - 3]!,
      y: result.frames[result.frames.length - 2]!,
      z: result.frames[result.frames.length - 1]!,
    }
    let outcome: ShotOutcome
    const how = result.ground?.outcome ?? 'outOfBounds'
    if (how === 'hole') outcome = { type: 'hole', at: cup }
    else if (how === 'water') {
      const dropAt = waterDrop(result.frames)
      outcome = {
        type: 'water',
        at: end,
        dropAt,
        dropSurface: surfaceAt(dropAt.x, dropAt.z)?.kind ?? 'rough',
      }
    } else if (how === 'outOfBounds') outcome = { type: 'outOfBounds', at: end }
    else outcome = { type: 'stop', at: end, surface: result.ground?.surface ?? 'default' }

    shotForward = aimDirection(aim)
    const hits =
      ('hitObject' in result && result.hitObject ? 1 : 0) +
      (result.ground?.events.filter((e) => e.type === 'obstacle').length ?? 0)
    flight = { frames: result.frames, carry: result.carry, outcome, start: performance.now(), hits }
    phase = 'flying'
    greenGrid.visible = false
    target.visible = false
    message = ''
    updateHud()
  }

  function finishShot(f: Flight) {
    const from = state.ball
    state = applyShot(state, f.outcome)
    const total = unitsToYards(Math.hypot(f.outcome.at.x - from.x, f.outcome.at.z - from.z))
    const travel =
      f.carry > 0
        ? `voo ${f.carry.toFixed(1)}y + rolagem ${Math.max(0, total - f.carry).toFixed(1)}y`
        : `${total.toFixed(1)}y`
    const endings: Record<ShotOutcome['type'], string> = {
      hole: '⛳ NA COVA!',
      water: '💧 Água! +1 de penalidade',
      outOfBounds: '🚫 O.B.! +1 de penalidade, volta para onde bateu',
      stop: '',
    }
    message =
      travel +
      (f.hits ? ' · 🌳 bateu em objeto' : '') +
      (endings[f.outcome.type] ? ' · ' + endings[f.outcome.type] : '')
    panel.showResult(message)
    if (state.finished) return endHole()
    readyForShot()
  }

  function endHole() {
    phase = 'over'
    updateHud()
    const holed = state.result === 'holed'
    const name = holed ? scoreName(state.strokes, state.par) : 'Desistência'
    const extra = isChipIn(state) ? ' — Chip-in!' : ''
    const nextCard = [...card, { strokes: state.strokes, par: state.par }]
    const total = nextCard.reduce((n, c) => n + c.strokes, 0)
    const totalPar = nextCard.reduce((n, c) => n + c.par, 0)
    const box = document.createElement('div')
    box.className = 'hole-end'
    box.innerHTML = `
      <h2>${name}${extra}</h2>
      <p>${state.strokes} tacadas no par ${state.par} (${scoreToPar(state.strokes, state.par)})
        ${state.penalties ? `· ${state.penalties} de penalidade` : ''}</p>
      <p>Placar: ${nextCard.map((c) => c.strokes).join(' · ')} — total ${total}
        (${scoreToPar(total, totalPar)})</p>
      <div>
        ${ref.hole < 18 ? `<a class="button" href="${holeUrl(ref, ref.hole + 1, nextCard)}">Próximo buraco</a>` : ''}
        <a class="button secondary" href="${holeUrl(ref, ref.hole, card)}">Jogar de novo</a>
      </div>`
    document.body.appendChild(box)
  }

  // ---- loop ----
  const frameAt = (frames: Float32Array, i: number) =>
    toScene(frames[i * 3]!, frames[i * 3 + 1]! + BALL_RADIUS, frames[i * 3 + 2]!)

  readyForShot()
  let last = performance.now()
  renderer.setAnimationLoop((now) => {
    try {
      frame(now, Math.min(0.1, (now - last) / 1000))
      last = now
    } catch (err) {
      renderer.setAnimationLoop(null)
      showError(
        `Erro ao desenhar: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
      )
    }
  })

  // Depuração (testes automatizados): estado da câmera, da bola e do buraco.
  ;(window as unknown as { __debug: () => unknown }).__debug = () => ({
    ball: ball.position.toArray().map((v) => Math.round(v)),
    camera: camera.position.toArray().map((v) => Math.round(v)),
    phase,
    aim,
    state,
  })

  function frame(now: number, dt: number) {
    if (phase === 'aim') {
      const turn = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0)
      if (turn) {
        aim += turn * dt * (greenGrid.visible ? 0.25 : 0.6)
        targetDirty = true
      }
      if (targetDirty) updateTarget()
      target.visible = true
      placeCamera(ball.position, turn ? 0.3 : 0.08)
    } else if (phase === 'flying' && flight) {
      const { frames } = flight
      const count = frames.length / 3
      const index = Math.min(Math.floor((now - flight.start) / 1000 / STEP_TIME), count - 1)
      ball.position.copy(frameAt(frames, index))
      const shown = Math.min(index + 1, MAX_TRAIL)
      for (let i = 0; i < shown; i++) {
        const p = frameAt(frames, i)
        trailPositions.setXYZ(i, p.x, p.y, p.z)
      }
      trailPositions.needsUpdate = true
      trailGeometry.setDrawRange(0, shown)
      placeCamera(ball.position, 0.08)
      if (index === count - 1) {
        const done = flight
        flight = undefined
        finishShot(done)
      }
    } else {
      placeCamera(ball.position, 0.08)
    }
    course.update(camera)
    renderer.render(scene, camera)
  }
}

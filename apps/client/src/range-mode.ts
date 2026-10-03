import { simulateFlight, STEP_TIME, unitsToYards, type FlightResult } from '@pangya/physics'
import {
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  WebGLRenderer,
} from 'three'
import { BALL_PLAYBACK_SPEED } from './settings.ts'
import { createShotPanel } from './shot-panel.ts'

/** Campo de treino plano (sem assets do jogo). */
export function startRangeMode() {
  // A cena é desenhada em jardas: 1 unidade do Three.js = 1 jarda.
  const renderer = new WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)

  const scene = new Scene()
  scene.background = new Color(0x87c5ff)

  const camera = new PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 3000)

  scene.add(new AmbientLight(0xffffff, 0.7))
  const sun = new DirectionalLight(0xffffff, 1.1)
  sun.position.set(50, 100, -30)
  scene.add(sun)

  /** Fairway com faixas a cada 10 jardas. */
  function fairwayTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 4
    canvas.height = 2
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#4caf50'
    ctx.fillRect(0, 0, 4, 1)
    ctx.fillStyle = '#45a049'
    ctx.fillRect(0, 1, 4, 1)
    const texture = new CanvasTexture(canvas)
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.repeat.set(1, 40)
    return texture
  }

  const fairway = new Mesh(
    new PlaneGeometry(120, 400),
    new MeshLambertMaterial({ map: fairwayTexture() }),
  )
  fairway.rotation.x = -Math.PI / 2
  fairway.position.set(0, 0, 180)
  scene.add(fairway)

  const rough = new Mesh(
    new PlaneGeometry(2000, 2000),
    new MeshLambertMaterial({ color: 0x2e7d32 }),
  )
  rough.rotation.x = -Math.PI / 2
  rough.position.y = -0.05
  scene.add(rough)

  /** Placas de distância a cada 50 jardas. */
  function marker(yards: number) {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fillRect(0, 0, 128, 64)
    ctx.fillStyle = '#1b5e20'
    ctx.font = 'bold 36px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${yards}y`, 64, 46)
    const sprite = new Sprite(new SpriteMaterial({ map: new CanvasTexture(canvas) }))
    sprite.scale.set(8, 4, 1)
    sprite.position.set(-62, 3, yards)
    return sprite
  }
  for (let y = 50; y <= 350; y += 50) scene.add(marker(y))

  const ball = new Mesh(
    new SphereGeometry(0.6, 24, 12),
    new MeshLambertMaterial({ color: 0xffffff }),
  )
  ball.position.set(0, 0.6, 0)
  scene.add(ball)

  const trail = new Line(new BufferGeometry(), new LineBasicMaterial({ color: 0xffeb3b }))
  scene.add(trail)

  const toScene = (frames: Float32Array, i: number) =>
    new Vector3(
      unitsToYards(frames[i * 3]!),
      unitsToYards(frames[i * 3 + 1]!) + 0.6,
      unitsToYards(frames[i * 3 + 2]!),
    )

  let flight: { result: FlightResult; start: number } | undefined

  const panel = createShotPanel((input) => {
    const result = simulateFlight(input)
    flight = { result, start: performance.now() }
    trail.geometry.setAttribute('position', new Float32BufferAttribute([], 3))
    panel.showResult('…')
  })

  function updateFlight(now: number) {
    if (!flight) return
    const { result } = flight
    const count = result.frames.length / 3
    // Entre dois pontos da física (50 por segundo), pelo tempo exato do quadro: sem trancos.
    const exact = Math.max(0, ((now - flight.start) / 1000) * (BALL_PLAYBACK_SPEED / STEP_TIME))
    const index = Math.min(Math.floor(exact), count - 1)
    const at = toScene(result.frames, index)
    if (index < count - 1) at.lerp(toScene(result.frames, index + 1), exact - index)

    ball.position.copy(at)
    const points: number[] = []
    for (let i = 0; i <= index; i++) points.push(...toScene(result.frames, i).toArray())
    points.push(...at.toArray())
    trail.geometry.setAttribute('position', new Float32BufferAttribute(points, 3))

    if (index === count - 1) {
      const lateral = Math.abs(result.lateral)
      const deviation =
        lateral < 0.05 ? 'reto' : `${lateral.toFixed(1)}y ${result.lateral > 0 ? 'esq.' : 'dir.'}`
      panel.showResult(
        `Distância ${result.carry.toFixed(1)}y · desvio ${deviation} · ` +
          `altura ${unitsToYards(result.apex).toFixed(1)}y · alcance ${result.range}y`,
      )
      flight = undefined
    }
  }

  function updateCamera() {
    const target = ball.position
    const desired = new Vector3(target.x, target.y + 6, target.z - 22)
    camera.position.lerp(desired, 0.1)
    camera.lookAt(target.x, target.y, target.z + 20)
  }
  camera.position.set(0, 6, -22)

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  renderer.setAnimationLoop((now) => {
    updateFlight(now)
    updateCamera()
    renderer.render(scene, camera)
  })
}

import {
  FlightSimulator,
  STEP_TIME,
  TerrainGrid,
  unitsToYards,
  type FlightResult,
  type ShotInput,
} from '@pangya/physics'
import type { Mat4x3, SurfaceClass } from '@pangya/formats'
import {
  AmbientLight,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createShotPanel } from '../shot-panel.ts'
import { loadHole, type HoleRef, type LoadedHole } from './load-hole.ts'
import { SURFACE_COLORS, SURFACE_LABELS } from './surface-colors.ts'

/** O Pangya usa Z invertido em relação ao Three.js. */
const toScene = (x: number, y: number, z: number) => new Vector3(x, y, -z)

const flipZ = (positions: Float32Array) => {
  const out = positions.slice()
  for (let i = 2; i < out.length; i += 3) out[i] = -out[i]!
  return out
}

/** Matriz 4×3 do Pangya → Matrix4 do Three.js já com o Z invertido. */
const sceneMatrix = (m: Mat4x3) =>
  new Matrix4().set(
    m[0]!,
    m[3]!,
    m[6]!,
    m[9]!,
    m[1]!,
    m[4]!,
    m[7]!,
    m[10]!,
    -m[2]!,
    -m[5]!,
    -m[8]!,
    -m[11]!,
    0,
    0,
    0,
    1,
  )

const objectColor = (model: string) =>
  /tree|plant|flower|bush|boosh|leaf|grass/i.test(model)
    ? 0x3f9b4a
    : /house|lamp|parasol|box|bottle/i.test(model)
      ? 0xe6d3b3
      : 0xb9b0a3

function buildScene(hole: LoadedHole, scene: Scene) {
  for (const part of hole.terrain) {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(flipZ(part.positions), 3))
    geometry.computeVertexNormals()
    const material = new MeshLambertMaterial({
      color: SURFACE_COLORS[part.surface.kind],
      side: DoubleSide,
    })
    scene.add(new Mesh(geometry, material))
  }

  for (const object of hole.objects) {
    const parts = object.subMeshes.map((sub) => {
      const g = new BufferGeometry()
      g.setAttribute('position', new Float32BufferAttribute(sub.positions, 3))
      g.setAttribute('normal', new Float32BufferAttribute(sub.normals, 3))
      return g
    })
    const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts)
    if (!geometry) continue
    const mesh = new InstancedMesh(
      geometry,
      new MeshLambertMaterial({ color: objectColor(object.model), side: DoubleSide }),
      object.instances.length,
    )
    object.instances.forEach((m, i) => mesh.setMatrixAt(i, sceneMatrix(m)))
    scene.add(mesh)
  }

  // Marcadores: tee e bandeira do pin.
  const tee = new Mesh(
    new CylinderGeometry(4, 4, 0.6, 20),
    new MeshLambertMaterial({ color: 0x1e88e5 }),
  )
  tee.position.copy(toScene(...hole.tee))
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
  flag.position.copy(toScene(...hole.pin))
  scene.add(flag)
}

export async function startHoleMode(ref: HoleRef) {
  const renderer = new WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)

  const scene = new Scene()
  scene.background = new Color(0x9fd4ff)
  scene.fog = new Fog(0x9fd4ff, 900, 2600)
  scene.add(new AmbientLight(0xffffff, 0.75))
  const sun = new DirectionalLight(0xffffff, 1.1)
  sun.position.set(300, 800, 200)
  scene.add(sun)

  const camera = new PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 6000)
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  const status = document.createElement('div')
  status.className = 'hole-status'
  status.textContent = 'Carregando buraco…'
  document.body.appendChild(status)

  const hole = await loadHole(ref)
  buildScene(hole, scene)
  const grid = new TerrainGrid(hole.collision.triangles)
  const surfaceAt = (x: number, z: number): SurfaceClass | undefined => {
    const hit = grid.groundAt(x, z)
    return hit ? hole.collision.surfaces[hit.triangle] : undefined
  }

  const [tx, , tz] = hole.tee
  const [px, , pz] = hole.pin
  const toPin = { x: px - tx, z: pz - tz }
  const pinYards = unitsToYards(Math.hypot(toPin.x, toPin.z))
  const aim = Math.atan2(-toPin.x, toPin.z)
  const teeGround = grid.groundAt(tx, tz)?.y ?? hole.tee[1]
  const origin = { x: tx, y: teeGround, z: tz }

  status.textContent =
    `${ref.prefix} buraco ${ref.hole} · par ${hole.par} · ${pinYards.toFixed(0)}y até o pin · ` +
    `${grid.triangleCount} triângulos, ${hole.objects.length} modelos` +
    (hole.missingModels.length ? ` (${hole.missingModels.length} faltando)` : '') +
    ' · M = vista aérea'

  const ball = new Mesh(
    new SphereGeometry(1.6, 20, 10),
    new MeshLambertMaterial({ color: 0xffffff }),
  )
  ball.position.copy(toScene(origin.x, origin.y + 1.6, origin.z))
  scene.add(ball)
  const MAX_TRAIL = 4000
  const trailPositions = new Float32BufferAttribute(new Float32Array(MAX_TRAIL * 3), 3)
  const trailGeometry = new BufferGeometry()
  trailGeometry.setAttribute('position', trailPositions)
  trailGeometry.setDrawRange(0, 0)
  const trail = new Line(trailGeometry, new LineBasicMaterial({ color: 0xffeb3b }))
  trail.frustumCulled = false
  scene.add(trail)

  const showError = (message: string) => {
    status.classList.add('error')
    status.textContent = message
  }
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    showError('A placa de vídeo perdeu o contexto WebGL (memória de vídeo?). Recarregue a página.')
  })

  // Direção da tacada na cena (para posicionar a câmera atrás da bola).
  const forward = toScene(toPin.x, 0, toPin.z).normalize()
  // Tecla M: alterna entre câmera atrás da bola e vista aérea do buraco.
  let aerial = false
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') aerial = !aerial
  })
  const middle = toScene((tx + px) / 2, 0, (tz + pz) / 2)
  const placeCamera = (target: Vector3, lerp: number) => {
    if (aerial) {
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
    const desired = target
      .clone()
      .addScaledVector(forward, -70)
      .add(new Vector3(0, 28, 0))
    camera.position.lerp(desired, lerp)
    camera.lookAt(target.clone().addScaledVector(forward, 60))
  }
  placeCamera(ball.position, 1)

  let flight: { result: FlightResult; start: number } | undefined
  const panel = createShotPanel((input: ShotInput) => {
    const sim = new FlightSimulator({ ...input, aim, targetDistance: pinYards }, origin)
    const result = sim.flyOverGround((x, z) => grid.groundAt(x, z)?.y)
    if (result.frames.some((v) => !Number.isFinite(v))) {
      showError(
        `Tacada gerou posição inválida (NaN). Entrada: ${JSON.stringify({ ...input, aim, origin })}`,
      )
      return
    }
    flight = { result, start: performance.now() }
    panel.showResult('…')
  })

  const frameAt = (frames: Float32Array, i: number) =>
    toScene(frames[i * 3]!, frames[i * 3 + 1]! + 1.6, frames[i * 3 + 2]!)

  renderer.setAnimationLoop((now) => {
    try {
      frame(now)
    } catch (err) {
      renderer.setAnimationLoop(null)
      showError(
        `Erro ao desenhar: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
      )
    }
  })

  function frame(now: number) {
    if (flight) {
      const { result } = flight
      const count = result.frames.length / 3
      const index = Math.min(Math.floor((now - flight.start) / 1000 / STEP_TIME), count - 1)
      ball.position.copy(frameAt(result.frames, index))
      const shown = Math.min(index + 1, MAX_TRAIL)
      for (let i = 0; i < shown; i++) {
        const p = frameAt(result.frames, i)
        trailPositions.setXYZ(i, p.x, p.y, p.z)
      }
      trailPositions.needsUpdate = true
      trailGeometry.setDrawRange(0, shown)

      if (index === count - 1) {
        const { x, z } = result.landing
        const surface = surfaceAt(x, z)
        const left = unitsToYards(Math.hypot(px - x, pz - z))
        panel.showResult(
          `${result.carry.toFixed(1)}y · caiu em: ${surface ? SURFACE_LABELS[surface.kind] : 'fora do mapa'}` +
            ` · faltam ${left.toFixed(1)}y para o pin`,
        )
        flight = undefined
      }
    }
    placeCamera(ball.position, 0.08)
    renderer.render(scene, camera)
  }
}

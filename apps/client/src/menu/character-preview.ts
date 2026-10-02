/**
 * Prévia 3D do personagem na tela de escolha: o boneco de frente, na postura básica do
 * jogo (기본자세), num pedestal. Arrastar gira o personagem.
 */
import {
  Box3,
  CircleGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three'
import { CharacterModel, type CharacterEntry } from '../character/character.ts'

/** De frente para a câmera (o modelo olha para -X no próprio espaço). */
const FRONT = Math.PI / 2

export class CharacterPreview {
  readonly element = document.createElement('div')
  private readonly status = document.createElement('p')
  private readonly renderer = new WebGLRenderer({ antialias: true, alpha: true })
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(30, 1, 0.1, 500)
  private readonly pedestal = new Mesh(
    new CircleGeometry(1, 40),
    new MeshBasicMaterial({ color: 0x0b2a4a, transparent: true, opacity: 0.25 }),
  )
  private model: CharacterModel | undefined
  private token = 0
  private turn = 0
  private last = performance.now()
  private readonly resizer = new ResizeObserver(() => this.resize())

  constructor() {
    this.element.className = 'character-preview'
    this.status.className = 'preview-status'
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.element.append(this.renderer.domElement, this.status)
    this.scene.add(new HemisphereLight(0xffffff, 0x6a8fb0, 2.4))
    const key = new DirectionalLight(0xffffff, 1.3)
    key.position.set(10, 30, 30)
    this.scene.add(key)
    this.pedestal.rotation.x = -Math.PI / 2
    this.scene.add(this.pedestal)
    this.resizer.observe(this.element)
    this.bindDrag()
    this.renderer.setAnimationLoop(() => this.tick())
  }

  /** Troca o personagem mostrado (undefined = sem personagem). */
  async show(entry: CharacterEntry | undefined) {
    const token = ++this.token
    this.clear()
    if (!entry) {
      this.status.textContent = 'Sem personagem (só a bola)'
      return
    }
    this.status.textContent = 'Carregando…'
    let model: CharacterModel
    try {
      model = await CharacterModel.load(entry)
    } catch (err) {
      if (token === this.token) this.status.textContent = `Não consegui montar: ${String(err)}`
      return
    }
    if (token !== this.token) {
      disposeModel(model)
      return
    }
    this.model = model
    this.turn = 0
    model.root.rotation.y = FRONT
    model.play(model.findMotion(/^기본자세$/) ?? model.motionNames[0], true, 0)
    model.update(0)
    this.scene.add(model.root)
    this.status.textContent = ''
    this.frame()
  }

  dispose() {
    this.token++
    this.clear()
    this.resizer.disconnect()
    this.renderer.setAnimationLoop(null)
    this.renderer.dispose()
    this.element.remove()
  }

  private clear() {
    if (!this.model) return
    this.scene.remove(this.model.root)
    disposeModel(this.model)
    this.model = undefined
  }

  /** Enquadra o corpo inteiro, de frente e um pouco de cima. */
  private frame() {
    if (!this.model) return
    const box = new Box3().setFromObject(this.model.root, true)
    if (box.isEmpty()) box.set(new Vector3(-1, 0, -1), new Vector3(1, 6, 1))
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    const height = Math.max(size.y, 1)
    const fov = (this.camera.fov * Math.PI) / 180
    // Cabe na altura e na largura (tela estreita no celular).
    const fitHeight = height / 2 / Math.tan(fov / 2)
    const fitWidth = Math.max(size.x, size.z) / 2 / Math.tan(fov / 2) / this.camera.aspect
    const distance = Math.max(fitHeight, fitWidth) * 1.25
    this.camera.position.set(center.x, center.y + height * 0.08, center.z + distance)
    this.camera.lookAt(center.x, center.y, center.z)
    const radius = Math.max(size.x, size.z) * 0.75 || 1
    this.pedestal.scale.setScalar(radius)
    this.pedestal.position.set(center.x, box.min.y + 0.01, center.z)
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.element
    if (!w || !h) return
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.frame()
  }

  private bindDrag() {
    const canvas = this.renderer.domElement
    let from: number | undefined
    canvas.addEventListener('pointerdown', (e) => {
      from = e.clientX
      canvas.setPointerCapture(e.pointerId)
    })
    canvas.addEventListener('pointermove', (e) => {
      if (from === undefined) return
      this.turn += ((e.clientX - from) / Math.max(canvas.clientWidth, 1)) * Math.PI * 2
      from = e.clientX
    })
    const stop = () => (from = undefined)
    canvas.addEventListener('pointerup', stop)
    canvas.addEventListener('pointercancel', stop)
  }

  private tick() {
    const now = performance.now()
    const dt = Math.min((now - this.last) / 1000, 0.1)
    this.last = now
    if (this.model) {
      this.model.update(dt)
      this.model.root.rotation.y = FRONT + this.turn
    }
    this.renderer.render(this.scene, this.camera)
  }
}

function disposeModel(model: CharacterModel) {
  model.root.traverse((o) => {
    if (!(o instanceof Mesh)) return
    o.geometry.dispose()
    const materials: Material[] = Array.isArray(o.material) ? o.material : [o.material]
    for (const m of materials) m.dispose()
  })
}

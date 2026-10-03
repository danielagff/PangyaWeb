/** Prévia da bola escolhida no menu: o modelo do jogo girando, bem de perto. */
import {
  AmbientLight,
  DirectionalLight,
  type Group,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'
import { loadPetObject } from '../hole/pet-object.ts'

export class BallPreview {
  readonly element = document.createElement('div')
  private readonly renderer = new WebGLRenderer({ antialias: true, alpha: true })
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(30, 1, 0.01, 10)
  private ball: Group | undefined
  private shown = ''

  constructor() {
    this.element.className = 'ball-preview'
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(120, 120)
    this.element.append(this.renderer.domElement)
    this.scene.add(new AmbientLight(0xffffff, 1.6))
    const key = new DirectionalLight(0xffffff, 2)
    key.position.set(1, 2, 3)
    this.scene.add(key)
    this.camera.position.set(0, 0.12, 0.75)
    this.camera.lookAt(0, 0, 0)
    this.renderer.setAnimationLoop((t) => {
      if (this.ball) this.ball.rotation.y = t / 1500
      this.renderer.render(this.scene, this.camera)
    })
  }

  async show(model: string | undefined) {
    this.shown = model ?? ''
    const object = model ? await loadPetObject(`${model}.pet`, { center: true }) : undefined
    if (this.shown !== (model ?? '')) return
    if (this.ball) this.scene.remove(this.ball)
    this.ball = object
    if (object) this.scene.add(object)
  }

  dispose() {
    this.renderer.setAnimationLoop(null)
    this.renderer.dispose()
  }
}

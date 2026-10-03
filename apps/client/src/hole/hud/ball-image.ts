/**
 * Imagem da bola do jogador para o mostrador do HUD: o modelo do jogo
 * (data/ball/<modelo>.pet) desenhado uma vez, de frente e enchendo o quadro, num PNG.
 */
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderer,
} from 'three'
import { loadPetObject } from '../pet-object.ts'

const SIZE = 256
const cache = new Map<string, Promise<string | undefined>>()

/** PNG (data URL) da bola `model`; undefined se não houver o modelo ou WebGL. */
export function ballImage(model: string | undefined): Promise<string | undefined> {
  if (!model) return Promise.resolve(undefined)
  let image = cache.get(model)
  if (!image) {
    image = render(model).catch(() => undefined)
    cache.set(model, image)
  }
  return image
}

async function render(model: string) {
  const object = await loadPetObject(`${model}.pet`, { center: true })
  if (!object) return undefined
  const scene = new Scene()
  scene.add(object, new AmbientLight(0xffffff, 1.6))
  const key = new DirectionalLight(0xffffff, 2)
  key.position.set(-1, 2, 3)
  scene.add(key)
  // Raio pela maior meia-medida da caixa (a esfera da caixa toda sobraria nos cantos).
  const box = new Box3().setFromObject(object)
  const size = box.getSize(new Vector3())
  const sphere = new Sphere(box.getCenter(new Vector3()), Math.max(size.x, size.y, size.z) / 2)
  const camera = new PerspectiveCamera(20, 1, 0.001, 100)
  // A esfera enche o quadro (o mostrador recorta num círculo).
  const distance = sphere.radius / Math.sin((camera.fov * Math.PI) / 360)
  camera.position.set(sphere.center.x, sphere.center.y, sphere.center.z + distance)
  camera.lookAt(sphere.center)
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  try {
    renderer.setSize(SIZE, SIZE, false)
    renderer.render(scene, camera)
    return renderer.domElement.toDataURL('image/png')
  } finally {
    renderer.dispose()
    renderer.forceContextLoss()
  }
}

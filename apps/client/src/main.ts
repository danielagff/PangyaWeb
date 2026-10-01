import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from 'three'

const renderer = new WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const scene = new Scene()
scene.background = new Color(0x87c5ff)

const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000)
camera.position.set(0, 1.5, 4)
camera.lookAt(0, 0.2, 0)

scene.add(new AmbientLight(0xffffff, 0.6))
const sun = new DirectionalLight(0xffffff, 1.2)
sun.position.set(5, 10, 3)
scene.add(sun)

const fairway = new Mesh(new PlaneGeometry(200, 200), new MeshLambertMaterial({ color: 0x4caf50 }))
fairway.rotation.x = -Math.PI / 2
scene.add(fairway)

// Bola de golfe: raio real de 21,35 mm, ampliada 10× só para ficar visível nesta cena inicial.
const BALL_RADIUS = 0.02135
const BALL_DISPLAY_SCALE = 10
const ball = new Mesh(
  new SphereGeometry(BALL_RADIUS, 32, 16),
  new MeshLambertMaterial({ color: 0xffffff }),
)
ball.scale.setScalar(BALL_DISPLAY_SCALE)
ball.position.y = BALL_RADIUS * BALL_DISPLAY_SCALE
scene.add(ball)

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

renderer.setAnimationLoop(() => renderer.render(scene, camera))

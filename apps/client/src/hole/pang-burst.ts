/**
 * Pangs saindo na boa tacada, como no jogo: a moeda 3D do jogo (data/effect/coin.pet) com o
 * movimento do efeito original (data/effect/spray/coin_pang.spr): sobe a 0,9 unidade por
 * quadro num cone de 15°, gira em volta do eixo vertical, gravidade 0,03 por quadro²,
 * atrito 1% no ar e 5% no chão, quica com 80%, vive 5–6 s e some na segunda metade da vida;
 * tamanho 2×. Os números do .spr são por quadro (30 por segundo). Sem a moeda do jogo, uma
 * moeda desenhada (sprite).
 */
import {
  CanvasTexture,
  Group,
  Mesh,
  MeshLambertMaterial,
  type Object3D,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import { loadPetObject } from './pet-object.ts'

const FPS = 30
/** coin_pang.spr (valores por quadro do jogo). */
const COIN = {
  speed: 0.9,
  coneDegrees: 15,
  spinDegrees: 20,
  gravity: 0.03,
  friction: 0.01,
  groundFriction: 0.05,
  bounce: 0.8,
  life: [5, 6],
  fadeFrom: 0.5,
  size: 2,
  /** Espalhadas ao longo deste tempo (s), como o Add_Generation (0–500 ms). */
  spread: 0.5,
}

let drawn: CanvasTexture | undefined
function drawnCoin() {
  if (drawn) return drawn
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')!
  const r = size / 2
  const fill = g.createRadialGradient(r * 0.7, r * 0.6, 2, r, r, r)
  fill.addColorStop(0, '#fff6b0')
  fill.addColorStop(0.45, '#ffd23a')
  fill.addColorStop(1, '#c98a00')
  g.fillStyle = fill
  g.beginPath()
  g.arc(r, r, r - 2, 0, Math.PI * 2)
  g.fill()
  g.lineWidth = 4
  g.strokeStyle = '#8a5a00'
  g.stroke()
  g.fillStyle = '#9a6400'
  g.font = `bold ${size * 0.55}px sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('P', r, r + 2)
  drawn = new CanvasTexture(canvas)
  drawn.colorSpace = SRGBColorSpace
  return drawn
}

/** A moeda do jogo (coin.pet), ou undefined sem o arquivo. */
const loadCoin = () => loadPetObject('coin.pet', { center: true, color: 0xffcc33 })

/** Opções de uma leva de moedas (a da cova sai mais baixa, aberta e devagar). */
export interface BurstOptions {
  /** Velocidade de saída (fração da do .spr). */
  speed?: number
  /** Abertura do cone (graus). */
  coneDegrees?: number
  /** Ritmo do movimento (1 = o do .spr; menos = mais devagar). */
  timeScale?: number
  /** Tempo (s) em que as moedas vão saindo. */
  spread?: number
}

interface Coin {
  timeScale: number
  object: Object3D
  velocity: Vector3
  age: number
  life: number
  spin: number
  /** Moeda desenhada: vira de lado mudando a largura. */
  sprite?: Sprite
  landed: boolean
}

export class PangBurst {
  readonly root = new Group()
  private coins: Coin[] = []
  private model: Promise<Group | undefined> | undefined
  private coinModel: Group | undefined
  /** Altura do chão (cena) em x, z; sem chão, a moeda cai até sumir. */
  groundAt: (x: number, z: number) => number | undefined = () => undefined
  /** Chamado quando a primeira moeda de uma leva toca o chão (som delas caindo). */
  onLand: () => void = () => {}
  private landedBurst = true

  /** Carrega a moeda do jogo (uma vez). */
  preload() {
    this.model ??= loadCoin()
      .catch(() => undefined)
      .then((m) => (this.coinModel = m))
    return this.model
  }

  /** Solta `count` moedas em `at` (cena). */
  burst(at: Vector3, count: number, options: BurstOptions = {}) {
    void this.preload()
    this.landedBurst = false
    const cone = ((options.coneDegrees ?? COIN.coneDegrees) * Math.PI) / 180
    const timeScale = options.timeScale ?? 1
    const spread = options.spread ?? COIN.spread
    for (let i = 0; i < count; i++) {
      const tilt = Math.random() * cone
      const around = Math.random() * Math.PI * 2
      const speed = COIN.speed * FPS * (options.speed ?? 1) * (0.85 + Math.random() * 0.3)
      const velocity = new Vector3(
        Math.sin(tilt) * Math.cos(around),
        Math.cos(tilt),
        Math.sin(tilt) * Math.sin(around),
      ).multiplyScalar(speed)
      let object: Object3D
      let sprite: Sprite | undefined
      if (this.coinModel) {
        object = this.coinModel.clone()
        // Material próprio (cada moeda some no seu tempo).
        object.traverse((o) => {
          const mesh = o as Mesh
          if (mesh.isMesh) mesh.material = (mesh.material as MeshLambertMaterial).clone()
        })
        object.scale.setScalar(COIN.size)
        object.rotation.y = Math.random() * Math.PI * 2
      } else {
        sprite = new Sprite(
          new SpriteMaterial({ map: drawnCoin(), transparent: true, depthWrite: false }),
        )
        sprite.renderOrder = 10
        object = sprite
      }
      object.position.copy(at)
      const spin = (((Math.random() * 2 - 1) * COIN.spinDegrees * Math.PI) / 180) * FPS
      const [shortest, longest] = COIN.life as [number, number]
      this.coins.push({
        timeScale,
        object,
        velocity,
        age: (-i / Math.max(1, count - 1)) * spread,
        life: shortest + Math.random() * (longest - shortest),
        spin,
        ...(sprite && { sprite }),
        landed: false,
      })
      this.root.add(object)
    }
  }

  update(realDt: number) {
    for (const coin of this.coins) {
      const dt = realDt * coin.timeScale
      const frames = dt * FPS
      coin.age += dt
      const { object } = coin
      object.visible = coin.age >= 0
      if (coin.age < 0) continue
      coin.velocity.y -= COIN.gravity * FPS * FPS * dt
      coin.velocity.multiplyScalar(Math.pow(1 - COIN.friction, frames))
      object.position.addScaledVector(coin.velocity, dt)
      const ground = this.groundAt(object.position.x, object.position.z)
      if (ground !== undefined && object.position.y < ground && coin.velocity.y < 0) {
        object.position.y = ground
        coin.velocity.y = -coin.velocity.y * COIN.bounce
        coin.velocity.x *= 1 - COIN.groundFriction
        coin.velocity.z *= 1 - COIN.groundFriction
        if (!coin.landed && !this.landedBurst) {
          this.landedBurst = true
          this.onLand()
        }
        coin.landed = true
      }
      const fade = Math.min(1, Math.max(0, (1 - coin.age / coin.life) / (1 - COIN.fadeFrom)))
      if (coin.sprite) {
        const turn = Math.abs(Math.cos(coin.age * coin.spin))
        coin.sprite.scale.set(0.8 * Math.max(0.12, turn), 0.8, 1)
        coin.sprite.material.opacity = fade
      } else {
        object.rotation.y += coin.spin * dt
        object.traverse((o) => {
          const material = (o as Mesh).material as MeshLambertMaterial | undefined
          if (material) material.opacity = fade
        })
      }
    }
    for (const coin of this.coins) {
      if (coin.age < coin.life) continue
      this.root.remove(coin.object)
      coin.object.traverse((o) =>
        ((o as Mesh).material as MeshLambertMaterial | undefined)?.dispose(),
      )
    }
    this.coins = this.coins.filter((c) => c.age < c.life)
  }

  /** Tira todas as moedas (a comemoração corta para o personagem). */
  clear() {
    for (const coin of this.coins) coin.age = Math.max(coin.age, coin.life)
    this.update(0)
  }

  get active() {
    return this.coins.length > 0
  }
}

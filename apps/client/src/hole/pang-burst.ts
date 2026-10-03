/**
 * Pangs saindo da bola na boa tacada: moedas douradas pulando para cima, girando (achatadas
 * de lado, como moeda virando) e sumindo. Sprites com uma moeda desenhada em canvas.
 */
import { CanvasTexture, Group, SRGBColorSpace, Sprite, SpriteMaterial, Vector3 } from 'three'

/** Gravidade das moedas (unidades/s²) e quanto tempo cada uma vive (s). */
const GRAVITY = 30
const LIFE = 1.4

let texture: CanvasTexture | undefined
function coinTexture() {
  if (texture) return texture
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
  texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

interface Coin {
  sprite: Sprite
  velocity: Vector3
  age: number
  spin: number
  size: number
}

export class PangBurst {
  readonly root = new Group()
  private coins: Coin[] = []

  /** Solta `count` moedas em `at` (cena); `scale` = tamanho (unidades) de cada uma. */
  burst(at: Vector3, count: number, scale = 0.8) {
    for (let i = 0; i < count; i++) {
      const material = new SpriteMaterial({
        map: coinTexture(),
        transparent: true,
        depthWrite: false,
      })
      const sprite = new Sprite(material)
      sprite.position.copy(at)
      sprite.renderOrder = 10
      const angle = Math.random() * Math.PI * 2
      const out = 3 + Math.random() * 5
      const velocity = new Vector3(
        Math.cos(angle) * out,
        14 + Math.random() * 10,
        Math.sin(angle) * out,
      )
      const size = scale * (0.8 + Math.random() * 0.4)
      this.coins.push({ sprite, velocity, age: -i * 0.02, spin: 6 + Math.random() * 8, size })
      this.root.add(sprite)
    }
  }

  update(dt: number) {
    for (const coin of this.coins) {
      coin.age += dt
      const { sprite } = coin
      sprite.visible = coin.age >= 0
      if (coin.age < 0) continue
      coin.velocity.y -= GRAVITY * dt
      sprite.position.addScaledVector(coin.velocity, dt)
      // Virando: a largura vai e volta (moeda de lado fica fina).
      const turn = Math.abs(Math.cos(coin.age * coin.spin))
      sprite.scale.set(coin.size * Math.max(0.12, turn), coin.size, 1)
      sprite.material.opacity = Math.min(1, ((LIFE - coin.age) / LIFE) * 3)
    }
    const alive = this.coins.filter((c) => c.age < LIFE)
    for (const coin of this.coins) {
      if (coin.age >= LIFE) {
        this.root.remove(coin.sprite)
        coin.sprite.material.dispose()
      }
    }
    this.coins = alive
  }

  get active() {
    return this.coins.length > 0
  }
}

/**
 * Toca os efeitos do jogo (.seq/.spr, ver spr.ts) na cena: cada partícula é um sprite com a
 * textura do jogo (com quadros de animação, cor e tamanho pela idade, mistura aditiva…) ou
 * um modelo .pet; o rastro (`Tail`) são sprites menores nas posições anteriores. Também
 * calcula a tremida de câmera (`Add_Quake`) e o clarão na tela (`Add_Flash`).
 * Campos ainda ignorados: Dist_Limit, CamOffset, Add_Bubble, Add_Wind, Vol_Core, Lighting.
 */
import {
  AdditiveBlending,
  type Blending,
  Group,
  type Material,
  MultiplyBlending,
  NormalBlending,
  type Object3D,
  Sprite,
  SpriteMaterial,
  SubtractiveBlending,
  type Texture,
  Vector3,
} from 'three'
import { findAsset, tryFetchBytes } from '../hole/assets.ts'
import { loadPetObject } from '../hole/pet-object.ts'
import { TextureLibrary } from '../hole/textures.ts'
import {
  type Argb,
  type Blend,
  curve,
  fadeAt,
  parseSeq,
  parseSpr,
  type SeqDef,
  SPR_FPS,
  type SprDef,
  type Vec3,
} from './spr.ts'

const BLENDING: Record<Blend, Blending> = {
  normal: NormalBlending,
  add: AdditiveBlending,
  multiply: MultiplyBlending,
  invmultiply: SubtractiveBlending,
}
/** Tremida: as intensidades do jogo viram unidades da cena com este fator. */
const QUAKE_SCALE = 0.01
/** Clarão no máximo (branco por cima da tela). */
const FLASH_MAX = 0.7
/** Gravidade de ponto: a "força" do jogo vira unidades por quadro² com este fator. */
const GRAVITY_POINT_SCALE = 0.01
/** Partículas vivas no máximo (proteção contra efeitos enormes). */
const MAX_PARTICLES = 1500

const decoder = new TextDecoder('euc-kr')
const textures = new TextureLibrary('')

async function readText(name: string) {
  const path = await findAsset(name, '')
  const bytes = path && (await tryFetchBytes(path))
  return bytes ? decoder.decode(bytes) : undefined
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const randV = (a: Vec3, b: Vec3) =>
  new Vector3(rand(a[0], b[0]), rand(a[1], b[1]), rand(a[2], b[2]))

interface Spray {
  def: SprDef
  texture: Texture | undefined
  tailTexture: Texture | undefined
  model: Object3D | undefined
}

interface Particle {
  spray: Spray
  object: Object3D
  sprite: Sprite | undefined
  position: Vector3
  velocity: Vector3
  speed0: number
  age: number
  life: number
  size: number
  rotation: number
  spin: number
  frame: number
  origin: Vector3
  tail: { sprites: Sprite[]; history: Vector3[]; next: number }
}

interface Emitter {
  spray: Spray
  origin: Vector3
  velocity: Vector3
  age: number
  emitted: number[]
}

interface Running {
  seq: SeqDef
  at: Vector3
  age: number
  next: number
  emitters: Emitter[]
}

export class EffectSystem {
  readonly root = new Group()
  /** Deslocamento da câmera neste quadro (tremida) e o clarão (0..1). */
  readonly shake = new Vector3()
  flash = 0
  /** Velocidade do tempo dos efeitos (testes: < 1 = câmera lenta). */
  timeScale = 1
  private readonly sprays = new Map<string, Promise<Spray | undefined>>()
  private readonly seqs = new Map<string, Promise<SeqDef | undefined>>()
  private running: Running[] = []
  private particles: Particle[] = []
  private quakes: {
    def: NonNullable<SprDef['quake']>
    age: number
    next: number
    offset: Vector3
  }[] = []
  private flashes: { def: NonNullable<SprDef['flash']>; age: number }[] = []

  /** Carrega uma sequência (e os sprays dela) antes de precisar. */
  preload(seqName: string) {
    void this.seq(seqName)
  }

  /** Toca a sequência `seqName` (arquivo .seq) no ponto `at` da cena. */
  async play(seqName: string, at: Vector3) {
    const seq = await this.seq(seqName)
    if (!seq) return false
    this.running.push({ seq, at: at.clone(), age: 0, next: 0, emitters: [] })
    return true
  }

  private seq(name: string) {
    let seq = this.seqs.get(name)
    if (!seq) {
      seq = readText(name).then(async (text) => {
        if (!text) return undefined
        const def = parseSeq(text)
        await Promise.all(def.events.map((e) => this.spray(e.file)))
        return def
      })
      this.seqs.set(name, seq)
    }
    return seq
  }

  private spray(name: string) {
    let spray = this.sprays.get(name)
    if (!spray) {
      spray = readText(name).then(async (text) => {
        if (!text) return undefined
        const def = parseSpr(text)
        const [texture, tailTexture, model] = await Promise.all([
          def.texture ? textures.get(def.texture.file) : undefined,
          def.tail ? textures.get(def.tail.file) : undefined,
          def.pet ? loadPetObject(def.pet, { center: true }) : undefined,
        ])
        return { def, texture, tailTexture, model }
      })
      this.sprays.set(name, spray)
    }
    return spray
  }

  update(realDt: number) {
    const dt = realDt * this.timeScale
    const ms = dt * 1000
    // Sequências: soltam os sprays na hora marcada.
    for (const run of this.running) {
      run.age += ms
      const events = run.seq.events
      while (run.next < events.length && events[run.next]!.time <= run.age) {
        const e = events[run.next++]!
        void this.sprays.get(e.file)?.then((spray) => {
          if (!spray) return
          run.emitters.push({
            spray,
            origin: run.at.clone().add(new Vector3(e.position[0], e.position[1], -e.position[2])),
            velocity: new Vector3(e.velocity[0], e.velocity[1], -e.velocity[2]),
            age: 0,
            emitted: spray.def.generation.map(() => 0),
          })
          if (spray.def.quake)
            this.quakes.push({ def: spray.def.quake, age: 0, next: 0, offset: new Vector3() })
          if (spray.def.flash) this.flashes.push({ def: spray.def.flash, age: 0 })
        })
      }
      for (const emitter of run.emitters) this.emit(emitter, ms)
    }
    this.running = this.running.filter((r) => r.age < r.seq.stop)
    for (const p of this.particles) this.step(p, dt)
    for (const p of this.particles) if (p.life > 0 && p.age >= p.life) this.remove(p)
    this.particles = this.particles.filter((p) => !(p.life > 0 && p.age >= p.life))
    this.updateQuake(ms)
    this.updateFlash(ms)
  }

  private emit(emitter: Emitter, ms: number) {
    emitter.age += ms
    emitter.origin.addScaledVector(emitter.velocity, (ms / 1000) * SPR_FPS)
    const { def } = emitter.spray
    def.generation.forEach((g, i) => {
      const span = Math.max(1, g.end - g.start)
      const due = Math.min(g.count, Math.floor(((emitter.age - g.start) / span) * g.count) + 1)
      while (emitter.emitted[i]! < due && emitter.age >= g.start) {
        emitter.emitted[i]!++
        if (this.particles.length < MAX_PARTICLES) this.spawn(emitter, g.cone)
      }
    })
  }

  private spawn(emitter: Emitter, cone: number) {
    const { spray } = emitter
    const { def } = spray
    // Onde nasce: caixa ou casca de esfera (num cone para cima).
    let offset: Vector3
    if (def.genPos.sphere) {
      const g = def.genPos
      const r = rand(g.near, g.far)
      const tilt = Math.random() * (g.cone / 2)
      const around = Math.random() * Math.PI * 2
      offset = new Vector3(
        g.center[0] + r * Math.sin(tilt) * Math.cos(around),
        g.center[1] + r * Math.cos(tilt),
        g.center[2] + r * Math.sin(tilt) * Math.sin(around),
      )
    } else offset = randV(def.genPos.min, def.genPos.max)
    offset.z = -offset.z
    // Velocidade: entre a mínima e a máxima, espalhada num cone em volta da direção.
    const velocity = randV(def.velocity[0], def.velocity[1])
    velocity.z = -velocity.z
    if (cone > 0 && velocity.lengthSq() > 0) {
      const speed = velocity.length()
      const axis = velocity.clone().normalize()
      const tilt = Math.random() * (cone / 2)
      const around = Math.random() * Math.PI * 2
      const side = new Vector3(1, 0, 0)
      if (Math.abs(axis.x) > 0.9) side.set(0, 1, 0)
      const u = side.cross(axis).normalize()
      const w = axis.clone().cross(u)
      velocity
        .copy(axis)
        .multiplyScalar(Math.cos(tilt))
        .addScaledVector(u, Math.sin(tilt) * Math.cos(around))
        .addScaledVector(w, Math.sin(tilt) * Math.sin(around))
        .multiplyScalar(speed)
    }
    let object: Object3D
    let sprite: Sprite | undefined
    if (spray.model) {
      object = spray.model.clone()
    } else {
      sprite = this.makeSprite(spray.texture, def.blend)
      object = sprite
    }
    const angle = randV(def.angle[0], def.angle[1])
    const spin = randV(def.rotation[0], def.rotation[1])
    const p: Particle = {
      spray,
      object,
      sprite,
      position: emitter.origin.clone().add(offset),
      velocity,
      speed0: velocity.length(),
      age: 0,
      life: rand(def.life[0], def.life[1]),
      size: rand(def.size[0], def.size[1]),
      rotation: angle.z || angle.x,
      spin: spin.z || spin.x || spin.y,
      frame: Math.round(rand(def.frame[0], def.frame[1])),
      origin: emitter.origin.clone(),
      tail: { sprites: [], history: [], next: 0 },
    }
    if (def.tail && def.tail.length > 0 && spray.tailTexture) {
      for (let i = 0; i < def.tail.length; i++) {
        const t = this.makeSprite(spray.tailTexture, def.tailBlend)
        t.visible = false
        p.tail.sprites.push(t)
        this.root.add(t)
      }
    }
    if (spray.model) object.rotation.set(angle.x, angle.y, angle.z)
    object.position.copy(p.position)
    this.root.add(object)
    this.particles.push(p)
    this.step(p, 0)
  }

  private makeSprite(texture: Texture | undefined, blend: Blend) {
    // Cópia própria (cada partícula mostra o seu quadro); marcada para ir à placa de vídeo.
    const map = texture?.clone()
    if (map) map.needsUpdate = true
    const material = new SpriteMaterial({
      map: map ?? null,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: BLENDING[blend],
    })
    if (!texture) material.visible = false
    const sprite = new Sprite(material)
    sprite.renderOrder = 20
    return sprite
  }

  private step(p: Particle, dt: number) {
    const { def } = p.spray
    const frames = dt * SPR_FPS
    p.age += dt * 1000
    const life = p.life > 0 ? Math.min(1, p.age / p.life) : 0
    // Movimento: gravidade, gravidade de ponto, atrito e a curva de velocidade.
    p.velocity.x += def.gravity[0] * frames
    p.velocity.y += def.gravity[1] * frames
    p.velocity.z -= def.gravity[2] * frames
    if (def.gravityPoint) {
      const g = def.gravityPoint
      const center = p.origin.clone().add(new Vector3(g.center[0], g.center[1], -g.center[2]))
      const to = center.sub(p.position)
      const strength = to.length() <= g.range ? g.strength : g.outside
      if (to.lengthSq() > 1e-6)
        p.velocity.addScaledVector(to.normalize(), strength * GRAVITY_POINT_SCALE * frames)
    }
    if (def.friction) p.velocity.multiplyScalar(Math.pow(1 - def.friction, frames))
    const pace = curve(def.velocityCurve, p.age, 1)
    p.position.addScaledVector(p.velocity, frames * pace)
    if (def.ground && p.position.y < p.origin.y + def.ground.y && p.velocity.y < 0) {
      p.position.y = p.origin.y + def.ground.y
      p.velocity.y = -p.velocity.y * def.ground.bounce
      p.velocity.x *= 1 - def.groundFriction
      p.velocity.z *= 1 - def.groundFriction
    }
    p.rotation += p.spin * frames * curve(def.rotationCurve, life, 1)
    const size = p.size * curve(def.sizeCurve, life, 1)
    const color = fadeAt(def.fade, life)
    p.object.position.copy(p.position)
    if (p.sprite) {
      const material = p.sprite.material
      p.sprite.scale.set(size, size, 1)
      material.rotation = p.rotation
      material.color.setRGB(color[1], color[2], color[3])
      material.opacity = color[0]
      this.setFrame(p, life)
    } else {
      p.object.scale.setScalar(size)
      p.object.rotation.y += p.spin * frames
      p.object.traverse((o) => {
        const m = (o as { material?: Material }).material
        if (m) {
          m.transparent = true
          m.opacity = color[0]
        }
      })
    }
    this.updateTail(p, size, color)
  }

  /** Quadro da textura (folha de quadros: largura/altura de cada um no .spr). */
  private setFrame(p: Particle, life: number) {
    const { def } = p.spray
    const map = p.sprite?.material.map
    const image = map?.image as { width?: number; height?: number } | undefined
    if (!map || !def.texture || !image?.width || !image.height) return
    const cols = Math.max(1, Math.floor(image.width / (def.texture.cellWidth || image.width)))
    const rows = Math.max(1, Math.floor(image.height / (def.texture.cellHeight || image.height)))
    const total = cols * rows
    if (total <= 1) return
    let frame = p.frame
    const f = def.frames
    if (f && life >= f.from && life <= f.to) {
      const steps = Math.floor((p.age - f.from * p.life) / Math.max(1, f.interval))
      const span = Math.abs(f.last - f.first) + 1
      frame = f.first + (steps % span) * Math.sign(f.last - f.first || 1)
    }
    frame = ((frame % total) + total) % total
    map.repeat.set(1 / cols, 1 / rows)
    map.offset.set((frame % cols) / cols, Math.floor(frame / cols) / rows)
  }

  private updateTail(p: Particle, size: number, color: Argb) {
    const tail = p.spray.def.tail
    if (!tail || p.tail.sprites.length === 0) return
    if (p.age >= p.tail.next) {
      p.tail.next = p.age + tail.interval
      p.tail.history.unshift(p.position.clone())
      p.tail.history.length = Math.min(p.tail.history.length, p.tail.sprites.length)
    }
    const width = size * (tail.width / 100)
    p.tail.sprites.forEach((s, i) => {
      const at = p.tail.history[i]
      s.visible = Boolean(at)
      if (!at) return
      const f = (i + 1) / p.tail.sprites.length
      s.position.copy(at)
      s.scale.set(width * (1 - f * 0.5), width * (1 - f * 0.5), 1)
      s.material.color.setRGB(
        color[1] + (tail.end[1] - color[1]) * f,
        color[2] + (tail.end[2] - color[2]) * f,
        color[3] + (tail.end[3] - color[3]) * f,
      )
      s.material.opacity = color[0] + (tail.end[0] - color[0]) * f
    })
  }

  private remove(p: Particle) {
    this.root.remove(p.object)
    for (const s of p.tail.sprites) {
      this.root.remove(s)
      s.material.dispose()
    }
    p.sprite?.material.dispose()
  }

  private updateQuake(ms: number) {
    this.shake.set(0, 0, 0)
    for (const q of this.quakes) {
      q.age += ms
      if (q.age < q.def.start || q.age > q.def.end) continue
      // Sorteia um deslocamento novo a cada intervalo e mantém até o próximo.
      if (q.age >= q.next) {
        q.next = q.age + Math.max(1, q.def.interval)
        const f = (q.age - q.def.start) / Math.max(1, q.def.end - q.def.start)
        const power = q.def.from.map((v, i) => v + (q.def.to[i]! - v) * f)
        q.offset
          .set(
            rand(-power[0]!, power[0]!),
            rand(-power[1]!, power[1]!),
            rand(-power[2]!, power[2]!),
          )
          .multiplyScalar(QUAKE_SCALE)
      }
      this.shake.add(q.offset)
    }
    this.quakes = this.quakes.filter((q) => q.age <= q.def.end)
  }

  private updateFlash(ms: number) {
    this.flash = 0
    for (const f of this.flashes) {
      f.age += ms
      const { start, peak, end } = f.def
      let v = 0
      if (f.age >= start && f.age <= peak) v = peak > start ? (f.age - start) / (peak - start) : 1
      else if (f.age > peak && f.age <= end) v = 1 - (f.age - peak) / Math.max(1, end - peak)
      this.flash = Math.max(this.flash, v * FLASH_MAX)
    }
    this.flashes = this.flashes.filter((f) => f.age <= f.def.end)
  }

  /** Tira tudo (corte de cena). */
  clear() {
    for (const p of this.particles) this.remove(p)
    this.particles = []
    this.running = []
    this.quakes = []
    this.flashes = []
  }
}

/**
 * Vida do cenário: objetos com animação própria (o navio balançando, as lâmpadas) e os
 * bichos de cada buraco (caixas "*type N *pet NPC_….pet *num K" do .gbin).
 *
 * As animações (bater asas, andar, pular) são as dos arquivos do jogo; o caminho que cada
 * bicho faz dentro da caixa dele é código do jogo (não está nos arquivos), então é uma
 * aproximação por tipo, a conferir com o original:
 * - 0 voa (gaivota): circula pela caixa, numa altura dentro dela;
 * - 1 borboleta: passeia devagar e muda de rumo, perto da altura da caixa;
 * - 3 toupeira: sai do chão num ponto da caixa (animação inteira) e some; volta depois;
 * - 4 golfinho: pula da água num ponto da caixa e some; volta depois;
 * - 5 caranguejo: anda de lado pelo chão da caixa, indo e voltando.
 * Partes só da noite (ossos "Night…", janelas acesas) ficam escondidas nos cursos de dia.
 */
import type { HoleData, HoleNpc } from '@pangya/game'
import { readPet, type Pet } from '@pangya/formats'
import {
  AnimationMixer,
  Group,
  LoopOnce,
  LoopRepeat,
  type AnimationAction,
  type AnimationClip,
  type Bone,
  type Scene,
} from 'three'
import { buildAnimatedPet } from '../character/character.ts'
import { findAsset, tryFetchBytes } from './assets.ts'
import { sceneMatrix } from './coords.ts'
import type { TextureLibrary } from './textures.ts'

/** Ajustes dos bichos (unidades do jogo: 3,2 = 1 jarda; segundos). */
export const SCENE_LIFE = {
  /** Gaivota: velocidade e quanto da caixa o círculo ocupa. */
  gull: { speed: 14, fill: 0.8 },
  /** Borboleta: velocidade e de quanto em quanto tempo muda de rumo. */
  butterfly: { speed: 2.5, turnEvery: [1.5, 4] as const },
  /** Caranguejo: velocidade de lado. */
  crab: { speed: 1.6 },
  /** Toupeira e golfinho: espera entre uma aparição e outra. */
  popEvery: [4, 12] as const,
}

const random = (min: number, max: number) => min + Math.random() * (max - min)
const NIGHT_BONE = /night/i
/** Os bichos do jogo olham para −Z (o bico da gaivota): gira meia volta para andar de frente. */
const FACING = Math.PI

interface Animated {
  group: Group
  mixer: AnimationMixer
  clips: Map<string, AnimationClip>
  bones: Map<string, Bone>
}

interface Critter {
  type: number
  npc: HoleNpc
  body: Animated
  /** Estado do movimento (por tipo). */
  t: number
  angle: number
  radius: [number, number]
  center: [number, number, number]
  heading: number
  turnIn: number
  waitIn: number
  action: AnimationAction | undefined
}

export class SceneLife {
  /** Grupo no espaço do Pangya (Z invertido para a cena). */
  private readonly root = new Group()
  private readonly objects: Animated[] = []
  private readonly critters: Critter[] = []
  private readonly pets = new Map<string, Promise<Pet | undefined>>()
  private disposed = false

  constructor(
    private readonly scene: Scene,
    private readonly hole: HoleData,
    private readonly textures: TextureLibrary,
    /** Altura do chão (ou da água) no ponto (x, z) do Pangya. */
    private readonly groundAt: (x: number, z: number) => number | undefined,
  ) {
    this.root.scale.set(1, 1, -1)
    this.root.name = 'vida-do-cenario'
    scene.add(this.root)
  }

  /** Cursos de noite mostram as partes "Night…" (janelas acesas, luzes). */
  private get night() {
    return /moon|night|xmas|hell|luna/i.test(this.hole.ref.round)
  }

  private pet(name: string): Promise<Pet | undefined> {
    const key = name.toLowerCase()
    let pet = this.pets.get(key)
    if (!pet) {
      pet = (async () => {
        const path = await findAsset(name, this.hole.ref.round)
        const bytes = path && (await tryFetchBytes(path))
        return bytes ? readPet(bytes) : undefined
      })().catch(() => undefined)
      this.pets.set(key, pet)
    }
    return pet
  }

  private async build(name: string): Promise<Animated | undefined> {
    const pet = await this.pet(name)
    if (!pet || this.disposed) return undefined
    const built = await buildAnimatedPet(pet, this.textures)
    if (!built) return undefined
    const mixer = new AnimationMixer(built.group)
    return { group: built.group, mixer, clips: built.clips, bones: built.bones }
  }

  /** Monta os objetos animados e os bichos (sem travar o começo do buraco). */
  async load() {
    await Promise.all([
      ...this.hole.objects
        .filter((o) => o.animated)
        .flatMap((object) =>
          object.instances.map(async (matrix) => {
            const item = await this.build(object.model)
            if (!item) return
            // O objeto vai direto na cena, com a matriz do .gbin (já com o Z invertido).
            item.group.matrixAutoUpdate = false
            item.group.matrix.copy(sceneMatrix(matrix))
            this.scene.add(item.group)
            const first = [...item.clips.values()][0]
            if (first) item.mixer.clipAction(first).setLoop(LoopRepeat, Infinity).play()
            item.mixer.setTime(Math.random() * (first?.duration ?? 0))
            this.objects.push(item)
          }),
        ),
      ...this.hole.npcs.flatMap((npc) =>
        Array.from({ length: Math.max(1, npc.count) }, () => this.addCritter(npc)),
      ),
    ])
  }

  private async addCritter(npc: HoleNpc) {
    const body = await this.build(npc.model)
    if (!body || this.disposed) return
    const type = npcType(npc)
    const { min, max } = npc.box
    const center: [number, number, number] = [
      (min[0] + max[0]) / 2,
      random(min[1], max[1]),
      (min[2] + max[2]) / 2,
    ]
    const critter: Critter = {
      type,
      npc,
      body,
      t: Math.random() * 100,
      angle: Math.random() * Math.PI * 2,
      radius: [
        ((max[0] - min[0]) / 2) * SCENE_LIFE.gull.fill * random(0.6, 1),
        ((max[2] - min[2]) / 2) * SCENE_LIFE.gull.fill * random(0.6, 1),
      ],
      center,
      heading: Math.random() * Math.PI * 2,
      turnIn: 0,
      waitIn: random(...SCENE_LIFE.popEvery),
      action: undefined,
    }
    // Começa num ponto qualquer da caixa.
    body.group.position.set(random(min[0], max[0]), center[1], random(min[2], max[2]))
    const clip = body.clips.get('NPC_Default') ?? [...body.clips.values()][0]
    if (clip) {
      critter.action = body.mixer.clipAction(clip)
      if (type === 3 || type === 4) {
        // Aparecem de tempos em tempos.
        critter.action.setLoop(LoopOnce, 1)
        critter.action.clampWhenFinished = true
        body.group.visible = false
      } else {
        critter.action.setLoop(LoopRepeat, Infinity).play()
        body.mixer.setTime(Math.random() * clip.duration)
      }
    }
    this.root.add(body.group)
    this.critters.push(critter)
  }

  update(dt: number) {
    if (dt <= 0) return
    for (const item of this.objects) {
      item.mixer.update(dt)
      if (!this.night) hideNight(item.bones)
    }
    for (const c of this.critters) {
      this.move(c, dt)
      c.body.mixer.update(dt)
      if (!this.night) hideNight(c.body.bones)
    }
  }

  private move(c: Critter, dt: number) {
    const g = c.body.group
    const { min, max } = c.npc.box
    switch (c.type) {
      case 0: {
        // Voa em círculo pela caixa, de frente para onde vai.
        const k = SCENE_LIFE.gull
        const r = Math.max(10, (c.radius[0] + c.radius[1]) / 2)
        c.angle += (k.speed / r) * dt
        g.position.set(
          c.center[0] + Math.cos(c.angle) * c.radius[0],
          c.center[1] + Math.sin(c.angle * 2.3) * 2,
          c.center[2] + Math.sin(c.angle) * c.radius[1],
        )
        g.rotation.y = -c.angle + FACING
        break
      }
      case 1:
      case 5: {
        // Borboleta: passeia e muda de rumo; caranguejo: anda de lado pelo chão.
        const crab = c.type === 5
        c.turnIn -= dt
        if (c.turnIn <= 0) {
          c.heading = crab ? c.heading + Math.PI : Math.random() * Math.PI * 2
          c.turnIn = random(...SCENE_LIFE.butterfly.turnEvery) * (crab ? 1.5 : 1)
        }
        const speed = crab ? SCENE_LIFE.crab.speed : SCENE_LIFE.butterfly.speed
        let x = g.position.x + Math.sin(c.heading) * speed * dt
        let z = g.position.z + Math.cos(c.heading) * speed * dt
        // Bateu na borda da caixa: vira para dentro.
        if (x < min[0] || x > max[0] || z < min[2] || z > max[2]) {
          c.heading = Math.atan2(c.center[0] - g.position.x, c.center[2] - g.position.z)
          x = Math.min(max[0], Math.max(min[0], x))
          z = Math.min(max[2], Math.max(min[2], z))
        }
        const ground = this.groundAt(x, z)
        const y = crab
          ? (ground ?? min[1])
          : Math.max((ground ?? min[1]) + 1.5, c.center[1]) + Math.sin(c.t * 3) * 0.4
        g.position.set(x, y, z)
        g.rotation.y = crab ? c.heading + Math.PI / 2 : c.heading + FACING
        c.t += dt
        break
      }
      case 3:
      case 4: {
        // Toupeira/golfinho: espera, aparece num ponto da caixa, faz a animação e some.
        if (g.visible) {
          const action = c.action
          if (!action || !action.isRunning()) g.visible = false
          break
        }
        c.waitIn -= dt
        if (c.waitIn > 0) break
        c.waitIn = random(...SCENE_LIFE.popEvery)
        const x = random(min[0], max[0])
        const z = random(min[2], max[2])
        g.position.set(x, this.groundAt(x, z) ?? min[1], z)
        g.rotation.y = Math.random() * Math.PI * 2
        g.visible = true
        c.action?.reset().play()
        break
      }
      default:
        break
    }
  }

  dispose() {
    this.disposed = true
    this.root.removeFromParent()
    for (const item of this.objects) item.group.removeFromParent()
  }
}

/** Tipo do bicho pelo comando da caixa ("*type 0"); sem ele, pelo nome do modelo. */
function npcType(npc: HoleNpc) {
  if (npc.type !== undefined) return npc.type
  const m = npc.model.toLowerCase()
  if (/gull|bird|sparrow/.test(m)) return 0
  if (/butterfly/.test(m)) return 1
  if (/mole/.test(m)) return 3
  if (/dolphin|fish/.test(m)) return 4
  return 5
}

function hideNight(bones: Map<string, Bone>) {
  for (const [name, bone] of bones) if (NIGHT_BONE.test(name)) bone.scale.setScalar(0)
}

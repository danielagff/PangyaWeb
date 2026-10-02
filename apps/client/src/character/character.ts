/**
 * Personagem montado como no jogo: esqueleto (.bpet) + animações (.apet) + peças (.mpet).
 *
 * Skinning (mesma conta do pet-source_tools, util.calc_deform_vert_by_mpet_and_bpet_arm):
 * o vértice da peça é guardado no espaço do seu osso principal *do esqueleto da peça*;
 * na pose do personagem ele vale  Σ wᵢ · Bpet[i] · inverso(Mpet[i]) · Mpet[principal] · v.
 * No Three.js isso é um SkinnedMesh com os ossos do .bpet e, por peça, as matrizes
 * inversas inverso(Mpet[i]).
 *
 * Animação: tempo em segundos (30 quadros/s, os "motions" usam quadros); cada osso tem
 * posição, rotação (quaternion x,y,z,w gravado invertido) e escala locais ao pai.
 */
import { boneWorldMatrix, petToSubMeshes, readPet, type Mat4x3, type Pet } from '@pangya/formats'
import {
  AnimationClip,
  AnimationMixer,
  Bone,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LoopOnce,
  LoopRepeat,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  type Object3D,
  Quaternion,
  QuaternionKeyframeTrack,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
  VectorKeyframeTrack,
  type AnimationAction,
  type KeyframeTrack,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { MotionInfo } from './motions.ts'
import { ASSET_BASE, tryFetchBytes } from '../hole/assets.ts'
import { TextureLibrary } from '../hole/textures.ts'

export interface CharacterEntry {
  id: string
  name: string
  skeleton: string
  animations: string | undefined
  parts: Record<string, string[]>
  defaults: string[]
}

let catalog: Promise<CharacterEntry[]> | undefined

/** Personagens encontrados na extração (assets/original/_characters.json). */
export function loadCatalog(): Promise<CharacterEntry[]> {
  catalog ??= fetch(`${ASSET_BASE}/_characters.json`)
    .then((r) => (r.ok ? (r.json() as Promise<CharacterEntry[]>) : []))
    .catch(() => [])
  return catalog
}

const CHOICE_KEY = 'pangyaweb.personagem'

/** Personagem escolhido neste navegador (ou o primeiro do catálogo). */
export async function chosenCharacter(): Promise<string | undefined> {
  const list = await loadCatalog()
  let saved: string | null = null
  try {
    saved = localStorage.getItem(CHOICE_KEY)
  } catch {
    // sem armazenamento
  }
  if (saved === '') return undefined // "sem personagem"
  return list.find((c) => c.id === saved)?.id ?? list[0]?.id
}

export function rememberCharacter(id: string) {
  try {
    localStorage.setItem(CHOICE_KEY, id)
  } catch {
    // sem armazenamento: só não lembra
  }
}

/** <select> com os personagens do catálogo, já com a escolha salva. */
export async function characterSelect(): Promise<HTMLSelectElement> {
  const select = document.createElement('select')
  select.name = 'character'
  const list = await loadCatalog()
  const current = await chosenCharacter()
  select.innerHTML =
    list.map((c) => `<option value="${c.id}">${c.name}</option>`).join('') +
    '<option value="">(sem personagem)</option>'
  select.value = current ?? ''
  select.addEventListener('change', () => rememberCharacter(select.value))
  return select
}

const FPS = 30

/** Matriz 4×3 do Pangya (colunas) → Matrix4. */
const toMatrix4 = (m: Mat4x3) =>
  new Matrix4().set(
    m[0]!,
    m[3]!,
    m[6]!,
    m[9]!,
    m[1]!,
    m[4]!,
    m[7]!,
    m[10]!,
    m[2]!,
    m[5]!,
    m[8]!,
    m[11]!,
    0,
    0,
    0,
    1,
  )

/** Liga cada osso de `pet` ao osso do esqueleto com o mesmo nome (repetidos: em ordem). */
function mapBones(pet: Pet, skeleton: Pet): number[] {
  const byName = new Map<string, number[]>()
  skeleton.bones.forEach((b, i) => byName.set(b.name, [...(byName.get(b.name) ?? []), i]))
  const used = new Map<string, number>()
  return pet.bones.map((b) => {
    const list = byName.get(b.name)
    if (!list) return -1
    const n = used.get(b.name) ?? 0
    used.set(b.name, n + 1)
    return list[Math.min(n, list.length - 1)]!
  })
}

/** Interpola chaves (lerp/slerp) no tempo `t`; sem chaves, devolve undefined. */
function sample<T extends number[]>(
  keys: { time: number; value: T }[],
  t: number,
  mix: (a: T, b: T, f: number) => T,
): T | undefined {
  if (keys.length === 0) return undefined
  if (t <= keys[0]!.time) return keys[0]!.value
  const last = keys[keys.length - 1]!
  if (t >= last.time) return last.value
  let i = 1
  while (keys[i]!.time < t) i++
  const a = keys[i - 1]!
  const b = keys[i]!
  return mix(a.value, b.value, (t - a.time) / (b.time - a.time || 1))
}

const lerp3 = (a: number[], b: number[], f: number) => a.map((v, i) => v + (b[i]! - v) * f)
const slerp4 = (a: number[], b: number[], f: number) => {
  const q = new Quaternion(a[0], a[1], a[2], a[3]).slerp(new Quaternion(b[0], b[1], b[2], b[3]), f)
  return [q.x, q.y, q.z, q.w]
}

/** Um clipe do Three.js por "motion" do .apet, amostrado a 30 quadros/s. */
function buildClips(apet: Pet, skeleton: Pet, rest: { p: Vector3; q: Quaternion; s: Vector3 }[]) {
  const toSkeleton = mapBones(apet, skeleton)
  const clips = new Map<string, AnimationClip>()
  const motions = apet.motions.length
    ? apet.motions
    : [{ name: 'tudo', frameStart: 0, frameEnd: maxFrame(apet), next: '', rootBone: '' }]
  for (const motion of motions) {
    const tracks: KeyframeTrack[] = []
    const frames = Math.max(1, motion.frameEnd - motion.frameStart)
    const times = Array.from({ length: frames + 1 }, (_, f) => f / FPS)
    for (const anim of apet.animations) {
      const bone = toSkeleton[anim.bone] ?? -1
      if (bone < 0) continue
      const base = rest[bone]!
      const at = (f: number) => (motion.frameStart + f) / FPS
      if (anim.position.length) {
        const values = times.flatMap(
          (_, f) => sample(anim.position, at(f), lerp3) ?? base.p.toArray(),
        )
        tracks.push(new VectorKeyframeTrack(`b${bone}.position`, times, values))
      }
      if (anim.rotation.length) {
        const values = times.flatMap((_, f) => {
          const q = sample(anim.rotation, at(f), slerp4)
          // Gravado invertido (conjugado): inverte de volta.
          return q ? [-q[0]!, -q[1]!, -q[2]!, q[3]!] : base.q.toArray()
        })
        tracks.push(new QuaternionKeyframeTrack(`b${bone}.quaternion`, times, values))
      }
      if (anim.scale.length) {
        const values = times.flatMap((_, f) => sample(anim.scale, at(f), lerp3) ?? base.s.toArray())
        tracks.push(new VectorKeyframeTrack(`b${bone}.scale`, times, values))
      }
    }
    clips.set(motion.name, new AnimationClip(motion.name, frames / FPS, tracks))
  }
  return clips
}

const maxFrame = (pet: Pet) =>
  Math.round(
    Math.max(
      0,
      ...pet.animations.flatMap((a) =>
        [...a.position, ...a.rotation, ...a.scale].map((k) => k.time * FPS),
      ),
    ),
  )

async function readFile(path: string, kind: 'bpet' | 'apet' | 'mpet') {
  const bytes = await tryFetchBytes(path)
  if (!bytes) throw new Error(`não encontrado: ${path}`)
  return readPet(bytes, kind)
}

/** Ajustes do personagem em cena (estimativas, a conferir com o jogo). */
export const CHARACTER_TUNING = {
  /**
   * Rotação extra (graus) quando não dá para medir a postura pelo taco (sem taco carregado).
   * Com taco, o personagem é virado e posicionado para a cabeça do taco ficar na bola.
   */
  facingDegrees: 270,
  /** Distância (unidades) do personagem até a bola, para o lado (sem taco). */
  ballDistance: 3.2,
  /** Momento do swing em que o taco acerta a bola (fração da duração). */
  impactAt: 0.55,
}

/**
 * Osso do taco: "Bone01" (filho da mão esquerda; as caixas COLL club/head_wood/head_iron
 * ficam nele em todos os personagens do cliente JP). Senão, a mão.
 */
const CLUB_BONES = [/^bone01$/i, /club/i, /l\s*hand$/i, /r\s*hand$/i]

/**
 * Coloca o personagem de destro ao lado da bola: com taco medido (`addressHead`), gira o
 * corpo para o taco apontar para a bola (à direita, `right`) e recua até a cabeça do taco
 * encostar nela; sem taco, usa `CHARACTER_TUNING`. `groundY` dá a altura do chão.
 */
export function placeAtBall(
  model: CharacterModel,
  ball: Vector3,
  right: Vector3,
  groundY: (at: Vector3) => number,
) {
  const head = model.addressHead
  let at: Vector3
  if (head && Math.hypot(head.x, head.z) > 0.2) {
    const angle = Math.atan2(right.x, right.z) - Math.atan2(head.x, head.z)
    model.root.rotation.y = angle
    const offset = new Vector3(head.x, 0, head.z).applyAxisAngle(new Vector3(0, 1, 0), angle)
    at = ball.clone().sub(offset)
  } else {
    at = ball.clone().addScaledVector(right, -CHARACTER_TUNING.ballDistance)
    model.root.rotation.y =
      Math.atan2(-right.x, -right.z) + (CHARACTER_TUNING.facingDegrees * Math.PI) / 180
  }
  at.y = groundY(at)
  model.root.position.copy(at)
}

/** Texturas e rostos (FANM) de uma peça, para o visualizador. */
export async function readPartInfo(path: string) {
  const bytes = await tryFetchBytes(path)
  if (!bytes) return undefined
  const pet = readPet(bytes, 'mpet')
  return {
    bones: pet.bones.length,
    triangles: pet.triangles.length,
    textures: pet.textures.map((t, i) => ({ name: t.name, files: partTextureNames(pet, i) })),
    faces: pet.faceAnimations,
  }
}

export class CharacterModel {
  /** Nó na cena (posição/rotação); dentro dele o modelo fica no espaço do Pangya. */
  readonly root = new Group()
  private readonly inner = new Group()
  private readonly mixer: AnimationMixer
  private current: AnimationAction | undefined

  private club: { path: string; object: Object3D } | undefined
  /** Esqueleto e texturas, guardados para prender peças depois (taco). */
  private rig!: { pet: Pet; bones: Bone[]; restWorld: Matrix4[]; textures: TextureLibrary }

  /** Movimentos do .apet (nome e quadros), para escolher pelo nome real. */
  motions: MotionInfo[] = []

  /** Cabeça do taco na postura de preparação (espaço de `root`), medida por `address`. */
  addressHead: Vector3 | undefined
  /** Para qual taco/movimento `addressHead` foi medida. */
  addressKey = ''

  private constructor(
    readonly entry: CharacterEntry,
    readonly clips: Map<string, AnimationClip>,
  ) {
    // O Pangya tem Z invertido em relação à cena.
    this.inner.scale.set(1, 1, -1)
    this.root.add(this.inner)
    this.mixer = new AnimationMixer(this.inner)
  }

  get motionNames() {
    return [...this.clips.keys()]
  }

  /** Primeiro movimento cujo nome casa com algum dos padrões (na ordem). */
  findMotion(...patterns: RegExp[]): string | undefined {
    for (const pattern of patterns) {
      const name = this.motionNames.find((n) => pattern.test(n))
      if (name) return name
    }
    return undefined
  }

  /** Texturas que não foram achadas na extração. */
  get missingTextures() {
    return [...this.rig.textures.missing]
  }

  /** Tempo (s) e duração do movimento tocando agora, para a linha do tempo. */
  get time() {
    return this.current?.time ?? 0
  }
  get duration() {
    return this.current?.getClip().duration ?? 0
  }
  get paused() {
    return this.current?.paused ?? false
  }
  set paused(value: boolean) {
    if (this.current) this.current.paused = value
  }
  /** Vai para o instante `t` (s) do movimento atual e aplica a pose. */
  seek(t: number) {
    if (!this.current) return
    this.current.time = Math.max(0, Math.min(t, this.duration))
    this.mixer.update(0)
  }

  /** Movimento tocando agora. */
  get playing() {
    return this.current?.getClip().name
  }

  /** Toca um movimento (a partir de `from` segundos); devolve a duração (s). */
  play(name: string | undefined, loop = true, fade = 0.2, from = 0): number {
    const clip = name ? this.clips.get(name) : undefined
    if (!clip) return 0
    const action = this.mixer.clipAction(clip)
    action.reset()
    action.time = from
    action.setLoop(loop ? LoopRepeat : LoopOnce, Infinity)
    action.clampWhenFinished = !loop
    if (fade <= 0) this.mixer.stopAllAction()
    else if (this.current && this.current !== action)
      action.crossFadeFrom(this.current, fade, false)
    action.play()
    this.current = action
    return clip.duration
  }

  update(dt: number) {
    this.mixer.update(dt)
  }

  /** Ponto mais baixo do taco na pose atual (a cabeça), no espaço de `root`. */
  clubHead(): Vector3 | undefined {
    const object = this.club?.object
    if (!object) return undefined
    this.root.updateMatrixWorld(true)
    const toRoot = this.root.matrixWorld.clone().invert()
    const v = new Vector3()
    let best: Vector3 | undefined
    object.traverse((o) => {
      if (!(o instanceof Mesh)) return
      const position = o.geometry.getAttribute('position')
      if (!position) return
      const m = toRoot.clone().multiply(o.matrixWorld)
      for (let i = 0; i < position.count; i++) {
        o.getVertexPosition(i, v).applyMatrix4(m)
        if (!best || v.y < best.y) best = v.clone()
      }
    })
    return best
  }

  /**
   * Põe o personagem na postura `idle` (sem transição) e mede onde fica a cabeça do taco;
   * é por ela que a cena vira e posiciona o personagem ao lado da bola.
   */
  address(idle: string | undefined) {
    const key = `${this.club?.path ?? ''}|${idle ?? ''}`
    if (idle) {
      this.play(idle, true, 0)
      this.update(0)
    }
    if (key === this.addressKey) return
    this.addressKey = key
    this.addressHead = this.clubHead()
  }

  /**
   * Troca o taco na mão. `.mpet` vira peça com ossos (como as roupas); `.pet` fica preso ao
   * osso da mão direita (nome procurado por padrão — confirmar com o diagnóstico).
   */
  async setClub(path: string | undefined) {
    if (this.club?.path === path) return
    this.club?.object.removeFromParent()
    this.club = undefined
    if (!path) return
    const bytes = await tryFetchBytes(path)
    if (!bytes) return
    const { pet: skeleton, bones, restWorld, textures } = this.rig
    let object: Object3D | undefined
    if (/\.mpet$/i.test(path)) {
      object = await buildPart(readPet(bytes, 'mpet'), skeleton, bones, restWorld, textures)
      if (object) this.inner.add(object)
    } else {
      const pet = readPet(bytes)
      const group = new Group()
      for (const sub of petToSubMeshes(pet)) {
        const g = new BufferGeometry()
        g.setAttribute('position', new Float32BufferAttribute(sub.positions, 3))
        g.setAttribute('normal', new Float32BufferAttribute(sub.normals, 3))
        g.setAttribute('uv', new Float32BufferAttribute(sub.uvs, 2))
        const texture = await textures.get(sub.texture)
        group.add(
          new Mesh(
            g,
            new MeshLambertMaterial({
              ...(texture ? { map: texture } : { color: 0xcccccc }),
              side: DoubleSide,
              alphaTest: 0.5,
            }),
          ),
        )
      }
      let hand = -1
      for (const pattern of CLUB_BONES) {
        hand = skeleton.bones.findIndex((b) => pattern.test(b.name.trim()))
        if (hand >= 0) break
      }
      ;(bones[hand] ?? this.inner).add(group)
      object = group
    }
    if (object) this.club = { path, object }
  }

  static async load(entry: CharacterEntry, parts = entry.defaults): Promise<CharacterModel> {
    const skeletonPet = await readFile(entry.skeleton, 'bpet')
    const apet = entry.animations ? await readFile(entry.animations, 'apet') : undefined
    const folder = entry.skeleton.split('/').slice(-2, -1)[0] ?? ''
    const textures = new TextureLibrary(folder)

    // Ossos do .bpet (nomes únicos "b<i>" para as trilhas de animação).
    const restWorld = skeletonPet.bones.map((_, i) => toMatrix4(boneWorldMatrix(skeletonPet, i)))
    const rest = skeletonPet.bones.map((b) => {
      const p = new Vector3()
      const q = new Quaternion()
      const s = new Vector3()
      toMatrix4(b.matrix).decompose(p, q, s)
      return { p, q, s }
    })
    const bones = skeletonPet.bones.map((_, i) => {
      const bone = new Bone()
      bone.name = `b${i}`
      bone.position.copy(rest[i]!.p)
      bone.quaternion.copy(rest[i]!.q)
      bone.scale.copy(rest[i]!.s)
      return bone
    })
    skeletonPet.bones.forEach((b, i) => {
      const parent = b.parent >= 0 && b.parent < bones.length ? bones[b.parent] : undefined
      if (parent && parent !== bones[i]) parent.add(bones[i]!)
    })

    const clips = apet ? buildClips(apet, skeletonPet, rest) : new Map<string, AnimationClip>()
    const model = new CharacterModel(entry, clips)
    model.rig = { pet: skeletonPet, bones, restWorld, textures }
    model.motions = (apet?.motions ?? []).map(({ name, frameStart, frameEnd }) => ({
      name,
      frameStart,
      frameEnd,
    }))
    for (const [i, b] of skeletonPet.bones.entries()) {
      if (b.parent < 0 || b.parent >= bones.length) model.inner.add(bones[i]!)
    }

    const loaded = await Promise.all(
      parts.map(async (path) => {
        try {
          return { path, pet: await readFile(path, 'mpet') }
        } catch (err) {
          console.warn(`peça ${path}:`, err)
          return undefined
        }
      }),
    )
    for (const item of loaded) {
      if (!item) continue
      const mesh = await buildPart(item.pet, skeletonPet, bones, restWorld, textures)
      if (mesh) model.inner.add(mesh)
    }
    model.root.updateMatrixWorld(true)
    return model
  }
}

/**
 * Textura de um material da peça. Rostos usam o bloco FANM: o material (ex.: "face") aponta
 * para a imagem da expressão (ex.: um .png), que é o arquivo de verdade. Se não achar,
 * tenta o próprio nome do material.
 */
export function partTextureNames(pet: Pet, textureIndex: number): string[] {
  const name = pet.textures[textureIndex]?.name
  if (!name) return []
  const lower = name.toLowerCase()
  const faces = pet.faceAnimations
    .filter((f) => f.material.toLowerCase() === lower && f.name)
    .map((f) => f.name)
  return [...faces, name]
}

async function partTexture(pet: Pet, textureIndex: number, textures: TextureLibrary) {
  for (const name of partTextureNames(pet, textureIndex)) {
    const texture = await textures.get(name)
    if (texture) return texture
  }
  return undefined
}

/** Uma peça (.mpet) como SkinnedMesh presa aos ossos do personagem. */
async function buildPart(
  pet: Pet,
  skeletonPet: Pet,
  bones: Bone[],
  restWorld: Matrix4[],
  textures: TextureLibrary,
) {
  const toSkeleton = mapBones(pet, skeletonPet)
  const partWorld = pet.bones.map((_, i) => toMatrix4(boneWorldMatrix(pet, i)))
  const index = (bone: number) => Math.max(0, toSkeleton[bone] ?? 0)

  // Inversas: ossos usados pela peça com a pose de repouso *da peça*; o resto, a do .bpet.
  const inverses = restWorld.map((m) => m.clone().invert())
  pet.bones.forEach((_, j) => {
    const i = toSkeleton[j]
    if (i !== undefined && i >= 0) inverses[i] = partWorld[j]!.clone().invert()
  })

  const groups = Map.groupBy(
    pet.triangles.map((_, i) => i),
    (i) => pet.triangleTexture[i] ?? -1,
  )
  const geometries: BufferGeometry[] = []
  const materials: MeshLambertMaterial[] = []
  for (const [textureIndex, triangles] of groups) {
    const n = triangles.length * 3
    const positions = new Float32Array(n * 3)
    const normals = new Float32Array(n * 3)
    const uvs = new Float32Array(n * 2)
    const skinIndex = new Uint16Array(n * 4)
    const skinWeight = new Float32Array(n * 4)
    const p = new Vector3()
    let w = 0
    for (const t of triangles) {
      for (const corner of pet.triangles[t]!) {
        const v = pet.vertices[corner.index]!
        p.set(v.x, v.y, v.z).applyMatrix4(partWorld[v.mainBone] ?? new Matrix4())
        positions.set([p.x, p.y, p.z], w * 3)
        normals.set(corner.normal, w * 3)
        uvs.set(corner.uv, w * 2)
        v.bones.slice(0, 4).forEach((bone, k) => {
          skinIndex[w * 4 + k] = index(bone)
          skinWeight[w * 4 + k] = v.weights[k] ?? 0
        })
        w++
      }
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(positions, 3))
    g.setAttribute('normal', new Float32BufferAttribute(normals, 3))
    g.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    g.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndex, 4))
    g.setAttribute('skinWeight', new Float32BufferAttribute(skinWeight, 4))
    geometries.push(g)
    const texture = await partTexture(pet, textureIndex, textures)
    materials.push(
      new MeshLambertMaterial({
        ...(texture ? { map: texture } : { color: 0xd8c0a8 }),
        side: DoubleSide,
        alphaTest: 0.5,
      }),
    )
  }
  if (geometries.length === 0) return undefined
  const geometry = mergeGeometries(geometries, true)
  if (!geometry) return undefined
  const mesh = new SkinnedMesh(geometry, materials)
  mesh.frustumCulled = false
  mesh.bind(new Skeleton(bones, inverses), new Matrix4())
  return mesh
}

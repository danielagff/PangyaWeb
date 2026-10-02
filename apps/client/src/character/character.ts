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
import { boneWorldMatrix, readPet, type Mat4x3, type Pet } from '@pangya/formats'
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
  MeshLambertMaterial,
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
  /** Rotação extra (graus) se o modelo não olhar para +Z no espaço do Pangya. */
  facingDegrees: 0,
  /** Distância (unidades) do personagem até a bola, para o lado. */
  ballDistance: 3.2,
  /** Momento do swing em que o taco acerta a bola (fração da duração). */
  impactAt: 0.55,
}

export class CharacterModel {
  /** Nó na cena (posição/rotação); dentro dele o modelo fica no espaço do Pangya. */
  readonly root = new Group()
  private readonly inner = new Group()
  private readonly mixer: AnimationMixer
  private current: AnimationAction | undefined

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

  /** Toca um movimento; devolve a duração (s). */
  play(name: string | undefined, loop = true, fade = 0.2): number {
    const clip = name ? this.clips.get(name) : undefined
    if (!clip) return 0
    const action = this.mixer.clipAction(clip)
    action.reset()
    action.setLoop(loop ? LoopRepeat : LoopOnce, Infinity)
    action.clampWhenFinished = !loop
    if (this.current && this.current !== action) action.crossFadeFrom(this.current, fade, false)
    action.play()
    this.current = action
    return clip.duration
  }

  update(dt: number) {
    this.mixer.update(dt)
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
    const texture = await textures.get(pet.textures[textureIndex]?.name)
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

/**
 * Câmeras animadas do jogo (data/camera_path/<personagem>_cam.apet): um "esqueleto" com
 * DummyRoot → Camera01, no espaço do personagem, com um movimento por cena — cada
 * comemoração tem 4 versões (`버디승리포즈_01` … `_04`), cada uma em pedaços seguidos (`-1`,
 * `-2`) e um quadro final parado (`…끝`). Feitas junto com a pose do personagem (mesma
 * duração), para tocar ao mesmo tempo.
 *
 * Orientação (conferida com os arquivos reais): a rotação é gravada invertida, como nos
 * ossos; a câmera olha pelo −Y do osso e o "para cima" é o +Z.
 */
import type { Pet, PetKey3, PetKeyQuat } from '@pangya/formats'
import { Quaternion, Vector3 } from 'three'

/** Quadros por segundo das animações do jogo. */
export const CAMERA_PATH_FPS = 30
/**
 * Abertura vertical da lente (graus) nas câmeras animadas: a padrão do Direct3D (π/4), que
 * bate com o enquadramento do vídeo do jogo (45° na horizontal fechava demais).
 */
export const CAMERA_PATH_FOV = 45

export interface CameraPose {
  /** No espaço do personagem (Pangya, antes do Z invertido da cena). */
  position: Vector3
  forward: Vector3
  up: Vector3
}

export interface CameraSegment {
  name: string
  /** Quadros (30/s) do começo e do fim (o quadro parado "…끝"). */
  start: number
  end: number
}

function sample3(keys: PetKey3[], t: number): Vector3 | undefined {
  if (keys.length === 0) return undefined
  let i = 0
  while (i < keys.length - 1 && keys[i + 1]!.time <= t) i++
  const a = keys[i]!
  const b = keys[Math.min(i + 1, keys.length - 1)]!
  const f = b.time > a.time ? Math.min(1, Math.max(0, (t - a.time) / (b.time - a.time))) : 0
  return new Vector3(...a.value).lerp(new Vector3(...b.value), f)
}

function sampleQuat(keys: PetKeyQuat[], t: number): Quaternion | undefined {
  if (keys.length === 0) return undefined
  let i = 0
  while (i < keys.length - 1 && keys[i + 1]!.time <= t) i++
  const a = keys[i]!
  const b = keys[Math.min(i + 1, keys.length - 1)]!
  const f = b.time > a.time ? Math.min(1, Math.max(0, (t - a.time) / (b.time - a.time))) : 0
  // Gravado invertido (conjugado), como nos ossos dos personagens.
  const qa = new Quaternion(-a.value[0], -a.value[1], -a.value[2], a.value[3])
  const qb = new Quaternion(-b.value[0], -b.value[1], -b.value[2], b.value[3])
  return qa.slerp(qb, f)
}

export class CameraPath {
  private readonly root: { position: PetKey3[]; rotation: PetKeyQuat[] } | undefined
  private readonly camera: { position: PetKey3[]; rotation: PetKeyQuat[] } | undefined

  constructor(readonly pet: Pet) {
    const track = (name: string) => {
      const bone = pet.bones.findIndex((b) => b.name.trim() === name)
      return pet.animations.find((a) => a.bone === bone)
    }
    this.root = track('DummyRoot')
    this.camera = track('Camera01')
  }

  /**
   * Trecho de uma cena: `name_0N` (N sorteado entre as versões que existirem, ou `variant`)
   * até o começo de `name_0N끝`. Sem versões numeradas, `name` até `name끝`.
   */
  segment(name: string, random: () => number = Math.random): CameraSegment | undefined {
    const byName = new Map(this.pet.motions.map((m) => [m.name, m]))
    const versions = [1, 2, 3, 4, 5, 6, 7, 8, 9]
      .map((n) => `${name}_0${n}`)
      .filter((n) => byName.has(n))
    const pick = versions.length ? versions[Math.floor(random() * versions.length)]! : name
    const first = byName.get(pick)
    if (!first || !this.camera) return undefined
    const last = byName.get(`${pick}끝`)
    return { name: pick, start: first.frameStart, end: last?.frameStart ?? first.frameEnd }
  }

  /** Câmera no quadro `frame` (pode ser fracionário). */
  pose(frame: number): CameraPose | undefined {
    if (!this.camera) return undefined
    const t = frame / CAMERA_PATH_FPS
    const rootPosition = (this.root && sample3(this.root.position, t)) ?? new Vector3()
    const rootRotation = (this.root && sampleQuat(this.root.rotation, t)) ?? new Quaternion()
    const local = sample3(this.camera.position, t) ?? new Vector3()
    const turn = sampleQuat(this.camera.rotation, t) ?? new Quaternion()
    const rotation = rootRotation.clone().multiply(turn)
    return {
      position: local.applyQuaternion(rootRotation).add(rootPosition),
      forward: new Vector3(0, -1, 0).applyQuaternion(rotation),
      up: new Vector3(0, 0, 1).applyQuaternion(rotation),
    }
  }
}

/** "data/avatar/a_azer/a_def.bpet" → "a_def_cam.apet" (o arquivo de câmeras do personagem). */
export function cameraPathName(skeleton: string) {
  const base = skeleton
    .split('/')
    .pop()!
    .replace(/\.bpet$/i, '')
  return `${base}_cam.apet`
}

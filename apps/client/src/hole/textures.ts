import { readDds } from '@pangya/formats'
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  type Texture,
} from 'three'
import { findAsset, tryFetchBytes } from './assets.ts'

interface Rgba {
  width: number
  height: number
  rgba: Uint8Array
}

const stem = (name: string) => name.replace(/\.[^.]+$/, '')

/**
 * Nomes candidatos para uma textura do .pet. O jogo grava o nome com extensão, às vezes
 * com prefixo de material (ex.: "]2#_blue_tree10.dds" = transparente); como o
 * GhostMapEditor, tenta o nome exato, depois outras extensões e por fim sem o prefixo.
 */
export function textureCandidates(name: string): string[] {
  const names = [name]
  const bare = name.replace(/^[^a-z0-9]*\d*#_/i, '')
  if (bare !== name) names.push(bare)
  const out: string[] = []
  for (const n of names) {
    out.push(n)
    for (const ext of ['.dds', '.jpg', '.png', '.bmp', '.tga']) out.push(stem(n) + ext)
  }
  return [...new Set(out.map((n) => n.toLowerCase()))]
}

/** Imagem comum (jpg/png/bmp) → RGBA, linha 0 = topo, opcionalmente redimensionada. */
async function decodeImage(bytes: Uint8Array, size?: { width: number; height: number }) {
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart]))
  const width = size?.width ?? bitmap.width
  const height = size?.height ?? bitmap.height
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')!
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const data = context.getImageData(0, 0, width, height).data
  return { width, height, rgba: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) }
}

async function decode(path: string, bytes: Uint8Array): Promise<Rgba> {
  return path.toLowerCase().endsWith('.dds') ? readDds(bytes) : decodeImage(bytes)
}

/** Texturas do curso, carregadas sob demanda e guardadas por nome. */
export class TextureLibrary {
  private readonly cache = new Map<string, Promise<Texture | undefined>>()
  readonly missing = new Set<string>()
  loaded = 0

  constructor(
    private readonly round: string,
    private readonly anisotropy = 4,
  ) {}

  get(name: string | undefined): Promise<Texture | undefined> {
    if (!name) return Promise.resolve(undefined)
    const key = name.toLowerCase()
    let texture = this.cache.get(key)
    if (!texture) {
      texture = this.load(name).catch((err: unknown) => {
        console.warn(`textura ${name}:`, err)
        return undefined
      })
      this.cache.set(key, texture)
    }
    return texture
  }

  /** Imagem decodificada (RGBA) de um arquivo do curso, ou undefined. */
  async image(name: string): Promise<Rgba | undefined> {
    for (const candidate of textureCandidates(name)) {
      const path = await findAsset(candidate, this.round)
      if (!path) continue
      const bytes = await tryFetchBytes(path)
      if (bytes) return decode(path, bytes)
    }
    return undefined
  }

  private async load(name: string): Promise<Texture | undefined> {
    const image = await this.image(name)
    if (!image) {
      this.missing.add(name)
      return undefined
    }
    // Máscara de transparência opcional "<nome>_mask.png" (ou .jpg, como nos efeitos): o
    // vermelho vira o alfa.
    const maskPath =
      (await findAsset(`${stem(name)}_mask.png`, this.round)) ??
      (await findAsset(`${stem(name)}_mask.jpg`, this.round))
    const maskBytes = maskPath ? await tryFetchBytes(maskPath) : undefined
    if (maskBytes) {
      const mask = await decodeImage(maskBytes, image)
      for (let i = 0; i < image.width * image.height; i++) image.rgba[i * 4 + 3] = mask.rgba[i * 4]!
    }
    const texture = new DataTexture(image.rgba, image.width, image.height, RGBAFormat)
    // As UVs do jogo têm origem no topo, igual às linhas da imagem: sem flipY.
    texture.flipY = false
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.generateMipmaps = true
    texture.minFilter = LinearMipmapLinearFilter
    texture.magFilter = LinearFilter
    texture.anisotropy = this.anisotropy
    texture.colorSpace = SRGBColorSpace
    texture.name = name
    texture.needsUpdate = true
    this.loaded++
    return texture
  }
}

/** Cor média de uma imagem (para o topo/fundo do céu). */
export function averageColor(image: Rgba): [number, number, number] {
  let r = 0
  let g = 0
  let b = 0
  const n = image.width * image.height
  for (let i = 0; i < n; i++) {
    r += image.rgba[i * 4]!
    g += image.rgba[i * 4 + 1]!
    b += image.rgba[i * 4 + 2]!
  }
  return [r / n / 255, g / n / 255, b / n / 255]
}

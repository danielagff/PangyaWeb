// Leitor de texturas .dds (DirectDraw Surface), formato usado pelo Pangya.
// Decodifica para RGBA 8 bits em software (sem depender de extensões S3TC da GPU):
// DXT1/DXT3/DXT5 e formatos sem compressão de 16/24/32 bits descritos por máscaras.
// Layout segundo a documentação da Microsoft e o dds_loader.cpp do GhostMapEditor.

export interface DdsImage {
  width: number
  height: number
  /** Formato original, ex.: "DXT1", "DXT5", "RGB32". */
  format: string
  /** Pixels RGBA, linha 0 = topo da imagem (mesma origem das UVs do jogo). */
  rgba: Uint8Array
}

const DDPF_ALPHAPIXELS = 0x1
const DDPF_FOURCC = 0x4
const DDPF_RGB = 0x40
const DDPF_LUMINANCE = 0x20000
const HEADER_SIZE = 128

/** Cor 5:6:5 → [r, g, b] em 8 bits. */
function rgb565(c: number): [number, number, number] {
  const r = (c >> 11) & 0x1f
  const g = (c >> 5) & 0x3f
  const b = c & 0x1f
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)]
}

/** Bloco de cor DXT (8 bytes) → 16 cores RGBA. `dxt1` permite o modo de 3 cores + transparente. */
function decodeColorBlock(view: DataView, at: number, dxt1: boolean, out: Uint8Array) {
  const c0 = view.getUint16(at, true)
  const c1 = view.getUint16(at + 2, true)
  const bits = view.getUint32(at + 4, true)
  const a = rgb565(c0)
  const b = rgb565(c1)
  const palette = [
    [...a, 255],
    [...b, 255],
    [0, 0, 0, 255],
    [0, 0, 0, 255],
  ]
  if (c0 > c1 || !dxt1) {
    palette[2] = [0, 1, 2].map((i) => ((2 * a[i]! + b[i]!) / 3) | 0).concat(255)
    palette[3] = [0, 1, 2].map((i) => ((a[i]! + 2 * b[i]!) / 3) | 0).concat(255)
  } else {
    palette[2] = [0, 1, 2].map((i) => ((a[i]! + b[i]!) / 2) | 0).concat(255)
    palette[3] = [0, 0, 0, 0]
  }
  for (let p = 0; p < 16; p++) out.set(palette[(bits >>> (p * 2)) & 3]!, p * 4)
}

/** Alfa explícito do DXT3: 4 bits por pixel. */
function decodeAlphaDxt3(bytes: Uint8Array, at: number, out: Uint8Array) {
  for (let p = 0; p < 16; p++) {
    const nibble = (bytes[at + (p >> 1)]! >> ((p & 1) * 4)) & 0xf
    out[p * 4 + 3] = nibble * 17
  }
}

/** Alfa interpolado do DXT5: 2 referências + índices de 3 bits. */
function decodeAlphaDxt5(bytes: Uint8Array, at: number, out: Uint8Array) {
  const a0 = bytes[at]!
  const a1 = bytes[at + 1]!
  const table = [a0, a1]
  if (a0 > a1) for (let i = 1; i < 7; i++) table.push((((7 - i) * a0 + i * a1) / 7) | 0)
  else {
    for (let i = 1; i < 5; i++) table.push((((5 - i) * a0 + i * a1) / 5) | 0)
    table.push(0, 255)
  }
  // 48 bits de índices, little-endian.
  let bits = 0n
  for (let i = 5; i >= 0; i--) bits = (bits << 8n) | BigInt(bytes[at + 2 + i]!)
  for (let p = 0; p < 16; p++) out[p * 4 + 3] = table[Number((bits >> BigInt(p * 3)) & 7n)]!
}

function decodeDxt(bytes: Uint8Array, offset: number, w: number, h: number, kind: 1 | 3 | 5) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const blockSize = kind === 1 ? 8 : 16
  const bw = Math.max(1, (w + 3) >> 2)
  const bh = Math.max(1, (h + 3) >> 2)
  if (offset + bw * bh * blockSize > bytes.byteLength) throw new Error('.dds truncado')
  const rgba = new Uint8Array(w * h * 4)
  const block = new Uint8Array(64)
  let at = offset
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++, at += blockSize) {
      const colorAt = kind === 1 ? at : at + 8
      decodeColorBlock(view, colorAt, kind === 1, block)
      if (kind === 3) decodeAlphaDxt3(bytes, at, block)
      if (kind === 5) decodeAlphaDxt5(bytes, at, block)
      for (let py = 0; py < 4; py++) {
        const y = by * 4 + py
        if (y >= h) break
        for (let px = 0; px < 4; px++) {
          const x = bx * 4 + px
          if (x >= w) break
          rgba.set(block.subarray((py * 4 + px) * 4, (py * 4 + px) * 4 + 4), (y * w + x) * 4)
        }
      }
    }
  }
  return rgba
}

/** Extrai um canal de `value` pela máscara e escala para 8 bits. */
function channel(value: number, mask: number): number {
  if (mask === 0) return -1
  const shift = 31 - Math.clz32(mask & -mask) // posição do bit mais baixo
  const max = mask >>> shift
  return Math.round((((value & mask) >>> shift) * 255) / max)
}

function decodeMasked(bytes: Uint8Array, offset: number, w: number, h: number, pf: PixelFormat) {
  const bpp = pf.bitCount / 8
  if (![1, 2, 3, 4].includes(bpp)) throw new Error(`.dds com ${pf.bitCount} bits por pixel`)
  if (offset + w * h * bpp > bytes.byteLength) throw new Error('.dds truncado')
  const rgba = new Uint8Array(w * h * 4)
  const hasAlpha = (pf.flags & DDPF_ALPHAPIXELS) !== 0 && pf.aMask !== 0
  const luminance = (pf.flags & DDPF_LUMINANCE) !== 0
  for (let i = 0; i < w * h; i++) {
    let v = 0
    for (let k = bpp - 1; k >= 0; k--) v = v * 256 + bytes[offset + i * bpp + k]!
    if (luminance) {
      const l = channel(v, pf.rMask)
      rgba.set([l, l, l], i * 4)
    } else {
      rgba[i * 4] = channel(v, pf.rMask)
      rgba[i * 4 + 1] = channel(v, pf.gMask)
      rgba[i * 4 + 2] = channel(v, pf.bMask)
    }
    rgba[i * 4 + 3] = hasAlpha ? channel(v, pf.aMask) : 255
  }
  return rgba
}

interface PixelFormat {
  flags: number
  fourCC: string
  bitCount: number
  rMask: number
  gMask: number
  bMask: number
  aMask: number
}

/** Decodifica o primeiro nível (maior) de mipmap de um .dds. */
export function readDds(bytes: Uint8Array): DdsImage {
  if (bytes.byteLength < HEADER_SIZE) throw new Error('.dds pequeno demais')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const magic = String.fromCharCode(...bytes.subarray(0, 4))
  if (magic !== 'DDS ' || view.getUint32(4, true) !== 124) {
    throw new Error('não é um .dds (falta o magic "DDS ")')
  }
  const height = view.getUint32(12, true)
  const width = view.getUint32(16, true)
  if (width === 0 || height === 0 || width > 16384 || height > 16384) {
    throw new Error(`.dds com tamanho inválido ${width}x${height}`)
  }
  const pf: PixelFormat = {
    flags: view.getUint32(80, true),
    fourCC: String.fromCharCode(...bytes.subarray(84, 88)),
    bitCount: view.getUint32(88, true),
    rMask: view.getUint32(92, true),
    gMask: view.getUint32(96, true),
    bMask: view.getUint32(100, true),
    aMask: view.getUint32(104, true),
  }
  if (pf.flags & DDPF_FOURCC) {
    const kind = ({ DXT1: 1, DXT2: 3, DXT3: 3, DXT4: 5, DXT5: 5 } as const)[pf.fourCC as 'DXT1']
    if (!kind) throw new Error(`.dds com compressão não suportada: ${pf.fourCC}`)
    return {
      width,
      height,
      format: pf.fourCC,
      rgba: decodeDxt(bytes, HEADER_SIZE, width, height, kind),
    }
  }
  if (pf.flags & (DDPF_RGB | DDPF_LUMINANCE)) {
    const format = `${pf.flags & DDPF_LUMINANCE ? 'L' : 'RGB'}${pf.bitCount}`
    return { width, height, format, rgba: decodeMasked(bytes, HEADER_SIZE, width, height, pf) }
  }
  throw new Error(`.dds com formato de pixel desconhecido (flags 0x${pf.flags.toString(16)})`)
}

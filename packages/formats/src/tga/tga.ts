/**
 * Imagens TGA (a interface do jogo usa muito): tipos 2 (cores sem compressão), 3 (cinza),
 * 10 e 11 (os mesmos com RLE), 24 ou 32 bits (BGR/BGRA) ou 8 bits de cinza. Devolve RGBA com
 * a linha 0 no topo (o bit 5 do descritor diz se a imagem já vem de cima para baixo).
 */
export interface TgaImage {
  width: number
  height: number
  rgba: Uint8Array
}

export function readTga(bytes: Uint8Array): TgaImage {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const idLength = bytes[0]!
  const colorMapType = bytes[1]!
  const type = bytes[2]!
  const colorMapLength = view.getUint16(5, true)
  const colorMapEntry = bytes[7]!
  const width = view.getUint16(12, true)
  const height = view.getUint16(14, true)
  const bpp = bytes[16]!
  const descriptor = bytes[17]!
  if (![2, 3, 10, 11].includes(type)) throw new Error(`TGA tipo ${type} não suportado`)
  if (![8, 24, 32].includes(bpp)) throw new Error(`TGA com ${bpp} bits não suportado`)
  const size = bpp / 8
  let offset = 18 + idLength + (colorMapType ? colorMapLength * Math.ceil(colorMapEntry / 8) : 0)
  const pixels = new Uint8Array(width * height * size)
  if (type === 2 || type === 3) {
    pixels.set(bytes.subarray(offset, offset + pixels.length))
  } else {
    // RLE: cabeçalho de pacote (bit 7 = repetição), depois 1 pixel ou n pixels.
    let at = 0
    while (at < pixels.length && offset < bytes.length) {
      const header = bytes[offset++]!
      const count = (header & 0x7f) + 1
      if (header & 0x80) {
        const pixel = bytes.subarray(offset, offset + size)
        offset += size
        for (let i = 0; i < count && at < pixels.length; i++, at += size) pixels.set(pixel, at)
      } else {
        const run = bytes.subarray(offset, offset + count * size)
        offset += count * size
        pixels.set(run.subarray(0, Math.min(run.length, pixels.length - at)), at)
        at += run.length
      }
    }
  }
  const topDown = (descriptor & 0x20) !== 0
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    const source = topDown ? y : height - 1 - y
    for (let x = 0; x < width; x++) {
      const s = (source * width + x) * size
      const d = (y * width + x) * 4
      if (size === 1) {
        rgba[d] = rgba[d + 1] = rgba[d + 2] = pixels[s]!
        rgba[d + 3] = 255
      } else {
        rgba[d] = pixels[s + 2]!
        rgba[d + 1] = pixels[s + 1]!
        rgba[d + 2] = pixels[s]!
        rgba[d + 3] = size === 4 ? pixels[s + 3]! : 255
      }
    }
  }
  return { width, height, rgba }
}

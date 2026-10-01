// Descompressão LZ77 dos .pak (janela de 4 KB, cópias de 2 a 17 bytes) e a variante
// "LZ77-2" com máscara e cabeçalhos ofuscados.
// Portado de SuperSS-Dev (https://github.com/Acrisio-Filho/SuperSS-Dev), "Tools/lzpak.cpp"
// Copyright (c) 2021 Acrisio Fragoso Vieira Filho — Licença MIT

const LZ772_KEYS = [0xff21, 0x834f, 0x675f, 0x34, 0xf237, 0x815f, 0x4765, 0x233]

function decompress(source: Uint8Array, size: number, obfuscated: boolean): Uint8Array {
  const out = new Uint8Array(size)
  let s = 0
  let d = 0

  while (s < source.length && d < size) {
    const rawMask = source[s++]!
    let mask = obfuscated ? rawMask ^ 0xc8 : rawMask

    for (let bit = 0; bit < 8 && d < size && s < source.length; bit++) {
      if (mask & 1) {
        if (s + 2 > source.length) throw new Error('LZ77: fim inesperado dos dados')
        let head = source[s]! | (source[s + 1]! << 8)
        s += 2
        if (obfuscated) head ^= LZ772_KEYS[(rawMask >> 3) & 7]!
        const offset = head & 0xfff
        const length = 2 + (head >> 12)
        if (offset > d || offset === 0 || d + length > size) {
          throw new Error(`LZ77: referência inválida (offset ${offset}, posição ${d})`)
        }
        // Cópia byte a byte: a origem pode sobrepor o destino.
        for (let i = 0; i < length; i++, d++) out[d] = out[d - offset]!
      } else {
        out[d++] = source[s++]!
      }
      mask >>= 1
    }
  }
  if (d !== size) throw new Error(`LZ77: esperado ${size} bytes, obtido ${d}`)
  return out
}

export const lz77Decompress = (source: Uint8Array, size: number) => decompress(source, size, false)
export const lz772Decompress = (source: Uint8Array, size: number) => decompress(source, size, true)

// XTEA usado nos índices dos .pak (16 rodadas, delta inicial próprio do Pangya).
// Portado de SuperSS-Dev (https://github.com/Acrisio-Filho/SuperSS-Dev), "Tools/lzpak.cpp"
// Copyright (c) 2021 Acrisio Fragoso Vieira Filho — Licença MIT

export type XteaKey = readonly [number, number, number, number]

/** Chaves por região do cliente. */
export const PAK_KEYS = {
  gb: [0x03f607a9, 0x036f5a3e, 0x011002b4, 0x04ab00ea],
  th: [0x050ad33b, 0x00baff09, 0x0452ffda, 0x02cb4422],
  jp: [0x020a5fd4, 0x01eebdff, 0x02b3c6a0, 0x04f6a3e1],
  kr: [0x0485b576, 0x05148e02, 0x05141d96, 0x028fa9d6],
  id: [0x01640db7, 0x01455a9b, 0x027f1ab7, 0x05918b54],
  eu: [0x01e986d8, 0x05818479, 0x03d2b0bb, 0x02c9b030],
} as const satisfies Record<string, XteaKey>

export type PakRegion = keyof typeof PAK_KEYS

const STEP = 0x61c88647
const DECRYPT_START = 0xe3779b90

const mix = (v: number) => ((((v << 4) ^ (v >>> 5)) >>> 0) + v) >>> 0

/** Decifra um bloco de 64 bits dado como duas palavras little-endian [v0, v1]. */
export function xteaDecrypt(key: XteaKey, v0: number, v1: number): [number, number] {
  let delta = DECRYPT_START
  for (let i = 0; i < 16; i++) {
    v1 = (v1 - ((mix(v0) ^ ((delta + key[(delta >>> 11) & 3]!) >>> 0)) >>> 0)) >>> 0
    delta = (delta + STEP) >>> 0
    v0 = (v0 - ((mix(v1) ^ ((delta + key[delta & 3]!) >>> 0)) >>> 0)) >>> 0
  }
  return [v0, v1]
}

export function xteaEncrypt(key: XteaKey, v0: number, v1: number): [number, number] {
  let delta = 0
  for (let i = 0; i < 16; i++) {
    v0 = (v0 + ((mix(v1) ^ ((delta + key[delta & 3]!) >>> 0)) >>> 0)) >>> 0
    delta = (delta - STEP) >>> 0
    v1 = (v1 + ((mix(v0) ^ ((delta + key[(delta >>> 11) & 3]!) >>> 0)) >>> 0)) >>> 0
  }
  return [v0, v1]
}

/** Decifra (ou cifra) um buffer em blocos de 8 bytes, no lugar. */
export function xteaBlocks(key: XteaKey, bytes: Uint8Array, encrypt = false): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let i = 0; i + 8 <= bytes.byteLength; i += 8) {
    const fn = encrypt ? xteaEncrypt : xteaDecrypt
    const [a, b] = fn(key, view.getUint32(i, true), view.getUint32(i + 4, true))
    view.setUint32(i, a, true)
    view.setUint32(i + 4, b, true)
  }
}

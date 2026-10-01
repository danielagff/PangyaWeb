// Leitor dos pacotes .pak do cliente.
// Formato documentado em SuperSS-Dev (https://github.com/Acrisio-Filho/SuperSS-Dev), "Tools/lzpak.cpp"
// Copyright (c) 2021 Acrisio Fragoso Vieira Filho — Licença MIT

import { lz772Decompress, lz77Decompress } from './lz77.ts'
import { PAK_KEYS, xteaBlocks, xteaDecrypt, type PakRegion, type XteaKey } from './xtea.ts'

/** Rodapé: u32 offset do índice, u32 número de entradas, u8 versão. */
export const PAK_FOOTER_SIZE = 9
export const PAK_VERSION = 0x12
const NAME_XOR = 0x71

export type PakEntryType = 'raw' | 'lz77' | 'directory' | 'lz772'
const ENTRY_TYPES: PakEntryType[] = ['raw', 'lz77', 'directory', 'lz772']

export interface PakEntry {
  /** Caminho com separador "/". */
  path: string
  type: PakEntryType
  offset: number
  compressedSize: number
  size: number
}

export interface PakIndex {
  version: number
  /** Região detectada pela chave XTEA (só para entradas v3). */
  region?: PakRegion
  entries: PakEntry[]
}

const decodeName = (bytes: Uint8Array) => {
  const end = bytes.indexOf(0)
  return new TextDecoder('shift_jis')
    .decode(end === -1 ? bytes : bytes.subarray(0, end))
    .replaceAll('\\', '/')
}

/** A primeira entrada sempre começa no offset 0; a chave certa decifra isso. */
function detectRegion(offset: number, size: number): PakRegion | undefined {
  for (const [region, key] of Object.entries(PAK_KEYS) as [PakRegion, XteaKey][]) {
    if (xteaDecrypt(key, offset, size)[0] === 0) return region
  }
  return undefined
}

export function readPakIndex(bytes: Uint8Array, region?: PakRegion): PakIndex {
  if (bytes.byteLength < PAK_FOOTER_SIZE) throw new Error('arquivo pequeno demais para ser um .pak')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const footer = bytes.byteLength - PAK_FOOTER_SIZE
  const indexOffset = view.getUint32(footer, true)
  const count = view.getUint32(footer + 4, true)
  const version = view.getUint8(footer + 8)
  if (indexOffset > footer) throw new Error(`índice fora do arquivo (offset ${indexOffset})`)

  let key: XteaKey | undefined = region ? PAK_KEYS[region] : undefined
  let detected = region
  const entries: PakEntry[] = []
  let at = indexOffset

  for (let i = 0; i < count; i++) {
    if (at + 14 > footer) throw new Error(`índice truncado na entrada ${i}`)
    const nameLength = view.getUint8(at)
    const flags = view.getUint8(at + 1)
    const type = flags & 0x0f
    const entryVersion = flags >> 4
    let offset = view.getUint32(at + 2, true)
    const compressedSize = view.getUint32(at + 6, true)
    let size = view.getUint32(at + 10, true)
    at += 14

    const hasTerminator = entryVersion < 3 || entryVersion === 0xf
    const name = bytes.slice(at, at + nameLength)
    at += nameLength + (hasTerminator ? 1 : 0)

    if (entryVersion < 3) {
      size ^= NAME_XOR
      for (let j = 0; j < name.length; j++) name[j]! ^= NAME_XOR
    } else if (entryVersion === 3) {
      if (!key) {
        detected = detectRegion(offset, size)
        if (!detected) throw new Error('não foi possível detectar a região (chave XTEA) do .pak')
        key = PAK_KEYS[detected]
      }
      ;[offset, size] = xteaDecrypt(key, offset, size)
      xteaBlocks(key, name)
    }

    entries.push({
      path: decodeName(name),
      type: ENTRY_TYPES[type] ?? 'raw',
      offset,
      compressedSize,
      size,
    })
  }

  return { version, ...(detected ? { region: detected } : {}), entries }
}

/** Lê o conteúdo de uma entrada já descomprimido. */
export function readPakEntry(bytes: Uint8Array, entry: PakEntry): Uint8Array {
  const stored = entry.type === 'raw' ? entry.size : entry.compressedSize
  if (entry.offset + stored > bytes.byteLength) {
    throw new Error(`${entry.path}: dados fora do arquivo`)
  }
  const data = bytes.subarray(entry.offset, entry.offset + stored)
  switch (entry.type) {
    case 'raw':
      return data
    case 'lz77':
      return lz77Decompress(data, entry.size)
    case 'lz772':
      return lz772Decompress(data, entry.size)
    case 'directory':
      throw new Error(`${entry.path} é um diretório`)
  }
}

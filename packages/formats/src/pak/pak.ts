// Leitor dos pacotes .pak do cliente.
// Formato documentado em SuperSS-Dev (https://github.com/Acrisio-Filho/SuperSS-Dev), "Tools/lzpak.cpp"
// Copyright (c) 2021 Acrisio Fragoso Vieira Filho — Licença MIT

import { lz772Decompress, lz77Decompress } from './lz77.ts'
import { PAK_KEYS, xteaBlocks, xteaDecrypt, type PakRegion, type XteaKey } from './xtea.ts'

/** Rodapé: u32 offset do índice, u32 número de entradas, u8 versão. */
export const PAK_FOOTER_SIZE = 9
export const PAK_VERSION = 0x12
const NAME_XOR = 0x71
const ENTRY_XTEA = 2
const ENTRY_RAW = 0xf

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

const SHIFT_JIS = new TextDecoder('shift_jis')
const CP949 = new TextDecoder('euc-kr') // no navegador e no Node, "euc-kr" é o CP949 (UHC)
/** Katakana de meia largura ou caractere inválido: sinal de nome coreano lido como japonês. */
const NOT_JAPANESE = /[\uFF61-\uFF9F\uFFFD]/

/**
 * Nome de uma entrada. A maioria foi gravada pelo time coreano em CP949 ("팡야.wav",
 * "공_그린.wav"); alguns, no cliente japonês, em Shift-JIS. Lido como Shift-JIS, um nome
 * coreano vira katakana de meia largura ("ﾆﾎｾﾟ.wav") e perde letras — então tenta primeiro o
 * japonês e, se sair isso, lê em coreano.
 */
export function decodePakName(bytes: Uint8Array): string {
  const end = bytes.indexOf(0)
  const raw = end === -1 ? bytes : bytes.subarray(0, end)
  const japanese = SHIFT_JIS.decode(raw)
  return (NOT_JAPANESE.test(japanese) ? CP949.decode(raw) : japanese).replaceAll('\\', '/')
}

/** A primeira entrada sempre começa no offset 0; a chave certa decifra isso. */
function detectRegion(offset: number, size: number): PakRegion | undefined {
  for (const [region, key] of Object.entries(PAK_KEYS) as [PakRegion, XteaKey][]) {
    if (xteaDecrypt(key, offset, size)[0] === 0) return region
  }
  return undefined
}

/** Erro de leitura do índice com o contexto necessário para diagnosticar o formato. */
export class PakIndexError extends Error {
  constructor(
    message: string,
    readonly details: {
      fileSize: number
      indexOffset: number
      count: number
      version: number
      position: number
      entriesRead: PakEntry[]
      rawHeaders: string[]
      bytesAtPosition: string
    },
  ) {
    super(message)
  }
}

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ')

/** Região conhecida ou chave XTEA customizada (ex.: servidores privados). */
export type PakKeyOption = PakRegion | XteaKey

export function readPakIndex(bytes: Uint8Array, keyOption?: PakKeyOption): PakIndex {
  if (bytes.byteLength < PAK_FOOTER_SIZE) throw new Error('arquivo pequeno demais para ser um .pak')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const footer = bytes.byteLength - PAK_FOOTER_SIZE
  const indexOffset = view.getUint32(footer, true)
  const count = view.getUint32(footer + 4, true)
  const version = view.getUint8(footer + 8)
  if (indexOffset > footer) throw new Error(`índice fora do arquivo (offset ${indexOffset})`)

  let key: XteaKey | undefined = typeof keyOption === 'string' ? PAK_KEYS[keyOption] : keyOption
  let detected = typeof keyOption === 'string' ? keyOption : undefined
  const entries: PakEntry[] = []
  const rawHeaders: string[] = []
  let at = indexOffset

  const fail = (message: string) =>
    new PakIndexError(message, {
      fileSize: bytes.byteLength,
      indexOffset,
      count,
      version,
      position: at,
      entriesRead: entries.slice(-5),
      rawHeaders: rawHeaders.slice(0, entries.length).slice(-5),
      bytesAtPosition: hex(bytes.subarray(at, Math.min(at + 64, bytes.byteLength))),
    })

  for (let i = 0; i < count; i++) {
    if (at + 14 > footer) throw fail(`índice truncado na entrada ${i} de ${count}`)
    rawHeaders.push(`@${at}: ${hex(bytes.subarray(at, at + 14))}`)
    const nameLength = view.getUint8(at)
    const flags = view.getUint8(at + 1)
    const type = flags & 0x0f
    const entryVersion = flags >> 4
    let offset = view.getUint32(at + 2, true)
    const compressedSize = view.getUint32(at + 6, true)
    let size = view.getUint32(at + 10, true)
    at += 14

    // Versões de entrada (como em lzpak.cpp): 0 e 1 = nome com XOR, 2 = XTEA, 0xF = sem cifra.
    const hasTerminator = entryVersion < ENTRY_XTEA || entryVersion === ENTRY_RAW
    const name = bytes.slice(at, at + nameLength)
    at += nameLength + (hasTerminator ? 1 : 0)

    if (entryVersion < ENTRY_XTEA) {
      size ^= NAME_XOR
      for (let j = 0; j < name.length; j++) name[j]! ^= NAME_XOR
    } else if (entryVersion === ENTRY_XTEA) {
      if (!key) {
        detected = detectRegion(offset, size)
        if (!detected) {
          throw fail(
            'chave XTEA desconhecida: nenhuma região padrão abre este .pak ' +
              '(use "pnpm assets:pak-key" para procurar a chave no cliente)',
          )
        }
        key = PAK_KEYS[detected]
      }
      ;[offset, size] = xteaDecrypt(key, offset, size)
      xteaBlocks(key, name)
    }

    entries.push({
      path: decodePakName(name),
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

/** Primeiro par (offset, tamanho) cifrado com XTEA do índice, usado para testar chaves. */
export function firstEncryptedEntry(
  bytes: Uint8Array,
): { offset: number; size: number; name: Uint8Array } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const footer = bytes.byteLength - PAK_FOOTER_SIZE
  let at = view.getUint32(footer, true)
  const count = view.getUint32(footer + 4, true)
  for (let i = 0; i < count && at + 14 <= footer; i++) {
    const nameLength = view.getUint8(at)
    const entryVersion = view.getUint8(at + 1) >> 4
    if (entryVersion === ENTRY_XTEA) {
      return {
        offset: view.getUint32(at + 2, true),
        size: view.getUint32(at + 10, true),
        name: bytes.slice(at + 14, at + 14 + nameLength),
      }
    }
    at += 14 + nameLength + (entryVersion < ENTRY_XTEA || entryVersion === ENTRY_RAW ? 1 : 0)
  }
  return undefined
}

const isPrintablePath = (bytes: Uint8Array) => {
  const end = bytes.indexOf(0)
  const name = end === -1 ? bytes : bytes.subarray(0, end)
  return name.length > 0 && name.every((b) => b >= 0x20 && b < 0x7f)
}

/**
 * Procura a chave XTEA de um .pak dentro de outro arquivo (executável/DLL do cliente):
 * testa cada janela de 16 bytes como chave. Uma chave é aceita quando o
 * offset/tamanho da primeira entrada cifrada decifra para 0 (diretório) ou o nome
 * decifra para texto legível.
 */
export function findPakKey(pak: Uint8Array, haystack: Uint8Array): XteaKey[] {
  const entry = firstEncryptedEntry(pak)
  if (!entry) return []
  const view = new DataView(haystack.buffer, haystack.byteOffset, haystack.byteLength)
  const found: XteaKey[] = []
  const seen = new Set<string>()
  for (let at = 0; at + 16 <= haystack.byteLength; at++) {
    const key: XteaKey = [
      view.getUint32(at, true),
      view.getUint32(at + 4, true),
      view.getUint32(at + 8, true),
      view.getUint32(at + 12, true),
    ]
    if (key[0] === 0 && key[1] === 0 && key[2] === 0 && key[3] === 0) continue
    const [offset] = xteaDecrypt(key, entry.offset, entry.size)
    if (offset !== 0) continue
    const name = entry.name.slice()
    xteaBlocks(key, name)
    const id = key.join(',')
    if (isPrintablePath(name) && !seen.has(id)) {
      seen.add(id)
      found.push(key)
    }
  }
  return found
}

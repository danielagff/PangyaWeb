import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import {
  findPakKey,
  PakIndexError,
  PakVfs,
  readPakEntry,
  readPakIndex,
  sortPaks,
  type PakRegion,
  type XteaKey,
} from '@pangya/formats'

/**
 * Versão da extração: sobe quando muda o que sai dela, e o servidor.cmd extrai de novo
 * sozinho (uma vez). 2: nomes coreanos lidos em CP949 (antes viravam katakana de meia
 * largura, como "ﾆﾎｾﾟ.wav" em vez de "팡야.wav", e o jogo não achava sons e texturas).
 */
export const EXTRACTION_VERSION = 2
const MARKER = '_extracao.json'

/** Versão da extração em `outDir` (0 = antiga, sem a marca). */
export function extractionVersion(outDir: string): number {
  try {
    const data = JSON.parse(readFileSync(resolve(outDir, MARKER), 'utf8')) as { versao?: number }
    return typeof data.versao === 'number' ? data.versao : 0
  } catch {
    return 0
  }
}

export function writeExtractionMarker(outDir: string) {
  writeFileSync(
    resolve(outDir, MARKER),
    JSON.stringify({ versao: EXTRACTION_VERSION, data: new Date().toISOString() }),
  )
}

/** Nome coreano lido errado numa extração antiga (katakana de meia largura ou "�"). */
const GARBLED = /[\uFF61-\uFF9F\uFFFD]/

/**
 * Apaga os arquivos com nome corrompido de extrações antigas (os mesmos arquivos já foram
 * extraídos de novo com o nome certo). Não toca no que esta extração gravou. Devolve
 * quantos apagou.
 */
export function removeGarbledFiles(outDir: string, keep: Set<string>): number {
  const root = resolve(outDir)
  let removed = 0
  const walk = (dir: string): boolean => {
    let empty = true
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (walk(path) && GARBLED.test(entry.name)) rmdirSync(path)
        else empty = false
      } else if (GARBLED.test(path.slice(root.length)) && !keep.has(resolve(path))) {
        unlinkSync(path)
        removed++
      } else {
        empty = false
      }
    }
    return empty
  }
  if (existsSync(root)) walk(root)
  return removed
}

export interface PakSummary {
  name: string
  entries: number
  region?: PakRegion
  error?: string
}

export const findPaks = (clientDir: string) =>
  sortPaks(readdirSync(clientDir).filter((f) => f.toLowerCase().endsWith('.pak')))

/** Chave XTEA customizada no formato "a,b,c,d" (hex), vinda de PAK_KEY no .env. */
export function parsePakKey(value: string | undefined): XteaKey | undefined {
  if (!value?.trim()) return undefined
  const parts = value.split(',').map((p) => Number.parseInt(p.trim().replace(/^0x/i, ''), 16))
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 0xffffffff)) {
    throw new Error(`PAK_KEY inválida: "${value}" (esperado 4 números hex separados por vírgula)`)
  }
  return parts as unknown as XteaKey
}

/** Tenta as chaves padrão por região e, se falhar, a PAK_KEY customizada. */
function readPakIndexWithFallback(bytes: Uint8Array) {
  try {
    return readPakIndex(bytes)
  } catch (err) {
    const custom = parsePakKey(process.env['PAK_KEY'])
    if (!custom) throw err
    return readPakIndex(bytes, custom)
  }
}

/** Lê o índice de todos os .pak e monta o sistema de arquivos virtual. */
export function mountClient(clientDir: string): { vfs: PakVfs; paks: PakSummary[] } {
  const vfs = new PakVfs()
  const paks: PakSummary[] = []
  for (const name of findPaks(clientDir)) {
    try {
      const bytes = readFileSync(join(clientDir, name))
      const index = readPakIndexWithFallback(bytes)
      vfs.mount(name, index.entries)
      paks.push({
        name,
        entries: index.entries.length,
        ...(index.region ? { region: index.region } : {}),
      })
    } catch (err) {
      paks.push({ name, entries: 0, error: describeError(err) })
    }
  }
  return { vfs, paks }
}

/** Extrai todos os arquivos (versão final, após patches) para `outDir`. */
export function extractClient(
  clientDir: string,
  outDir: string,
  log: (msg: string) => void = console.log,
) {
  const { vfs, paks } = mountClient(clientDir)
  log(`${paks.length} pacotes, ${vfs.size} arquivos`)

  const byPak = Map.groupBy(vfs.list(), (e) => e.pak)
  const failures: string[] = []
  /** Caminhos gravados (para apagar só o que sobrou de extrações antigas). */
  const paths = new Set<string>()
  let written = 0

  for (const pak of paks) {
    if (pak.error) {
      failures.push(`${pak.name}: ${pak.error}`)
      continue
    }
    const entries = byPak.get(pak.name) ?? []
    if (entries.length === 0) continue
    const bytes = readFileSync(join(clientDir, pak.name))
    for (const entry of entries) {
      try {
        const target = resolve(outDir, entry.path)
        if (!target.startsWith(resolve(outDir))) throw new Error('caminho fora da pasta de saída')
        mkdirSync(dirname(target), { recursive: true })
        writeFileSync(target, readPakEntry(bytes, entry))
        paths.add(target)
        written++
      } catch (err) {
        failures.push(`${pak.name}: ${entry.path}: ${err instanceof Error ? err.message : err}`)
      }
    }
    log(`  ${pak.name}: ${entries.length} arquivos`)
  }
  return { written, failures, paks, vfs, paths }
}

/** Texto do erro; para erros de índice inclui os bytes ao redor da falha. */
export function describeError(err: unknown): string {
  if (err instanceof PakIndexError) {
    const d = err.details
    return [
      err.message,
      `  tamanho=${d.fileSize} índice@${d.indexOffset} entradas=${d.count} versão=0x${d.version.toString(16)}`,
      `  últimas entradas lidas:`,
      ...d.entriesRead.map((e, i) => `    ${d.rawHeaders[i] ?? ''} → ${e.path} (${e.type})`),
      `  bytes na posição ${d.position}: ${d.bytesAtPosition}`,
    ].join('\n')
  }
  return err instanceof Error ? err.message : String(err)
}

/** Procura a chave XTEA de um .pak nos executáveis, DLLs e .dat do cliente. */
export function searchPakKey(clientDir: string, pakFile: string) {
  const pak = readFileSync(pakFile)
  const candidates = readdirSync(clientDir).filter((f) => /\.(exe|dll|dat)$/i.test(f))
  const results: { file: string; keys: XteaKey[] }[] = []
  for (const file of candidates) {
    const keys = findPakKey(pak, readFileSync(join(clientDir, file)))
    results.push({ file, keys })
  }
  return results
}

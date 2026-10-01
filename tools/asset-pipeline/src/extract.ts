import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
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
        written++
      } catch (err) {
        failures.push(`${pak.name}: ${entry.path}: ${err instanceof Error ? err.message : err}`)
      }
    }
    log(`  ${pak.name}: ${entries.length} arquivos`)
  }
  return { written, failures, paks, vfs }
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

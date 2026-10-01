import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import {
  PakIndexError,
  PakVfs,
  readPakEntry,
  readPakIndex,
  sortPaks,
  type PakRegion,
} from '@pangya/formats'

export interface PakSummary {
  name: string
  entries: number
  region?: PakRegion
  error?: string
}

export const findPaks = (clientDir: string) =>
  sortPaks(readdirSync(clientDir).filter((f) => f.toLowerCase().endsWith('.pak')))

/** Lê o índice de todos os .pak e monta o sistema de arquivos virtual. */
export function mountClient(clientDir: string): { vfs: PakVfs; paks: PakSummary[] } {
  const vfs = new PakVfs()
  const paks: PakSummary[] = []
  for (const name of findPaks(clientDir)) {
    const index = readPakIndex(readFileSync(join(clientDir, name)))
    vfs.mount(name, index.entries)
    paks.push({
      name,
      entries: index.entries.length,
      ...(index.region ? { region: index.region } : {}),
    })
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

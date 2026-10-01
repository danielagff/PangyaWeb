import type { PakEntry } from './pak.ts'

export interface MountedEntry extends PakEntry {
  /** Nome do .pak de onde a entrada vem. */
  pak: string
}

/**
 * Ordem de montagem: pacotes base em ordem alfabética, depois os patches numerados
 * (projectg984.pak, projectg985.pak…) em ordem crescente. Quem vem depois sobrescreve.
 */
export function sortPaks(names: string[]): string[] {
  const patch = (name: string) => /^projectg(\d+)\.pak$/i.exec(name)?.[1]
  return [...names].sort((a, b) => {
    const pa = patch(a)
    const pb = patch(b)
    if (pa && pb) return Number(pa) - Number(pb)
    if (pa) return 1
    if (pb) return -1
    return a.toLowerCase().localeCompare(b.toLowerCase())
  })
}

/** Sistema de arquivos virtual: junta vários .pak, com caminhos sem distinção de maiúsculas. */
export class PakVfs {
  private readonly files = new Map<string, MountedEntry>()

  mount(pak: string, entries: PakEntry[]): void {
    for (const entry of entries) {
      if (entry.type === 'directory') continue
      this.files.set(entry.path.toLowerCase(), { ...entry, pak })
    }
  }

  get(path: string): MountedEntry | undefined {
    return this.files.get(path.replaceAll('\\', '/').toLowerCase())
  }

  list(): MountedEntry[] {
    return [...this.files.values()]
  }

  get size(): number {
    return this.files.size
  }
}

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, normalize, resolve, sep } from 'node:path'
import { pickIndexed, type AssetIndex, type Course, type FileSource } from '@pangya/game'

/** Caminho dentro de `root` sem deixar escapar com "..". */
export function safeJoin(root: string, path: string): string | undefined {
  const full = resolve(root, normalize(decodeURIComponent(path)).replace(/^([/\\])+/, ''))
  return full === root || full.startsWith(root + sep) ? full : undefined
}

/** Arquivos do jogo no disco (assets/original), com o mesmo índice do pipeline. */
export class DiskFiles implements FileSource {
  private index: AssetIndex | undefined

  constructor(readonly root: string) {}

  private loadIndex(): AssetIndex {
    if (!this.index) {
      const file = join(this.root, '_index.json')
      this.index = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as AssetIndex) : {}
    }
    return this.index
  }

  async read(path: string) {
    const full = safeJoin(this.root, path)
    if (!full || !existsSync(full) || !statSync(full).isFile()) return undefined
    return new Uint8Array(await readFile(full))
  }

  async find(name: string, round: string) {
    const path = pickIndexed(this.loadIndex(), name, round)
    return path ? this.read(path) : undefined
  }
}

/** Cursos disponíveis: pastas com map/<prefixo>_NN.gbin (direto ou dentro de data/). */
export function listCourses(root: string): Course[] {
  const courses: Course[] = []
  const seen = new Set<string>()
  for (const base of [root, join(root, 'data')]) {
    if (!existsSync(base)) continue
    for (const round of readdirSync(base)) {
      const map = join(base, round, 'map')
      if (seen.has(round) || !existsSync(map) || !statSync(map).isDirectory()) continue
      const holes = new Map<string, number[]>()
      for (const f of readdirSync(map)) {
        const m = /^(.+)_(\d\d)\.gbin$/i.exec(f)
        if (m) holes.set(m[1]!, [...(holes.get(m[1]!) ?? []), Number(m[2])])
      }
      // O prefixo com mais buracos é o do curso (alguns têm arquivos extras).
      const best = [...holes].sort((a, b) => b[1].length - a[1].length)[0]
      if (!best) continue
      seen.add(round)
      courses.push({ round, prefix: best[0], holes: best[1].sort((a, b) => a - b) })
    }
  }
  return courses.sort((a, b) => a.round.localeCompare(b.round))
}

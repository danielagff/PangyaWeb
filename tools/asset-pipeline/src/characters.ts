/**
 * Catálogo de personagens extraídos (assets/original/_characters.json).
 *
 * Um personagem é montado em tempo de execução (guia técnico do pangya-pet_tools, cap. 7):
 * um esqueleto `.bpet`, as animações `.apet` e as peças `.mpet` (roupa, cabelo, rosto…),
 * todos na mesma pasta (ex.: data/avatar/male/m_def.bpet + m_def.apet + m_ha_01.mpet).
 * O 2º pedaço do nome da peça é o slot (ha cabelo, fc rosto, ts camisa, pv calça, ft pé,
 * hn mão…); o sufixo `!xx!yy` lista os slots que a peça esconde.
 */

export interface CharacterEntry {
  /** Identificador estável: caminho do .bpet sem extensão. */
  id: string
  name: string
  skeleton: string
  animations: string | undefined
  /** Peças por slot, caminhos relativos a assets/original. */
  parts: Record<string, string[]>
  /** Roupa padrão: uma peça por slot básico. */
  defaults: string[]
}

/** Slots que formam um personagem completo, na ordem em que a roupa padrão é escolhida. */
export const BASIC_SLOTS = ['fc', 'ha', 'ts', 'pv', 'ft', 'hn']

const base = (path: string) => path.split('/').pop()!
const dir = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf('/')))
const stem = (path: string) => base(path).replace(/\.[^.]+$/, '')
const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })

/** Slots que a peça esconde (sufixo "!hn!pv"). */
export const hiddenSlots = (part: string) =>
  [...stem(part).matchAll(/!([a-z]+)/gi)].map((m) => m[1]!.toLowerCase())

/** Slot da peça pelo nome (m_ha_01 → "ha"). */
export const slotOf = (part: string) => stem(part).split('_')[1]?.toLowerCase() ?? 'outro'

export function buildCharacterCatalog(paths: string[]): CharacterEntry[] {
  const byDir = Map.groupBy(paths, dir)
  const characters: CharacterEntry[] = []
  for (const skeleton of paths.filter((p) => /\.bpet$/i.test(p)).sort(natural)) {
    const files = byDir.get(dir(skeleton)) ?? []
    const name = stem(skeleton)
    const prefix = name.split('_')[0]!.toLowerCase()
    const apets = files.filter((p) => /\.apet$/i.test(p)).sort(natural)
    const animations = apets.find((p) => stem(p).toLowerCase() === name.toLowerCase()) ?? apets[0]
    let mpets = files.filter((p) => /\.mpet$/i.test(p))
    const own = mpets.filter((p) => base(p).toLowerCase().startsWith(`${prefix}_`))
    if (own.length > 0) mpets = own
    const parts: Record<string, string[]> = {}
    for (const part of mpets.sort(natural)) (parts[slotOf(part)] ??= []).push(part)

    const defaults: string[] = []
    const covered = new Set<string>()
    for (const slot of BASIC_SLOTS) {
      if (covered.has(slot)) continue
      const options = parts[slot] ?? []
      // Prefere peças que não escondem outras (roupa "normal").
      const choice = options.find((p) => hiddenSlots(p).length === 0) ?? options[0]
      if (!choice) continue
      defaults.push(choice)
      covered.add(slot)
      for (const hidden of hiddenSlots(choice)) covered.add(hidden)
    }
    characters.push({
      id: skeleton.replace(/\.bpet$/i, ''),
      name: `${dir(skeleton).split('/').pop() ?? ''}/${name}`.replace(/^\//, ''),
      skeleton,
      animations,
      parts,
      defaults,
    })
  }
  return characters
}

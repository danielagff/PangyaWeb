/**
 * Acesso aos arquivos do jogo servidos pelo Vite em /game-assets (pasta assets/, local).
 *
 * Os cursos aparecem em dois lugares: `round02_blue/...` (extraídos dos .pak) ou
 * `data/round02_blue/...` (pacote de exemplo). Modelos e texturas são referenciados só
 * pelo nome e podem estar em pastas compartilhadas: o `_index.json` gerado pelo pipeline
 * diz onde está cada nome.
 */

export const ASSET_BASE = '/game-assets/original'
const ROOTS = [ASSET_BASE, `${ASSET_BASE}/data`]

type AssetIndex = Record<string, string | string[]>
let index: Promise<AssetIndex> | undefined

function loadIndex() {
  index ??= fetch(`${ASSET_BASE}/_index.json`)
    .then((r) => (r.ok ? (r.json() as Promise<AssetIndex>) : {}))
    .catch(() => ({}))
  return index
}

/**
 * Caminho (relativo a ASSET_BASE) de um arquivo pelo nome. Com nomes repetidos em vários
 * cursos, prefere o da pasta do curso atual; senão o caminho mais curto.
 */
export async function findAsset(name: string, round: string): Promise<string | undefined> {
  const entry = (await loadIndex())[name.toLowerCase()]
  if (entry === undefined || typeof entry === 'string') return entry
  const inRound = entry.find((p) => p.toLowerCase().split('/').includes(round.toLowerCase()))
  return inRound ?? entry[0]
}

const encode = (path: string) => path.split('/').map(encodeURIComponent).join('/')

/** Baixa `path` tentando cada raiz; undefined se não existir em nenhuma. */
export async function tryFetchBytes(path: string, roots = ROOTS): Promise<Uint8Array | undefined> {
  for (const root of roots) {
    const response = await fetch(`${root}/${encode(path)}`)
    if (response.ok) return new Uint8Array(await response.arrayBuffer())
  }
  return undefined
}

export async function fetchBytes(path: string, roots = ROOTS): Promise<Uint8Array> {
  const bytes = await tryFetchBytes(path, roots)
  if (!bytes) throw new Error(`não encontrado: ${path} (procurado em ${roots.join(', ')})`)
  return bytes
}

/** Arquivo do curso pelo nome: primeiro pelo índice, senão em `<curso>/<pasta>/<nome>`. */
export async function fetchCourseFile(
  round: string,
  folder: string,
  name: string,
): Promise<Uint8Array | undefined> {
  const indexed = await findAsset(name, round)
  if (indexed) return tryFetchBytes(indexed, [ASSET_BASE])
  return tryFetchBytes(`${round}/${folder}/${name}`)
}

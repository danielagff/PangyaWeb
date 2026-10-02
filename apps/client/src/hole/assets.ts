/**
 * Acesso aos arquivos do jogo servidos em /game-assets (pasta assets/ do PC do anfitrião:
 * pelo Vite no desenvolvimento, pelo servidor da partida no multiplayer).
 */
import { pickIndexed, type AssetIndex, type FileSource } from '@pangya/game'

export const ASSET_BASE = '/game-assets/original'

let index: Promise<AssetIndex> | undefined

function loadIndex() {
  index ??= fetch(`${ASSET_BASE}/_index.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? (r.json() as Promise<AssetIndex>) : {}))
    .catch(() => ({}))
  return index
}

/** Todos os nomes de arquivo conhecidos (minúsculos), para procurar por padrão. */
export async function assetNames(): Promise<string[]> {
  return Object.keys(await loadIndex())
}

/** Caminho (relativo a ASSET_BASE) de um arquivo pelo nome, preferindo a pasta do curso. */
export async function findAsset(name: string, round: string): Promise<string | undefined> {
  return pickIndexed(await loadIndex(), name, round)
}

const encode = (path: string) => path.split('/').map(encodeURIComponent).join('/')

/** Baixa um arquivo de ASSET_BASE; undefined se não existir. */
export async function tryFetchBytes(path: string): Promise<Uint8Array | undefined> {
  const response = await fetch(`${ASSET_BASE}/${encode(path)}`, { cache: 'no-cache' })
  return response.ok ? new Uint8Array(await response.arrayBuffer()) : undefined
}

/** Fonte de arquivos do carregador de buracos (@pangya/game) no navegador. */
export const browserFiles: FileSource = {
  read: tryFetchBytes,
  async find(name, round) {
    const path = await findAsset(name, round)
    return path ? tryFetchBytes(path) : undefined
  },
}

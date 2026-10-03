/**
 * Busca de pistas da câmera nos arquivos do jogo (para o diagnóstico): nomes de arquivo com
 * cara de câmera e palavras de câmera dentro dos arquivos de dados (em inglês, em coreano
 * CP949 e em UTF-16), com um trecho legível em volta de cada achado.
 */

/** Nomes de arquivo com cara de câmera (inglês e coreano). */
export const CAMERA_NAME =
  /(camera|(^|[/_.-])cam([/_.\d-]|$)|cinema|replay|카메라|연출|시점|리플레이)/i

/** Arquivos de dados onde vale procurar por dentro (tabelas, textos, scripts). */
export const DATA_FILE = /\.(iff|xml|ini|txt|lua|cfg|csv|dat|bin|scr|def|tbl|json)$/i

interface Marker {
  label: string
  bytes: number[]
}

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0))
const hex = (text: string) => text.match(/../g)!.map((h) => parseInt(h, 16))

/** Palavras procuradas (bytes exatos; as em inglês sem diferença de maiúsculas). */
const MARKERS: Marker[] = [
  { label: 'camera', bytes: ascii('camera') },
  { label: 'cam_', bytes: ascii('cam_') },
  { label: '_cam', bytes: ascii('_cam') },
  { label: 'camera (UTF-16)', bytes: [...ascii('camera')].flatMap((b) => [b, 0]) },
  { label: '카메라', bytes: hex('c4abb8deb6f3') },
  { label: '연출', bytes: hex('bfacc3e2') },
  { label: '시점', bytes: hex('bdc3c1a1') },
  { label: '리플레이', bytes: hex('b8aec7c3b7b9c0cc') },
]

const lower = (b: number) => (b >= 65 && b <= 90 ? b + 32 : b)

/** Trecho legível em volta de `at` (ASCII; o resto vira "."). */
function snippet(bytes: Uint8Array, at: number, length: number) {
  const from = Math.max(0, at - 24)
  const to = Math.min(bytes.length, at + length + 40)
  let text = ''
  for (let i = from; i < to; i++) {
    const b = bytes[i]!
    text += b >= 32 && b < 127 ? String.fromCharCode(b) : '.'
  }
  return text.replace(/\.{3,}/g, '…')
}

/** Achados de palavras de câmera em `bytes`: até `limit` por palavra, com o trecho em volta. */
export function findCameraMarkers(bytes: Uint8Array, limit = 3): string[] {
  const found: string[] = []
  for (const marker of MARKERS) {
    const m = marker.bytes
    const caseless = m.every((b) => b < 128)
    let count = 0
    for (let i = 0; i + m.length <= bytes.length && count < limit; i++) {
      let j = 0
      while (j < m.length && (caseless ? lower(bytes[i + j]!) : bytes[i + j]) === m[j]) j++
      if (j === m.length) {
        found.push(`${marker.label} @${i}: ${snippet(bytes, i, m.length)}`)
        count++
        i += m.length - 1
      }
    }
  }
  return found
}

/** Quantos arquivos de cada extensão (para ver que tipos de dados o jogo tem). */
export function extensionCounts(paths: string[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const p of paths) {
    const ext = /\.([^./]+)$/.exec(p)?.[1]?.toLowerCase() ?? '(sem)'
    counts.set(ext, (counts.get(ext) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1])
}

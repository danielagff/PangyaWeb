/**
 * Bolas do jogo: a tabela Ball.iff convertida pelo pipeline
 * (assets/converted/data/balls.json) com o modelo 3D de cada uma (data/ball/<modelo>.pet).
 * A escolha fica no navegador; no online vai para a sala (os outros veem a sua bola).
 * Por enquanto só muda o desenho (os atributos da tabela ainda não foram conferidos).
 */
import { findAsset } from '../hole/assets.ts'

export interface BallEntry {
  id: number
  /** Nome do jogo (japonês) e um em português para mostrar. */
  name: string
  label: string
  /** Arquivo do modelo, sem ".pet" (ball_low, ball_b…). */
  model: string
}

/** Palavras dos nomes do cliente japonês, na ordem (as mais longas antes). */
const WORDS: [string, string][] = [
  ['アズテック', 'Aztec'],
  ['周年記念', 'º aniversário'],
  ['周年', 'º aniversário'],
  ['ハローキティ', 'Hello Kitty'],
  ['ブルースター', 'Estrela Azul'],
  ['デイリースター', 'Estrela do Dia'],
  ['ゴールドフェニックス', 'Fênix Dourada'],
  ['クリスマス', 'Natal'],
  ['ハロウィン', 'Halloween'],
  ['パンプキン', 'Abóbora'],
  ['レインボー', 'Arco-íris'],
  ['チョコレート', 'Chocolate'],
  ['ウォーター', 'Água'],
  ['クローバー', 'Trevo'],
  ['ラブラブ', 'Love Love'],
  ['黄色スイカ', 'Melancia Amarela'],
  ['スイカ', 'Melancia'],
  ['サッカーボール', 'Bola de Futebol'],
  ['マッシュルームボム', 'Bomba Cogumelo'],
  ['爆弾', 'Bomba'],
  ['黄金', 'Dourada'],
  ['福入り', 'da Sorte'],
  ['さくら', 'Sakura'],
  ['黒猫', 'Gato Preto'],
  ['猫魂', 'Alma de Gato'],
  ['うさぎ', 'Coelho'],
  ['さる', 'Macaco'],
  ['とり', 'Pássaro'],
  ['へび', 'Cobra'],
  ['とら', 'Tigre'],
  ['たつ', 'Dragão'],
  ['光の', 'da Luz'],
  ['闇の', 'das Trevas'],
  ['地球儀', 'Globo'],
  ['お月見', 'Lua Cheia'],
  ['ネオン', 'Neon'],
  ['オレンジ', 'Laranja'],
  ['アゲハ', 'Borboleta'],
  ['スカル', 'Caveira'],
  ['ビッグスマイル', 'Sorriso'],
  ['クライング', 'Chorando'],
  ['アングリー', 'Bravo'],
  ['ウインク', 'Piscadinha'],
  ['グラサン', 'Óculos Escuros'],
  ['プレミアム', 'Premium'],
  ['ペーパー', 'Papel'],
  ['ボイス', ' Voz'],
  ['クー', 'Kooh'],
  ['エリカ', 'Erika'],
  ['セシリア', 'Cecilia'],
  ['ルーシア', 'Lucia'],
  ['マックス', 'Max'],
  ['ケン', 'Ken'],
  ['アリン', 'Arin'],
  ['ダイスケ', 'Daisuke'],
  ['カズ', 'Kaz'],
  ['ネル', 'Nell'],
  ['スピカ', 'Spika'],
  ['カレン', 'Karen'],
  ['ロロ', 'Loro'],
  ['白', 'branca'],
  ['黒', 'preta'],
]

/** "爆弾アズテック" → "Bomba Aztec"; o que não estiver na lista fica como no jogo. */
export function ballLabel(name: string) {
  let label = name
  for (const [jp, pt] of WORDS) label = label.split(jp).join(` ${pt} `)
  return (
    label
      .replace(/\s+/g, ' ')
      .replace(/(\d) º/, '$1º')
      .trim() || name
  )
}

let list: Promise<BallEntry[]> | undefined

/** Bolas da tabela que têm o modelo na extração (uma por modelo, na ordem do jogo). */
export function loadBalls(): Promise<BallEntry[]> {
  list ??= (async () => {
    try {
      const response = await fetch('/game-assets/converted/data/balls.json', { cache: 'no-cache' })
      if (!response.ok) return []
      const rows = (await response.json()) as { id: number; name: string; model: string }[]
      const seen = new Set<string>()
      const out: BallEntry[] = []
      for (const row of rows) {
        const model = String(row.model ?? '').trim()
        if (!model || seen.has(model.toLowerCase())) continue
        seen.add(model.toLowerCase())
        if (!(await findAsset(`${model}.pet`, ''))) continue
        out.push({ id: row.id, name: row.name, label: ballLabel(row.name), model })
      }
      return out
    } catch {
      return []
    }
  })()
  return list
}

const CHOICE_KEY = 'pangyaweb.bola'

/** Modelo da bola escolhida neste navegador (ou a primeira da tabela; sem tabela, nenhuma). */
export async function chosenBall(): Promise<string | undefined> {
  const balls = await loadBalls()
  let saved: string | null = null
  try {
    saved = localStorage.getItem(CHOICE_KEY)
  } catch {
    // sem armazenamento
  }
  return balls.find((b) => b.model === saved)?.model ?? balls[0]?.model
}

export function rememberBall(model: string) {
  try {
    localStorage.setItem(CHOICE_KEY, model)
  } catch {
    // sem armazenamento: só não lembra
  }
}

/**
 * Tradução dos nomes coreanos dos movimentos (.apet) para o mapeador: separa por categoria
 * e monta o texto pelas partes do nome (taco + "샷" + modificadores, "chat_" + emoção,
 * "<item>등장모션_item"…). Nomes terminados em "끝" são o trecho final do movimento.
 * Traduções de tacada marcadas com "?" ainda precisam ser conferidas no jogo.
 */

export type MotionCategory =
  | 'Postura'
  | 'Madeira'
  | 'Ferro'
  | 'Wedge'
  | 'Putter'
  | 'Resultado do buraco'
  | 'Fim da partida'
  | 'Emoções (chat)'
  | 'Entrada e itens'
  | 'Outros'

/** Ordem das categorias na tela. */
export const MOTION_CATEGORIES: MotionCategory[] = [
  'Postura',
  'Madeira',
  'Ferro',
  'Wedge',
  'Putter',
  'Resultado do buraco',
  'Fim da partida',
  'Emoções (chat)',
  'Entrada e itens',
  'Outros',
]

export interface MotionDescription {
  category: MotionCategory
  /** Tradução em português ('' se não deu para traduzir). */
  text: string
}

const CLUBS: [string, MotionCategory][] = [
  ['샌드웻지', 'Wedge'],
  ['아이언', 'Ferro'],
  ['우드', 'Madeira'],
  ['퍼팅', 'Putter'],
]

/** Partes depois de "<taco>샷", na ordem em que são procuradas. */
const SHOT_PARTS: [string, string][] = [
  ['파워2', 'power shot 2'],
  ['파워', 'power shot'],
  ['게걸음', 'andando de lado (mirando)'],
  ['늦은헛스윙', 'errou: atrasado'],
  ['빠른헛스윙', 'errou: adiantado'],
  ['헛스윙', 'errou a bola'],
  ['준비', 'preparação'],
  ['디폴트', 'padrão'],
  ['대기', 'esperando'],
  ['후모션', 'depois da tacada'],
]

const CHAT: Record<string, string> = {
  걷기: 'andar',
  기쁨: 'alegria',
  기지개: 'espreguiçar',
  나이스: '"nice!"',
  날기: 'voar',
  날기2: 'voar 2',
  놀람: 'susto/surpresa',
  눕기: 'deitar',
  달리기: 'correr',
  댄스: 'dança',
  도발: 'provocar',
  때리기: 'bater',
  만세: 'viva! (braços para cima)',
  맞기: 'apanhar',
  머쓱: 'sem graça',
  메롱: 'língua de fora',
  박수: 'aplaudir',
  부끄: 'vergonha',
  분노: 'fúria',
  브이: 'sinal de V',
  비웃기: 'zombar',
  비틀: 'cambalear',
  삐짐: 'emburrado',
  슬픔: 'tristeza',
  신발: 'sapato',
  실망: 'decepção',
  싫어: '"não quero!"',
  아이템댄스: 'dança de item',
  안녕: 'tchau/oi',
  앉기: 'sentar',
  엉엉: 'chorar alto',
  인사: 'cumprimentar (reverência)',
  좌절: 'frustração (de joelhos)',
  주의: 'atenção!',
  쯔쯔: '"tsc, tsc"',
  차인: 'levou um fora',
  춤: 'dançar',
  키스: 'beijo',
  토끼: 'coelho',
  파이팅: '"força!" (fighting)',
  하이: '"oi!"',
  하트: 'coração',
  하품: 'bocejo',
  한심: '"que patético"',
  호호: 'risinho',
  화남: 'bravo',
  sp1: 'especial 1',
  sp2: 'especial 2',
}

const ITEMS: Record<string, string> = {
  권총: 'pistola',
  꽃: 'flor',
  날개: 'asas',
  드래곤: 'dragão',
  마왕: 'rei demônio',
  바이크: 'moto',
  스포츠카: 'carro esportivo',
  우주선: 'nave espacial',
  폭탄: 'bomba',
  해적선: 'navio pirata',
  헬기: 'helicóptero',
}

const WHOLE: Record<string, MotionDescription> = {
  기본자세: { category: 'Postura', text: 'postura básica (parado)' },
  h_intro: { category: 'Entrada e itens', text: 'apresentação (intro do Kaz)' },
  열혈기본자세: { category: 'Postura', text: 'postura básica empolgada' },
  등장모션: { category: 'Entrada e itens', text: 'entrada (aparece no começo)' },
  아이템댄스: { category: 'Emoções (chat)', text: 'dança de item' },
  그랑프리박수: { category: 'Fim da partida', text: 'aplauso do Grand Prix' },
  '1등모션': { category: 'Fim da partida', text: '1º lugar' },
  '1등모션02': { category: 'Fim da partida', text: '1º lugar (2)' },
  '2등모션': { category: 'Fim da partida', text: '2º lugar' },
  '2등모션2': { category: 'Fim da partida', text: '2º lugar (2)' },
  '3등모션': { category: 'Fim da partida', text: '3º lugar' },
  버디승리포즈: { category: 'Resultado do buraco', text: 'comemoração: birdie' },
  이글승리포즈: { category: 'Resultado do buraco', text: 'comemoração: eagle' },
  알바홀인승리포즈: {
    category: 'Resultado do buraco',
    text: 'comemoração: albatross / hole in one',
  },
  세이브파승리포즈: { category: 'Resultado do buraco', text: 'comemoração: par salvo' },
  세이브파승리포즈2: { category: 'Resultado do buraco', text: 'comemoração: par salvo (2)' },
  세이브파승리포즈02: { category: 'Resultado do buraco', text: 'comemoração: par salvo (02)' },
  보기실격실망포즈: {
    category: 'Resultado do buraco',
    text: 'decepção: bogey / desclassificado',
  },
  더블보기실망포즈: { category: 'Resultado do buraco', text: 'decepção: double bogey' },
  타임오버벙커OB실망포즈: {
    category: 'Resultado do buraco',
    text: 'decepção: tempo esgotado / bunker / OB',
  },
  퍼팅성공: { category: 'Resultado do buraco', text: 'putt embocado' },
  퍼팅실패: { category: 'Resultado do buraco', text: 'putt errado' },
  퍼팅후실망포즈: { category: 'Resultado do buraco', text: 'decepção depois do putt' },
  퍼팅후대기: { category: 'Putter', text: 'esperando depois do putt' },
  짧은퍼팅: { category: 'Putter', text: 'putt curto' },
  짧은퍼팅02: { category: 'Putter', text: 'putt curto (02)' },
  샷: { category: 'Outros', text: 'tacada (genérica)' },
  샷준비: { category: 'Outros', text: 'preparação da tacada (genérica)' },
  샷게걸음: { category: 'Outros', text: 'andando de lado (genérico)' },
  샷파워준비: { category: 'Outros', text: 'preparação power (genérica)' },
}

/** "<taco>샷…" → "tacada · power shot · preparação". */
function describeShot(rest: string): string | undefined {
  // Variação gravada fora de ordem: "우드파워샷2후모션".
  const normalized = rest.replace(/^파워샷2/, '샷파워2')
  if (!normalized.startsWith('샷')) return normalized === '' ? 'taco (pose)' : undefined
  let tail = normalized.slice(1)
  const parts: string[] = []
  while (tail) {
    const found = SHOT_PARTS.find(([ko]) => tail.startsWith(ko))
    if (!found) return undefined
    parts.push(found[1])
    tail = tail.slice(found[0].length)
  }
  if (parts.length === 0) return 'tacada (swing completo)'
  // Os mais usados, com o que já se sabe do jogo.
  const text = parts.join(' · ')
  if (text === 'preparação') return 'preparação: parado mirando'
  if (text === 'power shot · preparação') return 'backswing (sobe o taco com a barra)?'
  const pose = /preparação|andando|esperando|padrão/.test(text)
  return pose ? text : `tacada · ${text}`
}

export function describeMotion(name: string): MotionDescription {
  let base = name
  let end = ''
  if (base.endsWith('끝')) {
    base = base.slice(0, -1)
    end = ' (final)'
  }
  const whole = WHOLE[base]
  if (whole) return { ...whole, text: whole.text + end }

  if (base.startsWith('chat_')) {
    const word = base.slice('chat_'.length)
    return { category: 'Emoções (chat)', text: (CHAT[word] ?? '') + (CHAT[word] ? end : '') }
  }

  if (base.endsWith('_item')) {
    const core = base.slice(0, -'_item'.length)
    const item = Object.keys(ITEMS).find((k) => core.startsWith(k))
    const what = item ? core.slice(item.length) : core
    const action = what.startsWith('등장')
      ? 'entrada'
      : what.startsWith('알바홀인')
        ? 'comemoração albatross / hole in one'
        : ''
    const text = item && action ? `${action} com ${ITEMS[item]}` : ''
    return { category: 'Entrada e itens', text: text && text + end }
  }

  for (const [ko, category] of CLUBS) {
    if (!base.startsWith(ko)) continue
    const shot = describeShot(base.slice(ko.length))
    if (shot) return { category, text: shot + end }
  }

  if (/^E_/i.test(base)) return { category: 'Entrada e itens', text: `evento (${base.slice(2)})` }
  return { category: 'Outros', text: '' }
}

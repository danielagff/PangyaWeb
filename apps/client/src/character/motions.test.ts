import { describe, expect, it } from 'vitest'
import { describeMotion } from './motion-names.ts'
import {
  golfMotions,
  motionMeaning,
  reactionEnding,
  reactionForScore,
  reactionMotion,
} from './motions.ts'

// Trecho real do a_def.apet (Azer, cliente JP).
const azer = [
  ['기본자세', 1795, 2311],
  ['우드샷준비', 5045, 5285],
  ['우드샷파워준비', 5286, 5309],
  ['우드샷', 5286, 5336],
  ['우드샷게걸음', 5337, 5365],
  ['아이언샷준비', 3384, 3624],
  ['아이언샷파워준비', 3625, 3647],
  ['아이언샷', 3625, 3675],
  ['샌드웻지샷준비', 3384, 3624],
  ['샌드웻지샷', 2789, 2878],
  ['퍼팅샷준비', 6281, 6521],
  ['퍼팅샷', 6583, 6654],
  ['버디승리포즈', 2535, 2637],
  ['타임오버벙커OB실망포즈', 6169, 6251],
].map(([name, frameStart, frameEnd]) => ({
  name: name as string,
  frameStart: +frameStart!,
  frameEnd: +frameEnd!,
}))

describe('movimentos de golfe', () => {
  it('madeira: preparação, backswing e impacto logo depois do topo', () => {
    const m = golfMotions(azer, 'wood')
    expect(m).toMatchObject({
      idle: '우드샷준비',
      swing: '우드샷',
      backswing: '우드샷파워준비',
      walk: '우드샷게걸음',
    })
    expect(m.top).toBeCloseTo(23 / 30)
    expect(m.impact).toBeCloseTo((23 + 27 * 0.3) / 30)
  })

  it('wedge usa a sandwedge; putter sem backswing usa a fração padrão', () => {
    expect(golfMotions(azer, 'wedge')).toMatchObject({
      idle: '샌드웻지샷준비',
      swing: '샌드웻지샷',
    })
    const putt = golfMotions(azer, 'putter')
    expect(putt).toMatchObject({
      idle: '퍼팅샷준비',
      swing: '퍼팅샷',
      backswing: undefined,
      top: 0,
    })
    expect(putt.impact).toBeCloseTo((71 / 30) * 0.55)
  })

  it('sem nada do taco, cai na postura básica', () => {
    expect(golfMotions([azer[0]!], 'wood')).toMatchObject({ idle: '기본자세', swing: undefined })
  })

  it('reações pelo placar', () => {
    expect(reactionForScore(3, 4)).toBe('birdie')
    expect(reactionForScore(1, 3)).toBe('albatross')
    expect(reactionForScore(5, 4)).toBe('bogey')
    expect(reactionForScore(6, 4)).toBe('doubleBogey')
    expect(reactionForScore(9, 4)).toBe('doubleBogey')
    expect(reactionMotion(azer, 'birdie')).toBe('버디승리포즈')
    expect(reactionMotion(azer, 'trouble')).toBe('타임오버벙커OB실망포즈')
    expect(reactionMotion(azer, 'eagle')).toBe('버디승리포즈')
  })

  it('do hole in one ao double bogey, com as variações do par e a pose final', () => {
    const all = [
      '알바홀인승리포즈',
      '이글승리포즈',
      '버디승리포즈',
      '세이브파승리포즈',
      '세이브파승리포즈2',
      '세이브파승리포즈02',
      '보기실격실망포즈',
      '더블보기실망포즈',
      '더블보기실망포즈끝',
    ].map((name, i) => ({ name, frameStart: i * 10, frameEnd: i * 10 + 9 }))
    expect(reactionMotion(all, 'albatross')).toBe('알바홀인승리포즈')
    expect(reactionMotion(all, 'eagle')).toBe('이글승리포즈')
    expect(reactionMotion(all, 'par', () => 0)).toBe('세이브파승리포즈')
    expect(reactionMotion(all, 'par', () => 0.99)).toBe('세이브파승리포즈02')
    expect(reactionMotion(all, 'bogey')).toBe('보기실격실망포즈')
    expect(reactionMotion(all, 'doubleBogey')).toBe('더블보기실망포즈')
    expect(reactionEnding(all, '더블보기실망포즈')).toBe('더블보기실망포즈끝')
    expect(reactionEnding(all, '보기실격실망포즈')).toBeUndefined()
  })
})

describe('motionMeaning', () => {
  it('traduz taco + ação e poses conhecidas', () => {
    expect(motionMeaning('우드샷준비')).toBe('preparação: parado mirando')
    expect(motionMeaning('퍼팅샷')).toBe('tacada (swing completo)')
    expect(motionMeaning('아이언샷파워빠른헛스윙')).toBe('tacada · power shot · errou: adiantado')
    expect(motionMeaning('버디승리포즈끝')).toBe('comemoração: birdie (final)')
    expect(motionMeaning('chat_하품')).toBe('bocejo')
    expect(motionMeaning('알수없음')).toBe('')
  })

  it('separa por categoria', () => {
    expect(describeMotion('샌드웻지샷게걸음').category).toBe('Wedge')
    expect(describeMotion('chat_박수').category).toBe('Emoções (chat)')
    expect(describeMotion('헬기등장모션_item')).toEqual({
      category: 'Entrada e itens',
      text: 'entrada com helicóptero',
    })
  })
})

import { describe, expect, it } from 'vitest'
import { golfMotions, motionMeaning, reactionForScore, reactionMotion } from './motions.ts'

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
    expect(reactionForScore(6, 4)).toBe('bogey')
    expect(reactionMotion(azer, 'birdie')).toBe('버디승리포즈')
    expect(reactionMotion(azer, 'trouble')).toBe('타임오버벙커OB실망포즈')
    expect(reactionMotion(azer, 'eagle')).toBe('버디승리포즈')
  })
})

describe('motionMeaning', () => {
  it('traduz taco + ação e poses conhecidas', () => {
    expect(motionMeaning('우드샷파워준비')).toBe('madeira: backswing (sobe até o topo)')
    expect(motionMeaning('퍼팅샷')).toBe('putter: tacada')
    expect(motionMeaning('버디승리포즈')).toBe('comemoração de birdie')
    expect(motionMeaning('알수없음')).toBe('')
  })
})

import { describe, expect, it } from 'vitest'
import { ballLabel } from './balls.ts'

describe('nomes das bolas', () => {
  it('traduz as palavras conhecidas do cliente japonês', () => {
    expect(ballLabel('アズテック')).toBe('Aztec')
    expect(ballLabel('爆弾アズテック')).toBe('Bomba Aztec')
    expect(ballLabel('Blue Lagoonアズテック')).toBe('Blue Lagoon Aztec')
    expect(ballLabel('2周年記念アズテック')).toBe('2º aniversário Aztec')
    expect(ballLabel('ハローキティピンクアズテック')).toBe('Hello Kitty ピンク Aztec')
    expect(ballLabel('?????')).toBe('?????')
  })
})

import { describe, expect, it } from 'vitest'
import { chainNext, eventsBetween, motionEvents, shotFrame } from './motion-events.ts'

const motions = [
  { name: '우드샷준비', frameStart: 0, frameEnd: 240, next: '우드샷디폴트' },
  { name: '우드샷디폴트', frameStart: 241, frameEnd: 285, next: '우드샷준비' },
  { name: '우드샷', frameStart: 300, frameEnd: 350, next: '우드샷끝' },
  { name: '우드샷끝', frameStart: 350, frameEnd: 350, next: '우드샷끝' },
]

describe('eventos das animações', () => {
  const events = motionEvents(motions, [
    { frame: 330, text: '*shot  *fx("@우드샷" "airnight_3.seq" "&201326636" "head_wood")' },
    { frame: 314, text: '*swing' },
    { frame: 250, text: '*snd("a-휘익")' },
    { frame: 260, text: '' },
  ])

  it('separa por movimento, em segundos, na ordem', () => {
    expect(
      events.get('우드샷')!.map((e) => [Math.round(e.time * 30), e.commands[0]!.name]),
    ).toEqual([
      [14, 'swing'],
      [30, 'shot'],
    ])
    expect(events.get('우드샷디폴트')![0]!.commands).toEqual([{ name: 'snd', args: ['a-휘익'] }])
    expect(events.has('우드샷준비')).toBe(false)
  })

  it('acha o quadro do impacto e os eventos de um trecho', () => {
    expect(shotFrame(events.get('우드샷'))).toBe(30)
    expect(eventsBetween(events.get('우드샷'), 0.5, 1)).toHaveLength(1)
    expect(eventsBetween(events.get('우드샷'), 1, 2)).toHaveLength(0)
  })

  it('encadeia só os movimentos em ciclo de dois', () => {
    expect(chainNext(motions, '우드샷준비')).toBe('우드샷디폴트')
    expect(chainNext(motions, '우드샷디폴트')).toBe('우드샷준비')
    expect(chainNext(motions, '우드샷')).toBeUndefined()
    expect(chainNext(motions, '우드샷끝')).toBeUndefined()
  })
})

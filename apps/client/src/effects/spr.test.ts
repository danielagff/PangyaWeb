import { describe, expect, it } from 'vitest'
import { curve, fadeAt, parseSeq, parseSpr, tokens } from './spr.ts'

// Trechos reais (data/effect/renewal e data/effect/spray do cliente JP).
const PANGYA_EFF = `
; 텍스처 소스       = 파일 이름, 스프라이트 폭, 스프라이트 높이, 빌보드 on/off(billboard)
Blend               = add, add
Add_Fade            = (0 %, (150, 255, 255, 255)), (100 %, (0, 255, 255, 255))
Init_Size           = (0.2, 0.3), 1
Add_Size            = (0 %, 10 %), (10 %, 280 %)
Tail                = 4, 10, (100, 255, 255, 150),~ball_straight_Blue.jpg , 120, monolith,
GenPos              = (0, 0, 0), (0, 0, 0)
Add_Generation      = (0, 1), 70, 90d
LifeTime            = (300, 500)
Init_Velocity       = (0, 0.2, 0), (0, 0.4, 0)
`
const HOLE_SPARK = `
Source              = [light_blue_001.jpg, 128, 128, off
Blend               = Add, Add
Add_Fade            = (0 %, (10, 255, 255, 100)), (90 %, (10, 255, 255, 100))
Add_Fade            = (90 %, (10, 255, 255, 100)), (100 %, (0, 255, 255, 100))
LifeTime            = (50f, 50f)
Init_Angle          = (-180d, -180d, -180d), (180d, 180d, 180d)
Add_Quake           = 0,0,0, (0f, 50, 50, 50), (50f, 5,5,5), 1f
Add_Flash           = 0f, 0f, 4f
`
const COIN = `
Source              = *pet coin.pet, petlight
Gravity             = (0, -0.03, 0)
Ground              = 0, 80 %
`
const HOLE_WIND = `
Tail             =16, 1f, (0, 255, 255, 255), [swinglight01.jpg, 1000, monolith
IsSphere            = 1
GenPos              = (0, 0, 0), ( 30, 30, 150d)
Add_GravityPoint    = (0, 0, 0), 35, 100, 0
`
const SEQ = `
; Example of Sequence
loop_a:
0000: Spray     = hole_in_spark.spr, (0, 0, 0), (0, 0, 0)
0000: Spray     =hole_in_wind.spr, (0, 0, 0), (0, 0, 0), non_strongbond
:Add_Rotation   = (0, 1, 0), (0, 3d, 5000, 0d)
2000: Spray     = hole_in_spark2.spr, (0, 0, 0), (0, 0.7, 0),strongbond
9000: stop
`

describe('efeitos do jogo (.spr/.seq)', () => {
  it('unidades: quadros, graus, porcentagem e nomes de arquivo com números', () => {
    expect(tokens('(50f, 90d), 10 %, [light_blue_001.jpg, 128')).toEqual([
      (50 * 1000) / 30,
      Math.PI / 2,
      0.1,
      '[light_blue_001.jpg',
      128,
    ])
  })

  it('lê o brilho do PANGYA: rastro, cor, tamanho, quantas e velocidade', () => {
    const def = parseSpr(PANGYA_EFF)
    expect(def.blend).toBe('add')
    expect(def.texture).toBeUndefined()
    expect(def.tail).toEqual({
      length: 4,
      interval: 10,
      end: [100 / 255, 1, 1, 150 / 255],
      file: '~ball_straight_Blue.jpg',
      width: 120,
    })
    expect(def.generation).toEqual([{ start: 0, end: 1, count: 70, cone: Math.PI / 2 }])
    expect(def.life).toEqual([300, 500])
    expect(def.velocity).toEqual([
      [0, 0.2, 0],
      [0, 0.4, 0],
    ])
    expect(def.fade[0]).toEqual({ from: 0, a: [150 / 255, 1, 1, 1], to: 1, b: [0, 1, 1, 1] })
    expect(curve(def.sizeCurve, 0.05)).toBeCloseTo(1.45)
    expect(curve(def.sizeCurve, 0.5)).toBeCloseTo(2.8)
  })

  it('textura com quadros, vida em quadros, tremida e clarão', () => {
    const def = parseSpr(HOLE_SPARK)
    expect(def.texture).toEqual({
      file: '[light_blue_001.jpg',
      cellWidth: 128,
      cellHeight: 128,
      billboard: false,
    })
    expect(def.life[0]).toBeCloseTo(1666.7, 0)
    expect(def.quake?.from).toEqual([50, 50, 50])
    expect(def.quake?.end).toBeCloseTo(1666.7, 0)
    expect(def.flash?.end).toBeCloseTo(133.3, 0)
    expect(fadeAt(def.fade, 0.95)[0]).toBeCloseTo(5 / 255)
  })

  it('modelo, gravidade, chão, gerador esférico e gravidade de ponto', () => {
    const coin = parseSpr(COIN)
    expect(coin.pet).toBe('coin.pet')
    expect(coin.gravity).toEqual([0, -0.03, 0])
    expect(coin.ground).toEqual({ y: 0, bounce: 0.8 })
    const wind = parseSpr(HOLE_WIND)
    expect(wind.genPos).toEqual({
      sphere: true,
      center: [0, 0, 0],
      near: 30,
      far: 30,
      cone: (150 * Math.PI) / 180,
    })
    expect(wind.gravityPoint).toEqual({ center: [0, 0, 0], strength: 35, range: 100, outside: 0 })
    expect(wind.tail?.interval).toBeCloseTo(33.3, 0)
  })

  it('sequência: sprays por tempo, velocidade, preso ou solto, e o fim', () => {
    const seq = parseSeq(SEQ)
    expect(seq.stop).toBe(9000)
    expect(seq.events.map((e) => [e.time, e.file, e.attached])).toEqual([
      [0, 'hole_in_spark.spr', false],
      [0, 'hole_in_wind.spr', false],
      [2000, 'hole_in_spark2.spr', true],
    ])
    expect(seq.events[2]!.velocity).toEqual([0, 0.7, 0])
  })
})

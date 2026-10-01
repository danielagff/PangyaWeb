import { describe, expect, it } from 'vitest'
import { parseCourseProperty } from './property.ts'

const XML = `<?xml version="1.0" encoding="euc-kr" standalone="yes" ?>
<round name="blue">
    <declare count="3">
        <class name="default" sort="지면">
            <bound>0.5</bound>
            <roll>0.5</roll>
            <min>90.0</min>
            <max>100.0</max>
            <pass>0</pass>
            <pet>rought.pet</pet>
        </class>
        <class name="그린" sort="지면">
            <bound>0.3</bound>
            <roll>0.18</roll>
            <min>99</min>
            <max>100.0</max>
            <bound_sound>공_그린.wav</bound_sound>
            <pet>green.pet</pet>
            <textures>
                <item>grass17.dds</item>
            </textures>
        </class>
        <class name="벙커" sort="지면">
            <bound>0.1</bound>
            <roll>0.6</roll>
            <min>80</min>
            <max>85</max>
            <min2>70</min2>
            <max2>80</max2>
            <textures>
                <item>grass13.dds</item>
            </textures>
        </class>
        <class name="통과 (잎사귀 그룹)" sort="오브젝트">
            <bound>0.75</bound>
            <roll>0.5</roll>
            <pass>1</pass>
        </class>
    </declare>
</round>`

describe('parseCourseProperty', () => {
  const property = parseCourseProperty(XML)

  it('lê as classes com coeficientes e faixa de força', () => {
    expect(property.round).toBe('blue')
    expect(property.classes.map((c) => c.kind)).toEqual(['default', 'green', 'bunker', 'leafPass'])
    expect(property.classes[1]).toMatchObject({
      bound: 0.3,
      roll: 0.18,
      power: { min: 99, max: 100 },
      pet: 'green.pet',
      textures: ['grass17.dds'],
    })
    expect(property.classes[2]!.power2).toEqual({ min: 70, max: 80 })
    expect(property.classes[3]!.pass).toBe(true)
  })

  it('descobre o piso pela textura do terreno', () => {
    expect(property.surfaceOf('GRASS17.DDS').kind).toBe('green')
    expect(property.surfaceOf('grass13.dds').roll).toBe(0.6)
    expect(property.surfaceOf('textura_desconhecida.dds').kind).toBe('default')
  })
})

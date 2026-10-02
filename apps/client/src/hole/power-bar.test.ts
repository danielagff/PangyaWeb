import { describe, expect, it } from 'vitest'
import { CALIBRATOR_STEP, percentText, stepCalibrator } from './power-bar.ts'

describe('régua da barra de força', () => {
  it('força com uma casa e vírgula', () => {
    expect(percentText(0.735)).toBe('73,5%')
    expect(percentText(1)).toBe('100,0%')
    expect(percentText(0)).toBe('0,0%')
    expect(percentText(0.12345)).toBe('12,3%')
  })

  it('calibrador: X sobe e Z desce 0,1% (Shift 1%), preso entre 0 e 100%', () => {
    expect(stepCalibrator(0.6, 3)).toBe(0.603)
    expect(stepCalibrator(0.603, -1)).toBe(0.602)
    expect(stepCalibrator(0.602, 1, CALIBRATOR_STEP.coarse)).toBe(0.612)
    expect(stepCalibrator(0.9995, 2)).toBe(1)
    expect(stepCalibrator(0.0004, -1)).toBe(0)
    expect(stepCalibrator(0.73456, 0)).toBe(0.735) // clique: arredonda em décimos de %
  })
})

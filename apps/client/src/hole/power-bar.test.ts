import { describe, expect, it } from 'vitest'
import { percentText } from './power-bar.ts'

describe('régua da barra de força', () => {
  it('força com uma casa e vírgula', () => {
    expect(percentText(0.735)).toBe('73,5%')
    expect(percentText(1)).toBe('100,0%')
    expect(percentText(0)).toBe('0,0%')
    expect(percentText(0.12345)).toBe('12,3%')
  })
})

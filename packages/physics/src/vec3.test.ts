import { describe, expect, it } from 'vitest'
import { vec3 } from './vec3.ts'

describe('vec3', () => {
  it('soma, subtrai e escala', () => {
    const a = vec3.of(1, 2, 3)
    const b = vec3.of(4, 5, 6)
    expect(vec3.add(a, b)).toEqual(vec3.of(5, 7, 9))
    expect(vec3.sub(b, a)).toEqual(vec3.of(3, 3, 3))
    expect(vec3.scale(a, 2)).toEqual(vec3.of(2, 4, 6))
  })

  it('calcula produto escalar e comprimento', () => {
    expect(vec3.dot(vec3.of(1, 0, 0), vec3.of(0, 1, 0))).toBe(0)
    expect(vec3.length(vec3.of(3, 4, 0))).toBe(5)
  })
})

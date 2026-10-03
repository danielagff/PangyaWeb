import { describe, expect, it } from 'vitest'
import { CAMERA_NAME, extensionCounts, findCameraMarkers } from './camera-search.ts'

const bytes = (...parts: (string | number[])[]) =>
  Uint8Array.from(
    parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)),
  )

describe('busca da câmera', () => {
  it('acha palavras de câmera em inglês (sem maiúsculas), UTF-16 e coreano CP949', () => {
    const found = findCameraMarkers(
      bytes(
        'xx ShotCamera=3 yy',
        [0, 0],
        [...'camera'].flatMap((c) => [c.charCodeAt(0), 0]),
        [0],
        [0xc4, 0xab, 0xb8, 0xde, 0xb6, 0xf3], // 카메라
      ),
    )
    expect(found.some((f) => f.startsWith('camera @7: xx ShotCamera=3 yy'))).toBe(true)
    expect(found.some((f) => f.startsWith('camera (UTF-16)'))).toBe(true)
    expect(found.some((f) => f.startsWith('카메라'))).toBe(true)
    expect(findCameraMarkers(bytes('nada aqui'))).toEqual([])
  })

  it('nomes com cara de câmera e contagem por extensão', () => {
    expect(CAMERA_NAME.test('data/camera/shot.dat')).toBe(true)
    expect(CAMERA_NAME.test('data/연출/a.xml')).toBe(true)
    expect(CAMERA_NAME.test('data/shot_cam01.dat')).toBe(true)
    expect(CAMERA_NAME.test('data/sound/birdie.wav')).toBe(false)
    expect(CAMERA_NAME.test('data/avatar/teste/t_camisa.jpg')).toBe(false)
    expect(extensionCounts(['a.iff', 'b.IFF', 'c.wav', 'd'])).toEqual([
      ['iff', 2],
      ['wav', 1],
      ['(sem)', 1],
    ])
  })
})

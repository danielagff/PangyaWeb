import type { Pet } from '@pangya/formats'
import { describe, expect, it } from 'vitest'
import { CameraPath, cameraPathName } from './camera-path.ts'

const s = Math.SQRT1_2
/** Câmera em (0, 2, -10) olhando para +Z (rotação gravada invertida, como no jogo). */
const pet = {
  bones: [
    { name: 'DummyRoot', parent: -1, matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
    { name: 'Camera01', parent: 0, matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
  ],
  animations: [
    { bone: 0, position: [{ time: 0, value: [0, 1, 0] }], rotation: [], scale: [] },
    {
      bone: 1,
      position: [
        { time: 0, value: [0, 1, -10] },
        { time: 1, value: [0, 1, -20] },
      ],
      rotation: [{ time: 0, value: [s, 0, 0, s] }],
      scale: [],
    },
  ],
  motions: [
    {
      name: '버디승리포즈_01',
      frameStart: 0,
      frameEnd: 20,
      next: '버디승리포즈_01-1',
      rootBone: '',
    },
    { name: '버디승리포즈_01-1', frameStart: 21, frameEnd: 30, next: '', rootBone: '' },
    { name: '버디승리포즈_01끝', frameStart: 30, frameEnd: 30, next: '', rootBone: '' },
    { name: '버디승리포즈_02', frameStart: 31, frameEnd: 40, next: '', rootBone: '' },
    { name: '버디승리포즈_02끝', frameStart: 40, frameEnd: 40, next: '', rootBone: '' },
  ],
} as unknown as Pet

describe('câmeras animadas do jogo', () => {
  it('posição (com a do DummyRoot) e orientação: olha pelo −Y, para cima +Z', () => {
    const pose = new CameraPath(pet).pose(0)!
    expect(pose.position.toArray().map((v) => +v.toFixed(3) + 0)).toEqual([0, 2, -10])
    expect(pose.forward.toArray().map((v) => +v.toFixed(3) + 0)).toEqual([0, 0, 1])
    expect(pose.up.toArray().map((v) => +v.toFixed(3) + 0)).toEqual([0, 1, 0])
    // Meio segundo depois (15 quadros): no meio do caminho.
    expect(new CameraPath(pet).pose(15)!.position.z).toBeCloseTo(-15)
  })

  it('sorteia uma das versões e vai até o quadro final parado', () => {
    const path = new CameraPath(pet)
    expect(path.segment('버디승리포즈', () => 0)).toEqual({
      name: '버디승리포즈_01',
      start: 0,
      end: 30,
    })
    expect(path.segment('버디승리포즈', () => 0.9)).toEqual({
      name: '버디승리포즈_02',
      start: 31,
      end: 40,
    })
    expect(path.segment('이글승리포즈')).toBeUndefined()
  })

  it('nome do arquivo pelo esqueleto', () => {
    expect(cameraPathName('data/avatar/a_azer/a_def.bpet')).toBe('a_def_cam.apet')
    expect(cameraPathName('data/avatar/ff_hana/ff_hana_def.bpet')).toBe('ff_hana_def_cam.apet')
  })
})

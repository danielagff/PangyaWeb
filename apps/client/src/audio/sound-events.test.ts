import { describe, expect, it } from 'vitest'
import {
  audioFiles,
  courseMusicEvent,
  guessVoicePrefix,
  resolveEvent,
  resolveVoice,
  scoreSound,
  scoreVoice,
  SOUND_EVENTS,
  voiceFiles,
  type SoundChoices,
} from './sound-events.ts'

/** Arquivos inventados no formato do cliente (nomes em coreano, vozes <prefixo>_<código><n>). */
const FILES = audioFiles([
  'data/sound/effect/공_그린.wav',
  'data/sound/effect/충돌_rough2.wav',
  'data/sound/effect/구름_rough.wav',
  'data/sound/effect/팡야.wav',
  'data/sound/effect/타격1.wav',
  'data/sound/effect/타격2.wav',
  'data/sound/effect/컵인.wav',
  'data/sound/effect/홀인원.wav',
  'data/sound/effect/파.wav',
  'data/sound/effect/파도.wav',
  'data/sound/effect/파워샷.wav',
  'data/sound/effect/박수.wav',
  'data/sound/voice/kaz_py1.wav',
  'data/sound/voice/kaz_py2.wav',
  'data/sound/voice/kaz_par1.wav',
  'data/sound/voice/cesil_bi1.wav',
  'data/round02_blue/sound/blue_bgm.mp3',
  'data/sound/bgm/lobby.mp3',
  'data/avatar/h_kaz/h_def.bpet',
])
const byId = (id: string) => SOUND_EVENTS.find((e) => e.id === id)!
const none: SoundChoices = { events: {}, voices: {} }

describe('sons: escolha automática pelo nome', () => {
  it('acha os efeitos pelos nomes em coreano', () => {
    expect(resolveEvent(byId('pangya'), none, FILES).files).toEqual(['data/sound/effect/팡야.wav'])
    expect(resolveEvent(byId('shot'), none, FILES).files).toEqual([
      'data/sound/effect/타격1.wav',
      'data/sound/effect/타격2.wav',
    ])
    // "컵인" é a cova; "홀인원" não (é o hole in one).
    expect(resolveEvent(byId('cup'), none, FILES).files).toEqual(['data/sound/effect/컵인.wav'])
    expect(resolveEvent(byId('holeInOne'), none, FILES).files).toEqual([
      'data/sound/effect/홀인원.wav',
    ])
    // "파" (par) não pega "파도" (onda) nem "파워샷".
    expect(resolveEvent(byId('par'), none, FILES).files).toEqual(['data/sound/effect/파.wav'])
    expect(resolveEvent(byId('powerShot'), none, FILES).files).toEqual([
      'data/sound/effect/파워샷.wav',
    ])
  })

  it('sem arquivo: sintetizado ou mudo', () => {
    expect(resolveEvent(byId('miss'), none, FILES)).toEqual({ files: [], source: 'synth' })
    expect(resolveEvent(byId('uiBack'), none, FILES)).toEqual({ files: [], source: 'none' })
  })

  it('a escolha do mapeador vale mais; lista vazia = sem som', () => {
    const choices: SoundChoices = {
      events: { pangya: ['data/sound/effect/박수.wav'], shot: [] },
      voices: {},
    }
    expect(resolveEvent(byId('pangya'), choices, FILES)).toEqual({
      files: ['data/sound/effect/박수.wav'],
      source: 'chosen',
    })
    expect(resolveEvent(byId('shot'), choices, FILES)).toEqual({ files: [], source: 'none' })
  })

  it('música: a da pasta do curso e a do menu (só arquivos de música)', () => {
    const blue = courseMusicEvent('round02_blue', 'blue', 'Blue Lagoon')
    expect(resolveEvent(blue, none, FILES).files).toEqual(['data/round02_blue/sound/blue_bgm.mp3'])
    expect(resolveEvent(byId('musicMenu'), none, FILES).files).toEqual(['data/sound/bgm/lobby.mp3'])
  })

  it('vozes por prefixo e código', () => {
    const voices = voiceFiles(FILES)
    expect([...voices.keys()].sort()).toEqual(['cesil', 'kaz'])
    expect(voices.get('kaz')!.get('py')).toEqual([
      'data/sound/voice/kaz_py1.wav',
      'data/sound/voice/kaz_py2.wav',
    ])
    // Vozes não entram como efeito ("kaz_par1" não é o som do par).
    expect(resolveEvent(byId('par'), none, FILES).files).not.toContain(
      'data/sound/voice/kaz_par1.wav',
    )
  })

  it('voz do personagem pela pasta, pelo nome ou pela letra', () => {
    const prefixes = ['kaz', 'cesil', 'a']
    expect(guessVoicePrefix('data/avatar/h_kaz/h_def', prefixes)).toBe('kaz')
    expect(guessVoicePrefix('data/avatar/c_cesillia/c_def', prefixes)).toBe('cesil')
    expect(guessVoicePrefix('data/avatar/a_nuri/a_def', prefixes)).toBe('a')
    expect(guessVoicePrefix('data/avatar/z_nada/z_def', prefixes)).toBeUndefined()
    const choices: SoundChoices = { events: {}, voices: { 'data/avatar/h_kaz/h_def': '' } }
    expect(resolveVoice('data/avatar/h_kaz/h_def', choices, prefixes)).toEqual({
      prefix: undefined,
      source: 'none',
    })
  })

  it('som e voz do resultado', () => {
    expect(scoreSound(1, 3)).toBe('holeInOne')
    expect(scoreSound(2, 5)).toBe('albatross')
    expect(scoreSound(3, 4)).toBe('birdie')
    expect(scoreSound(6, 4)).toBe('doubleBogey')
    expect(scoreVoice(1, 3)).toBe('ha')
    expect(scoreVoice(4, 4)).toBe('par')
    expect(scoreVoice(5, 4)).toBe('bo')
  })
})

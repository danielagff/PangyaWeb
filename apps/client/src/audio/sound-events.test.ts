import { describe, expect, it } from 'vitest'
import {
  audioFiles,
  characterNumber,
  courseMusicEvent,
  guessVoicePrefix,
  resolveEvent,
  resolveVoice,
  scoreSound,
  scoreVoice,
  SOUND_EVENTS,
  voiceFiles,
  voicePrefixesFor,
  type SoundChoices,
} from './sound-events.ts'

/** Arquivos inventados no formato do cliente (nomes em coreano; vozes <pacote>_<nº>_<fala><n>). */
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
  'data/sound/voice/v2_club_7_py1.wav',
  'data/sound/voice/v2_club_7_py2.wav',
  'data/sound/voice/v2_club_7_par1.wav',
  'data/sound/voice/v2_club_7_bi1.wav',
  'data/sound/voice/2013_thanksgiving_7_pangya0.wav',
  'data/sound/voice/2013_thanksgiving_7_dbobey0.wav',
  'data/sound/voice/v2_club_10_py1.wav',
  'data/sound/voice/v2_club_0_py1.wav',
  'data/sound/effect/birdie.wav',
  'data/round02_blue/sound/blue_bgm.mp3',
  'data/sound/bgm/bgm_grandprix_lobby.mp3',
  'data/sound/bgm/lobby.mp3',
  'data/sound/bgm/bgm_under_par.mp3',
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
    // A música do Grand Prix não serve para o menu.
    expect(resolveEvent(byId('musicMenu'), none, FILES).files).toEqual(['data/sound/bgm/lobby.mp3'])
    expect(resolveEvent(byId('musicHoleGood'), none, FILES).files).toEqual([
      'data/sound/bgm/bgm_under_par.mp3',
    ])
  })

  it('vozes por pacote e fala (código ou palavra)', () => {
    const voices = voiceFiles(FILES)
    expect([...voices.keys()].sort()).toEqual([
      '2013_thanksgiving_7',
      'v2_club_0',
      'v2_club_10',
      'v2_club_7',
    ])
    expect(voices.get('v2_club_7')!.get('py')).toEqual([
      'data/sound/voice/v2_club_7_py1.wav',
      'data/sound/voice/v2_club_7_py2.wav',
    ])
    // "pangya0" = "Pangya!"; "dbobey" (erro do jogo) = double bogey.
    expect(voices.get('2013_thanksgiving_7')!.get('py')).toEqual([
      'data/sound/voice/2013_thanksgiving_7_pangya0.wav',
    ])
    expect(voices.get('2013_thanksgiving_7')!.has('dbo')).toBe(true)
    // Vozes não entram como efeito ("…_par1" não é o som do par; "birdie.wav" é).
    expect(resolveEvent(byId('par'), none, FILES).files).toEqual(['data/sound/effect/파.wav'])
    expect(resolveEvent(byId('birdie'), none, FILES).files).toEqual([
      'data/sound/effect/birdie.wav',
    ])
  })

  it('voz do personagem pelo número dele, no pacote mais completo', () => {
    expect(characterNumber('data/avatar/h_kaz/h_def')).toBe(7)
    expect(characterNumber('data/avatar/female/f_def')).toBe(1)
    expect(characterNumber('data/avatar/ff_hana/ff_hana_def')).toBe(12)
    expect(characterNumber('data/avatar/cc_cesillia/cc_def')).toBe(14)
    expect(characterNumber('data/avatar/teste/t_def')).toBeUndefined()
    const voices = voiceFiles(FILES)
    expect(voicePrefixesFor('data/avatar/h_kaz/h_def', voices)).toEqual([
      'v2_club_7', // 3 falas
      '2013_thanksgiving_7', // 2 falas
    ])
    // Nuri (0) não pega o pacote da Spika (10).
    expect(voicePrefixesFor('data/avatar/m/m_def', voices)).toEqual(['v2_club_0'])
    expect(guessVoicePrefix('data/avatar/i_lucia/i_def', voices)).toBeUndefined()
    const choices: SoundChoices = { events: {}, voices: { 'data/avatar/h_kaz/h_def': '' } }
    expect(resolveVoice('data/avatar/h_kaz/h_def', choices, voices)).toEqual({
      prefix: undefined,
      source: 'none',
    })
  })

  it('personagem de teste: voz pela letra do arquivo', () => {
    const voices = voiceFiles(audioFiles(['data/sound/teste/voice/t_py1.wav']))
    expect(guessVoicePrefix('data/avatar/teste/t_def', voices)).toBe('t')
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

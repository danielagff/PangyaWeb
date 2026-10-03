import { describe, expect, it } from 'vitest'
import {
  ambientFiles,
  audioFiles,
  characterNumber,
  courseMusicEvent,
  guessVoicePrefix,
  resolveEvent,
  resolveVoice,
  scoreSound,
  scoreVoice,
  SOUND_EVENTS,
  npcSoundFiles,
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

describe('sons: nomes reais do cliente JP (diagnóstico de 03/10/2026)', () => {
  const REAL = audioFiles([
    'data/sound/ball/공_홀인.wav',
    'data/sound/ball/공_컵점프1.wav',
    'data/sound/ball/공_홀맞기.wav',
    'data/sound/ball/공_그린.wav',
    'data/sound/ambient/갤러리_박수.wav',
    'data/sound/ambient/갤러리_와우.wav',
    'data/sound/ambient/갤러리_오.wav',
    'data/sound/ambient/갤러리_실망.wav',
    'data/sound/ambient/바다소리.wav',
    'data/sound/ambient/갈매기울음.wav',
    'data/sound/바다소리2.wav',
    'data/sound/나이스샷.wav',
    'data/sound/팡야.wav',
    'data/sound/ball/gorgeous_pangya.wav',
    'data/sound/lobby/coffee_time.mp3',
    'data/sound/bgm/bgm_grandprix_lobby.mp3',
    'data/sound/bgm/grandprix_lobby.mp3',
    'data/sound/season2/title_r.mp3',
    'data/sound/clubset/2013_thanksgiving/08.kaz/2013_thanksgiving_7_pangya0.wav',
    'data/sound/clubset/2013_thanksgiving/08.kaz/2013_thanksgiving_7_birdie0.wav',
    'data/sound/clubset/2013_thanksgiving/08.kaz/2013_thanksgiving_7_eagle0.wav',
    'data/sound/clubset/2014_voice_club/08.kaz/2014_voice_club_7_py1.wav',
  ])

  it('cova, público, "nice shot", PANGYA e música do menu', () => {
    const files = (id: string) => resolveEvent(byId(id), none, REAL).files
    // "공_홀인" (entra), não "공_컵점프1" (pula na borda).
    expect(files('cup')).toEqual(['data/sound/ball/공_홀인.wav'])
    expect(files('applause')).toEqual(['data/sound/ambient/갤러리_박수.wav'])
    expect(files('galleryWow')).toEqual(['data/sound/ambient/갤러리_와우.wav'])
    expect(files('galleryOh')).toEqual(['data/sound/ambient/갤러리_오.wav'])
    expect(files('galleryDisappointed')).toEqual(['data/sound/ambient/갤러리_실망.wav'])
    expect(files('niceShot')).toEqual(['data/sound/나이스샷.wav'])
    expect(files('pangya')).toEqual(['data/sound/팡야.wav'])
    expect(files('musicMenu')).toEqual(['data/sound/lobby/coffee_time.mp3'])
  })

  it('música do curso pelas palavras da pasta dele', () => {
    const music = audioFiles([
      'data/sound/bgm/spring.mp3',
      'data/sound/bgm/navy_blue.mp3',
      'data/sound/bgm/shiny.mp3',
      'data/sound/bg/wizcity/adayinthewizcity.mp3',
      'data/sound/bg/wizcity/secretwish.mp3',
      'data/sound/bg/wizcity/vento.wav', // efeito da pasta: não é música
    ])
    const files = (round: string, prefix: string) =>
      resolveEvent(courseMusicEvent(round, prefix, round), none, music).files
    expect(files('round10_spring wind', 'pink')).toEqual(['data/sound/bgm/spring.mp3'])
    expect(files('round19_wizcity', 'wiz')).toEqual([
      'data/sound/bg/wizcity/adayinthewizcity.mp3',
      'data/sound/bg/wizcity/secretwish.mp3',
    ])
    expect(files('round02_blue', 'blue')).toEqual(['data/sound/bgm/navy_blue.mp3'])
    expect(files('round14_green sand', 'green')).toEqual([])
  })

  it('música do curso pela trilha oficial (Blue Lagoon = Daydream e Frog)', () => {
    const music = audioFiles([
      'data/sound/bgm/navy_blue.mp3',
      'data/sound/bgm/daydream.mp3',
      'data/sound/bgm/frog.mp3',
      'data/sound/bgm/crystal lake.mp3',
      'data/sound/bgm/crystal lake - 273k mix -.mp3',
      'data/sound/bgm/crystal_jp_miku.mp3',
      'data/sound/bg/wizcity/adayinthewizcity.mp3',
    ])
    const files = (round: string, prefix: string, name: string) =>
      resolveEvent(courseMusicEvent(round, prefix, name), none, music).files
    expect(files('round02_blue', 'blue', 'Blue Lagoon')).toEqual([
      'data/sound/bgm/daydream.mp3',
      'data/sound/bgm/frog.mp3',
    ])
    expect(files('round05_silvia', 'silvia', 'Silvia Cannon')).toEqual([
      'data/sound/bgm/navy_blue.mp3',
    ])
    expect(files('round09_icespa', 'spa', 'Ice Spa')).toEqual(['data/sound/bgm/crystal lake.mp3'])
    expect(files('round19_wizcity', 'wiz', 'Wizcity')).toEqual([
      'data/sound/bg/wizcity/adayinthewizcity.mp3',
    ])
  })

  it('som ambiente pela caixa de som e gaivotas pelos bichos do curso', () => {
    expect(ambientFiles('바다', REAL)).toEqual([
      'data/sound/ambient/바다소리.wav',
      'data/sound/바다소리2.wav',
    ])
    expect(npcSoundFiles('NPC_SeaGull.pet', REAL)).toEqual(['data/sound/ambient/갈매기울음.wav'])
    expect(npcSoundFiles('NPC_Butterfly.pet', REAL)).toEqual([])
  })

  it('voz: o taco de voz normal antes dos pacotes de evento', () => {
    const voices = voiceFiles(REAL)
    // O de evento tem mais falas aqui, mas o "2014_voice_club" vem primeiro.
    expect(voicePrefixesFor('data/avatar/h_kaz/h_def', voices)).toEqual([
      '2014_voice_club_7',
      '2013_thanksgiving_7',
    ])
  })

  it('sons da tacada e das moedas do conjunto novo do jogo (data/sound/new)', () => {
    const files = audioFiles([
      'data/sound/new/swing_tee_s.wav',
      'data/sound/new/swing_tee_w.wav',
      'data/sound/new/swing_drive_s.wav',
      'data/sound/new/swing_normal_w.wav',
      'data/sound/new/swing_putting.wav',
      'data/sound/new/swing_miss_wood.wav',
      'data/sound/new/swing_miss_iron.wav',
      'data/sound/new/shot_best_timing.wav',
      'data/sound/new/shot_good_timing.wav',
      'data/sound/new/shot_bad_timing.wav',
      'data/sound/new/shot_normal_timing.wav',
      'data/sound/클럽교체.wav',
      'data/sound/ball/ball_pass/공날아가기1.wav',
      'data/sound/ball/ball_pass/공날아가기2.wav',
      'data/sound/new/pang_coin_emit.wav',
      'data/sound/new/pang_coin_drop.wav',
      'data/sound/new/ball_fall_into_water.wav',
      'data/sound/new/ball_ob_area.wav',
      'data/sound/new/ui_button_ok_click.wav',
      'data/sound/effect/팡야.wav',
      'data/sound/스윙_wood.wav',
      'data/sound/충돌_wood.wav',
      'data/sound/충돌_fairway.wav',
    ])
    const of = (id: string) => resolveEvent(byId(id), none, files).files
    expect(of('swingTee')).toEqual([
      'data/sound/new/swing_tee_s.wav',
      'data/sound/new/swing_tee_w.wav',
    ])
    expect(of('swingWood')).toEqual(['data/sound/new/swing_drive_s.wav'])
    expect(of('swingIron')).toEqual(['data/sound/new/swing_normal_w.wav'])
    expect(of('swingPutt')).toEqual(['data/sound/new/swing_putting.wav'])
    expect(of('miss')).toEqual([
      'data/sound/new/swing_miss_iron.wav',
      'data/sound/new/swing_miss_wood.wav',
    ])
    expect(of('pangya')).toEqual(['data/sound/new/shot_best_timing.wav'])
    expect(of('powerSet')).toEqual(['data/sound/new/shot_good_timing.wav'])
    expect(of('powerMax')).toEqual(['data/sound/new/shot_best_timing.wav'])
    expect(of('timingGood')).toEqual(['data/sound/new/shot_normal_timing.wav'])
    expect(of('clubChange')).toEqual(['data/sound/클럽교체.wav'])
    expect(of('ballFly')).toEqual([
      'data/sound/ball/ball_pass/공날아가기1.wav',
      'data/sound/ball/ball_pass/공날아가기2.wav',
    ])
    expect(of('pang')).toEqual(['data/sound/new/pang_coin_emit.wav'])
    expect(of('pangDrop')).toEqual(['data/sound/new/pang_coin_drop.wav'])
    expect(of('water')).toEqual(['data/sound/new/ball_fall_into_water.wav'])
    expect(of('outOfBounds')).toEqual(['data/sound/new/ball_ob_area.wav'])
    expect(of('uiConfirm')).toEqual(['data/sound/new/ui_button_ok_click.wav'])
    expect(of('obstacle')).toEqual(['data/sound/충돌_wood.wav'])
  })
})

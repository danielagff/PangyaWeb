/**
 * Os sons do jogo: o que toca em cada momento (batida, PANGYA, cova, birdie, música do
 * curso, menus…), as vozes de cada personagem e como achar o arquivo de cada um.
 *
 * Ordem de escolha: o que o Daniel escolheu na tela "Sons" do mapeador (sons.json no
 * servidor) → o arquivo achado sozinho pelo nome → o som sintetizado (ou mudo).
 *
 * Os nomes dos arquivos do cliente são em coreano (o property.xml do curso usa
 * "공_그린.wav" — bola no green —, "충돌_rough2.wav", "구름_rough.wav"; e há "팡야.wav",
 * "나이스샷.wav"…) ou em inglês ("birdie.wav", "par.wav", "bgm_under_par.mp3"); os padrões
 * abaixo procuram nos dois. Conferido com o diagnóstico do cliente JP (6933 sons).
 */

export type SynthSound = 'hit' | 'pangya' | 'bounce' | 'roll' | 'wood' | 'water' | 'cup' | 'miss'

export type SoundCategory = 'effects' | 'voices' | 'music'

export type SoundGroup = 'Tacada' | 'Bola' | 'Resultado' | 'Música' | 'Menus'

export const SOUND_GROUPS: SoundGroup[] = ['Tacada', 'Bola', 'Resultado', 'Música', 'Menus']

export interface SoundEvent {
  id: string
  group: SoundGroup
  label: string
  category: SoundCategory
  /** Padrões do nome do arquivo (minúsculo); vale o primeiro que achar algum arquivo. */
  patterns: RegExp[]
  /** Arquivos que nunca servem para este evento (ex.: a música do Grand Prix no menu). */
  exclude?: RegExp
  /** Sem arquivo: som sintetizado (sem ele, fica mudo). */
  synth?: SynthSound
}

const event = (
  id: string,
  group: SoundGroup,
  label: string,
  patterns: RegExp[],
  synth?: SynthSound,
): SoundEvent => ({
  id,
  group,
  label,
  category: group === 'Música' ? 'music' : 'effects',
  patterns,
  ...(synth && { synth }),
})

export const SOUND_EVENTS: SoundEvent[] = [
  event('shot', 'Tacada', 'Batida normal', [/^(타격|임팩트|샷|스윙|shot|impact|hit|swing)/], 'hit'),
  event(
    'pangya',
    'Tacada',
    'Batida PANGYA',
    [/^(팡야|pangya)\./, /^(팡야|pangya)/, /(팡야|pangya)/],
    'pangya',
  ),
  event('powerShot', 'Tacada', 'Batida com power shot (junto com a batida)', [
    /^(파워샷|파워|power)/,
  ]),
  event('miss', 'Tacada', 'Batida errada', [/^(헛스윙|미스|miss)/], 'miss'),
  event('bar', 'Tacada', 'Barra de força (cada toque)', [/^(파워게이지|게이지|gauge|bar)/]),
  event('bounce', 'Bola', 'Quique (piso sem som no property.xml)', [], 'bounce'),
  event('roll', 'Bola', 'Rolando (piso sem som no property.xml)', [], 'roll'),
  event('obstacle', 'Bola', 'Bate em árvore ou objeto', [/^충돌/, /^(나무|tree|wood)/], 'wood'),
  event(
    'water',
    'Bola',
    'Cai na água',
    [/^(공_)?(물|입수|풍덩|퐁당|해저드|water|splash)/],
    'water',
  ),
  event('outOfBounds', 'Bola', 'Sai do campo (O.B.)', [/^(ob|아웃|out)(?![a-z])/]),
  event(
    'cup',
    'Bola',
    'Cai na cova',
    [/^(공_)?(컵|홀컵|cup)/, /^홀인(?!원)/, /^hole_?in(?!_?one)/],
    'cup',
  ),
  event('applause', 'Bola', 'Aplausos (bola na cova)', [
    /^(박수|환호|함성|갈채|applause|cheer|clap)/,
  ]),
  event('holeInOne', 'Resultado', 'Hole in one', [/^(홀인원|hole_?in_?one|hio)/]),
  event('albatross', 'Resultado', 'Albatross', [/^(알바트로스|알바|albatross)/]),
  event('eagle', 'Resultado', 'Eagle', [/^(이글|eagle)/]),
  event('birdie', 'Resultado', 'Birdie', [/^(버디|birdie)/]),
  event('par', 'Resultado', 'Par', [/^(파|par)[_.\d]/]),
  event('bogey', 'Resultado', 'Bogey', [/^(보기|bogey)/]),
  event('doubleBogey', 'Resultado', 'Double bogey ou pior', [/^(더블보기|double_?bogey)/]),
  event('chipIn', 'Resultado', 'Chip-in (de fora do green)', [/^(칩인|chip_?in)/]),
  {
    ...event('musicMenu', 'Música', 'Música do menu', [
      /(^|\/)(로비|lobby)[^/]*$/,
      /(타이틀|title)/,
      /(메인|main)/,
    ]),
    exclude: /grand ?prix|gp_/,
  },
  event('musicHoleGood', 'Música', 'Fim do buraco: par ou melhor', [/bgm_under_par/, /under_?par/]),
  event('musicHoleBad', 'Música', 'Fim do buraco: acima do par', [/bgm_over_par/, /over_?par/]),
  event('musicRoundEnd', 'Música', 'Fim da rodada (placar)', [/bgm_scoreboard/, /scoreboard/]),
  event('uiMove', 'Menus', 'Mudar a seleção', [/^(커서|이동|cursor|move|over)/]),
  event('uiConfirm', 'Menus', 'Confirmar', [/^(확인|결정|클릭|버튼|click|ok|confirm|button)/]),
  event('uiBack', 'Menus', 'Voltar', [/^(취소|뒤로|cancel|back)/]),
]

/** Evento pelo id. */
export const soundEvent = (id: string) => SOUND_EVENTS.find((e) => e.id === id)

/** Som do resultado do buraco pelas tacadas e o par. */
export function scoreSound(strokes: number, par: number): string {
  const diff = strokes - par
  if (strokes === 1) return 'holeInOne'
  if (diff <= -3) return 'albatross'
  if (diff === -2) return 'eagle'
  if (diff === -1) return 'birdie'
  if (diff === 0) return 'par'
  if (diff === 1) return 'bogey'
  return 'doubleBogey'
}

/** Música de cada curso: um evento por pasta do curso. */
export const musicEventId = (round: string) => `music:${round}`

export function courseMusicEvent(round: string, prefix: string, name: string): SoundEvent {
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return {
    id: musicEventId(round),
    group: 'Música',
    label: `Música: ${name}`,
    category: 'music',
    // Na pasta do curso; senão, com o prefixo do curso no nome ("blue…").
    patterns: [new RegExp(`(^|/)${escape(round.toLowerCase())}/`), new RegExp(escape(prefix))],
  }
}

// ---- vozes ----

export interface VoiceCode {
  code: string
  label: string
}

/**
 * Falas dos personagens. No Pangya elas vêm dos pacotes de voz (tacos de voz e eventos):
 * <pacote>_<nº do personagem>_<fala><n>.wav — "v2_club_7_py1.wav" ou, em alguns pacotes, com
 * a palavra: "2013_thanksgiving_7_pangya0.wav".
 */
export const VOICE_CODES: VoiceCode[] = [
  { code: 'py', label: '"Pangya!" (batida perfeita)' },
  { code: 'ps', label: 'Power shot' },
  { code: 'dps', label: '2 power shots' },
  { code: 'ha', label: 'Hole in one / albatross' },
  { code: 'e', label: 'Eagle' },
  { code: 'bi', label: 'Birdie' },
  { code: 'par', label: 'Par' },
  { code: 'bo', label: 'Bogey' },
  { code: 'dbo', label: 'Double bogey' },
  { code: 'ob', label: 'O.B.' },
  { code: 'bu', label: 'Bunker' },
  { code: 'w', label: 'Água' },
  { code: 'pre', label: 'Apresentação (escolha do personagem)' },
  { code: 'win', label: 'Ganhou' },
  { code: 'lose', label: 'Perdeu' },
]

/** Palavra de alguns pacotes → código ("dbobey" é um erro de digitação do próprio jogo). */
const VOICE_WORDS: Record<string, string> = {
  pangya: 'py',
  powershot: 'ps',
  dpowershot: 'dps',
  hioalba: 'ha',
  eagle: 'e',
  birdie: 'bi',
  bogey: 'bo',
  dbogey: 'dbo',
  dbobey: 'dbo',
  bunker: 'bu',
  water: 'w',
  preview: 'pre',
}

const VOICE_FILE = new RegExp(
  `^(.+)_(${[...VOICE_CODES.map((v) => v.code), ...Object.keys(VOICE_WORDS)].join('|')})(\\d+)\\.(wav|ogg|mp3)$`,
)

/**
 * Número do personagem nos pacotes de voz, pela letra do arquivo dele ("h_def" → Kaz, 7):
 * 0 Nuri, 1 Hana, 2 Azer, 3 Cecilia, 4 Max, 5 Kooh, 6 Arin, 7 Kaz, 8 Lucia, 9 Nell,
 * 10 Spika, 11 Nuri R, 12 Hana R, 14 Cecilia R.
 */
const CHARACTER_NUMBERS: Record<string, number> = {
  m: 0,
  f: 1,
  a: 2,
  c: 3,
  d: 4,
  e: 5,
  g: 6,
  h: 7,
  i: 8,
  j: 9,
  k: 10,
  mm: 11,
  ff: 12,
  cc: 14,
}

export function characterNumber(characterId: string): number | undefined {
  const file = characterId.toLowerCase().split('/').pop() ?? ''
  return CHARACTER_NUMBERS[file.split('_')[0] ?? '']
}

/** Voz do resultado do buraco. */
export function scoreVoice(strokes: number, par: number): string {
  const diff = strokes - par
  if (strokes === 1 || diff <= -3) return 'ha'
  if (diff === -2) return 'e'
  if (diff === -1) return 'bi'
  if (diff === 0) return 'par'
  if (diff === 1) return 'bo'
  return 'dbo'
}

const AUDIO = /\.(wav|ogg|mp3)$/
const baseName = (path: string) => (path.split('/').pop() ?? path).toLowerCase()

/** Arquivos de som entre todos os caminhos do índice. */
export const audioFiles = (paths: string[]) => paths.filter((p) => AUDIO.test(p.toLowerCase()))

/** Vozes por pacote e código: "v2_club_7" → "py" → [v2_club_7_py1.wav, v2_club_7_py2.wav]. */
export function voiceFiles(files: string[]): Map<string, Map<string, string[]>> {
  const voices = new Map<string, Map<string, string[]>>()
  for (const path of files) {
    const m = VOICE_FILE.exec(baseName(path))
    if (!m) continue
    const code = VOICE_WORDS[m[2]!] ?? m[2]!
    const codes = voices.get(m[1]!) ?? new Map<string, string[]>()
    codes.set(code, [...(codes.get(code) ?? []), path])
    voices.set(m[1]!, codes)
  }
  for (const codes of voices.values())
    for (const list of codes.values()) list.sort((a, b) => a.localeCompare(b))
  return voices
}

export type VoiceFiles = Map<string, Map<string, string[]>>

/**
 * Pacotes de voz de um personagem, do mais completo (mais falas diferentes) ao menos: os que
 * terminam com o número dele ("v2_club_7"). Sem número (personagem de teste), pelo nome da
 * pasta ("h_kaz"), o nome sem a letra ("kaz") ou a letra ("h").
 */
export function voicePrefixesFor(characterId: string, voices: VoiceFiles): string[] {
  const prefixes = [...voices.keys()]
  const number = characterNumber(characterId)
  if (number !== undefined) {
    const mine = new RegExp(`(^|_)${number}$`)
    return prefixes
      .filter((p) => mine.test(p))
      .sort((a, b) => voices.get(b)!.size - voices.get(a)!.size || a.localeCompare(b))
  }
  const parts = characterId.toLowerCase().split('/')
  const folder = parts.at(-2) ?? ''
  const name = folder.replace(/^[a-z]_/, '')
  const letter = /^([a-z])_/.exec(folder)?.[1] ?? /^([a-z])_/.exec(parts.at(-1) ?? '')?.[1]
  return [folder, name, letter].filter((x): x is string => Boolean(x) && prefixes.includes(x!))
}

/** Pacote de voz escolhido sozinho para o personagem (o mais completo). */
export const guessVoicePrefix = (characterId: string, voices: VoiceFiles) =>
  voicePrefixesFor(characterId, voices)[0]

// ---- escolha ----

export interface SoundChoices {
  /** Arquivos escolhidos por evento (caminho no índice; [] = sem som). */
  events: Record<string, string[]>
  /** Prefixo da voz por personagem (id do catálogo; '' = sem voz). */
  voices: Record<string, string>
}

export const emptyChoices = (): SoundChoices => ({ events: {}, voices: {} })

/** Arquivo que parece música (para não tocar um efeito como música). */
const isMusic = (path: string) =>
  /\.(mp3|ogg)$/.test(path) || /(bgm|music|음악|배경)/.test(path.toLowerCase())

/** Arquivos achados sozinhos para o evento: os do primeiro padrão que casar (até 6). */
export function autoFiles(sound: SoundEvent, files: string[]): string[] {
  const candidates = files.filter(
    (f) =>
      !VOICE_FILE.test(baseName(f)) &&
      (sound.category !== 'music' || isMusic(f)) &&
      !sound.exclude?.test(f.toLowerCase()),
  )
  for (const pattern of sound.patterns) {
    const test = (f: string) =>
      sound.category === 'music' ? pattern.test(f.toLowerCase()) : pattern.test(baseName(f))
    const found = candidates.filter(test).sort((a, b) => a.localeCompare(b))
    if (found.length) return found.slice(0, 6)
  }
  return []
}

export type ChoiceSource = 'chosen' | 'auto' | 'synth' | 'none'

/** Arquivos que tocam no evento e de onde vieram. */
export function resolveEvent(
  sound: SoundEvent,
  choices: SoundChoices,
  files: string[],
): { files: string[]; source: ChoiceSource } {
  const chosen = choices.events[sound.id]
  if (chosen) return { files: chosen, source: chosen.length ? 'chosen' : 'none' }
  const auto = autoFiles(sound, files)
  if (auto.length) return { files: auto, source: 'auto' }
  return { files: [], source: sound.synth ? 'synth' : 'none' }
}

/** Pacote de voz do personagem: o escolhido no mapeador ou o achado sozinho. */
export function resolveVoice(
  characterId: string,
  choices: SoundChoices,
  voices: VoiceFiles,
): { prefix: string | undefined; source: 'chosen' | 'auto' | 'none' } {
  const chosen = choices.voices[characterId]
  if (chosen !== undefined)
    return { prefix: chosen || undefined, source: chosen ? 'chosen' : 'none' }
  const auto = guessVoicePrefix(characterId, voices)
  return { prefix: auto, source: auto ? 'auto' : 'none' }
}

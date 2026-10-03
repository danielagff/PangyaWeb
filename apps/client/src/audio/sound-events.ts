/**
 * Os sons do jogo: o que toca em cada momento (batida, PANGYA, cova, birdie, música do
 * curso, menus…), as vozes de cada personagem e como achar o arquivo de cada um.
 *
 * Ordem de escolha: o que o Daniel escolheu na tela "Sons" do mapeador (sons.json no
 * servidor) → o arquivo achado sozinho pelo nome → o som sintetizado (ou mudo).
 *
 * Os nomes dos arquivos do cliente são em coreano (o property.xml do curso usa
 * "공_그린.wav" — bola no green —, "충돌_rough2.wav", "구름_rough.wav"); os padrões abaixo
 * procuram em coreano e em inglês e ainda precisam ser conferidos com a extração completa.
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
  event('pangya', 'Tacada', 'Batida PANGYA', [/^(팡야|pangya)/, /(팡야|pangya)/], 'pangya'),
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
  event('musicMenu', 'Música', 'Música do menu', [/(로비|타이틀|메인|lobby|title|menu|main)/]),
  event('uiMove', 'Menus', 'Mudar a seleção', [/^(커서|이동|cursor|move|over)/]),
  event('uiConfirm', 'Menus', 'Confirmar', [/^(확인|결정|클릭|버튼|click|ok|confirm|button)/]),
  event('uiBack', 'Menus', 'Voltar', [/^(취소|뒤로|cancel|back)/]),
]

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

/** Códigos das vozes (<prefixo>_<código><n>.wav). "?" = significado ainda a conferir. */
export const VOICE_CODES: VoiceCode[] = [
  { code: 'py', label: '"Pangya!" (batida perfeita)' },
  { code: 'ps', label: 'Power shot' },
  { code: 'dps', label: '2 power shots' },
  { code: 'ha', label: 'Hole in one / albatross?' },
  { code: 'e', label: 'Eagle?' },
  { code: 'bi', label: 'Birdie' },
  { code: 'par', label: 'Par' },
  { code: 'bo', label: 'Bogey' },
  { code: 'dbo', label: 'Double bogey' },
  { code: 'ob', label: 'O.B.' },
  { code: 'bu', label: 'Bunker?' },
  { code: 'w', label: 'Água?' },
  { code: 'pre', label: 'Antes da tacada?' },
  { code: 'win', label: 'Ganhou' },
  { code: 'lose', label: 'Perdeu' },
]

const VOICE_FILE = /^(.+)_(bi|bo|bu|dbo|dps|e|ha|lose|ob|par|pre|ps|py|w|win)(\d+)\.(wav|ogg|mp3)$/

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

/** Vozes por prefixo e código: "kaz" → "py" → [kaz_py1.wav, kaz_py2.wav]. */
export function voiceFiles(files: string[]): Map<string, Map<string, string[]>> {
  const voices = new Map<string, Map<string, string[]>>()
  for (const path of files) {
    const m = VOICE_FILE.exec(baseName(path))
    if (!m) continue
    const codes = voices.get(m[1]!) ?? new Map<string, string[]>()
    codes.set(m[2]!, [...(codes.get(m[2]!) ?? []), path])
    voices.set(m[1]!, codes)
  }
  for (const codes of voices.values())
    for (const list of codes.values()) list.sort((a, b) => a.localeCompare(b))
  return voices
}

/**
 * Prefixo de voz de um personagem pelo id do catálogo ("data/avatar/h_kaz/h_def"): a pasta
 * ("h_kaz"), o nome sem a letra ("kaz") ou a letra ("h").
 */
export function guessVoicePrefix(characterId: string, prefixes: string[]): string | undefined {
  const parts = characterId.toLowerCase().split('/')
  const folder = parts.at(-2) ?? ''
  const name = folder.replace(/^[a-z]_/, '')
  const letter = /^([a-z])_/.exec(folder)?.[1] ?? /^([a-z])_/.exec(parts.at(-1) ?? '')?.[1]
  const wanted = [folder, name, letter].filter((x): x is string => Boolean(x))
  for (const want of wanted) if (prefixes.includes(want)) return want
  // Nome parecido ("cecilia" × "cesillia"): mesmo começo de 3 letras ou mais.
  if (name.length >= 3) {
    return prefixes.find(
      (p) => p.length >= 3 && (p.startsWith(name.slice(0, 3)) || name.startsWith(p)),
    )
  }
  return undefined
}

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
    (f) => !VOICE_FILE.test(baseName(f)) && (sound.category !== 'music' || isMusic(f)),
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

/** Prefixo da voz do personagem: o escolhido ou o achado pelo nome. */
export function resolveVoice(
  characterId: string,
  choices: SoundChoices,
  prefixes: string[],
): { prefix: string | undefined; source: 'chosen' | 'auto' | 'none' } {
  const chosen = choices.voices[characterId]
  if (chosen !== undefined)
    return { prefix: chosen || undefined, source: chosen ? 'chosen' : 'none' }
  const auto = guessVoicePrefix(characterId, prefixes)
  return { prefix: auto, source: auto ? 'auto' : 'none' }
}

/**
 * Sons do jogo (um por página: `sound`). Cada momento do jogo é um evento de
 * sound-events.ts; o arquivo vem da escolha do Daniel no mapeador (tela "Sons"), do nome
 * achado sozinho ou, sem nenhum, de um som sintetizado com Web Audio — o jogo nunca fica
 * mudo. Os pisos usam os .wav do property.xml (bound_sound / roll_sound).
 *
 * Três volumes (música, efeitos, vozes) e o geral, lembrados no navegador; tecla V liga e
 * desliga tudo.
 */
import { assetPaths, findAsset, tryFetchBytes } from '../hole/assets.ts'
import {
  ambientFiles,
  audioFiles,
  npcSoundFiles,
  emptyChoices,
  resolveEvent,
  resolveVoice,
  SOUND_EVENTS,
  voiceFiles,
  type SoundCategory,
  type SoundChoices,
  type SoundEvent,
  type SynthSound,
} from './sound-events.ts'

export type { SynthSound }

export interface Volumes {
  master: number
  music: number
  effects: number
  voices: number
}

const VOLUME_KEY = 'pangyaweb.volume'
const MUTE_KEY = 'pangyaweb.mudo'
const DEFAULT_VOLUMES: Volumes = { master: 0.8, music: 0.45, effects: 1, voices: 1 }
const MUSIC_FADE = 1.2

function readVolumes(): Volumes {
  try {
    const saved = JSON.parse(localStorage.getItem(VOLUME_KEY) ?? '{}') as Partial<Volumes>
    const out = { ...DEFAULT_VOLUMES }
    for (const key of Object.keys(out) as (keyof Volumes)[]) {
      const v = saved[key]
      if (typeof v === 'number' && v >= 0 && v <= 1) out[key] = v
    }
    return out
  } catch {
    return { ...DEFAULT_VOLUMES }
  }
}

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

/** Escolha dos sons gravada pelo mapeador (sons.json no servidor). */
export async function loadSoundChoices(): Promise<SoundChoices> {
  try {
    const response = await fetch('/api/sons', { cache: 'no-store' })
    if (!response.ok) return emptyChoices()
    const data = (await response.json()) as Partial<SoundChoices>
    return { events: data.events ?? {}, voices: data.voices ?? {} }
  } catch {
    return emptyChoices()
  }
}

const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)]

export class SoundLibrary {
  /** Pasta do curso aberto (os sons dos pisos procuram nela primeiro). */
  round = ''
  muted = readMuted()
  readonly volumes = readVolumes()
  private context: AudioContext | undefined
  private master: GainNode | undefined
  private readonly gains = new Map<SoundCategory, GainNode>()
  private readonly buffers = new Map<string, Promise<AudioBuffer | undefined>>()
  private choices: Promise<SoundChoices> | undefined
  private files: Promise<string[]> | undefined
  private voice_: AudioBufferSourceNode | undefined
  private musicNow: { id: string; source: AudioBufferSourceNode; gain: GainNode } | undefined
  private musicWanted: string | undefined
  /** Sons ambientes tocando (laços) e o relógio dos sons dos bichos. */
  private ambientNow: AudioBufferSourceNode[] = []
  private npcTimer: ReturnType<typeof setTimeout> | undefined
  private ambientToken = 0

  constructor() {
    if (typeof window === 'undefined') return
    // O navegador só libera áudio depois de uma interação do usuário.
    const unlock = () => void this.context?.resume()
    window.addEventListener('keydown', unlock)
    window.addEventListener('pointerdown', unlock)
  }

  /** O navegador já liberou o som (houve um toque ou tecla nesta página)? */
  get unlocked() {
    return this.audio()?.state === 'running'
  }

  /** Libera o som (chamar dentro de um toque/tecla do usuário). */
  resume() {
    return this.audio()?.resume() ?? Promise.resolve()
  }

  /** Espera o primeiro toque/tecla liberar o som. */
  whenUnlocked(): Promise<void> {
    if (this.unlocked) return Promise.resolve()
    return new Promise((resolve) => {
      const done = () => {
        window.removeEventListener('keydown', done, true)
        window.removeEventListener('pointerdown', done, true)
        void this.audio()
          ?.resume()
          .then(() => resolve())
      }
      window.addEventListener('keydown', done, true)
      window.addEventListener('pointerdown', done, true)
    })
  }

  /** Lê de novo a escolha do mapeador (depois de mudar na tela "Sons"). */
  reloadChoices(choices?: SoundChoices) {
    this.choices = Promise.resolve(choices ?? loadSoundChoices())
  }

  toggleMute() {
    this.muted = !this.muted
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0')
    } catch {
      // sem armazenamento: só não lembra
    }
    this.applyVolumes()
    return this.muted
  }

  setVolume(which: keyof Volumes, value: number) {
    this.volumes[which] = Math.min(1, Math.max(0, value))
    try {
      localStorage.setItem(VOLUME_KEY, JSON.stringify(this.volumes))
    } catch {
      // sem armazenamento: vale só nesta página
    }
    this.applyVolumes()
  }

  private applyVolumes() {
    if (!this.context || !this.master) return
    const now = this.context.currentTime
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volumes.master, now, 0.05)
    for (const [category, gain] of this.gains)
      gain.gain.setTargetAtTime(this.volumes[category], now, 0.05)
  }

  private audio() {
    if (!this.context) {
      try {
        this.context = new AudioContext()
        this.master = this.context.createGain()
        this.master.connect(this.context.destination)
        for (const category of ['effects', 'voices', 'music'] as SoundCategory[]) {
          const gain = this.context.createGain()
          gain.connect(this.master)
          this.gains.set(category, gain)
        }
        this.applyVolumes()
      } catch {
        return undefined
      }
    }
    return this.context
  }

  private soundFiles() {
    this.files ??= assetPaths().then(audioFiles)
    return this.files
  }

  private soundChoices() {
    this.choices ??= loadSoundChoices()
    return this.choices
  }

  /** Decodifica um arquivo pelo caminho no índice (guardado para as próximas vezes). */
  private load(path: string): Promise<AudioBuffer | undefined> {
    let buffer = this.buffers.get(path)
    if (!buffer) {
      buffer = (async () => {
        const context = this.audio()
        const bytes = context && (await tryFetchBytes(path))
        return bytes ? context.decodeAudioData(bytes.slice().buffer) : undefined
      })().catch(() => undefined)
      this.buffers.set(path, buffer)
    }
    return buffer
  }

  /** Arquivos do evento (escolhidos, achados ou nenhum) — para tocar e para o mapeador. */
  async filesFor(sound: SoundEvent) {
    return resolveEvent(sound, await this.soundChoices(), await this.soundFiles())
  }

  private start(buffer: AudioBuffer, category: SoundCategory, volume: number, loop = false) {
    const context = this.audio()!
    const gain = context.createGain()
    gain.gain.value = volume
    gain.connect(this.gains.get(category)!)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = loop
    source.connect(gain)
    source.start()
    return source
  }

  /**
   * Toca o evento (id de SOUND_EVENTS ou o próprio evento). `prefer`: entre os arquivos do
   * evento, sorteia só entre os que casam (ex.: /_s\./ = batida forte), se houver. Devolve se
   * tocou algo (arquivo ou sintetizado).
   */
  async play(which: string | SoundEvent, volume = 1, prefer?: RegExp): Promise<boolean> {
    if (this.muted) return true
    const sound = typeof which === 'string' ? SOUND_EVENTS.find((e) => e.id === which) : which
    const context = this.audio()
    if (!sound || !context) return false
    const { files, source } = await this.filesFor(sound)
    const preferred = prefer ? files.filter((f) => prefer.test(f.split('/').pop()!)) : []
    const path = pick(preferred.length ? preferred : files)
    const buffer = path && (await this.load(path))
    if (buffer) this.start(buffer, sound.category, volume)
    else if (source === 'synth' && sound.synth)
      synth(context, this.gains.get('effects')!, sound.synth, volume)
    else return false
    return true
  }

  /** Toca um arquivo pelo nome (sons dos pisos); sem ele, o evento `fallback`. */
  async playNamed(name: string | undefined, fallback: string, volume = 1) {
    if (this.muted) return
    if (name && (await this.playFile(name, volume))) return
    await this.play(fallback, volume)
  }

  /** Toca um arquivo pelo nome (com ou sem extensão), achado no índice; false se não há. */
  async playFile(name: string, volume = 1): Promise<boolean> {
    if (this.muted) return false
    const stem = name.replace(/\.(wav|ogg|mp3)$/i, '')
    for (const candidate of [name, `${stem}.wav`, `${stem}.ogg`, `${stem}.mp3`]) {
      const path = await findAsset(candidate, this.round)
      const buffer = path && this.audio() && (await this.load(path))
      if (buffer) {
        this.start(buffer, 'effects', volume)
        return true
      }
    }
    return false
  }

  /** Voz do personagem (código de VOICE_CODES: py, bi, par…); sem voz, nada. */
  async voice(characterId: string | undefined, code: string) {
    if (this.muted || !characterId || !this.audio()) return
    const voices = voiceFiles(await this.soundFiles())
    const { prefix } = resolveVoice(characterId, await this.soundChoices(), voices)
    const path = prefix && pick(voices.get(prefix)?.get(code) ?? [])
    const buffer = path && (await this.load(path))
    if (!buffer) return
    // Uma fala por vez.
    try {
      this.voice_?.stop()
    } catch {
      // já tinha acabado
    }
    this.voice_ = this.start(buffer, 'voices', 1)
  }

  /**
   * Som ambiente do buraco (caixas de som do .gbin: "바다" → mar, em laço) e, de vez em
   * quando, o som dos bichos do cenário (gaivotas). Troca o que estava tocando.
   */
  async startAmbient(names: string[], npcModels: string[]) {
    this.stopAmbient()
    const token = ++this.ambientToken
    const context = this.audio()
    if (!context) return
    const files = await this.soundFiles()
    for (const name of names) {
      const path = ambientFiles(name, files)[0]
      const buffer = path && (await this.load(path))
      if (!buffer || token !== this.ambientToken) continue
      this.ambientNow.push(this.start(buffer, 'effects', 0.35, true))
    }
    const calls = [...new Set(npcModels.flatMap((m) => npcSoundFiles(m, files)))]
    if (calls.length === 0) return
    const next = () => {
      this.npcTimer = setTimeout(
        () => {
          if (token !== this.ambientToken) return
          const path = pick(calls)
          if (path && !this.muted) {
            void this.load(path).then((b) => b && this.start(b, 'effects', 0.5))
          }
          next()
        },
        8000 + Math.random() * 14000,
      )
    }
    next()
  }

  stopAmbient() {
    this.ambientToken++
    clearTimeout(this.npcTimer)
    for (const source of this.ambientNow) {
      try {
        source.stop()
      } catch {
        // já tinha parado
      }
    }
    this.ambientNow = []
  }

  /** Música em laço (troca com fade); undefined para. */
  /**
   * Troca a música. A anterior continua tocando até a nova estar carregada (nunca fica sem
   * música na troca de tela); a promessa termina quando a nova começa (ou não há arquivo).
   */
  async music(sound: SoundEvent | undefined) {
    this.musicWanted = sound?.id
    if (this.musicNow?.id === sound?.id) return
    const context = this.audio()
    if (!context) return
    if (!sound) {
      this.stopMusic()
      return
    }
    const { files } = await this.filesFor(sound)
    const path = pick(files)
    const buffer = path && (await this.load(path))
    if (this.musicWanted !== sound.id) return
    this.stopMusic()
    if (!buffer) return
    const gain = context.createGain()
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(1, context.currentTime + MUSIC_FADE)
    gain.connect(this.gains.get('music')!)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(gain)
    source.start()
    this.musicNow = { id: sound.id, source, gain }
  }

  private stopMusic() {
    const now = this.musicNow
    if (!now || !this.context) return
    this.musicNow = undefined
    const t = this.context.currentTime
    now.gain.gain.setTargetAtTime(0.0001, t, MUSIC_FADE / 4)
    now.source.stop(t + MUSIC_FADE)
  }

  /** Toca um arquivo qualquer (prévia no mapeador), parando a prévia anterior. */
  private preview: AudioBufferSourceNode | undefined
  async previewFile(path: string) {
    const context = this.audio()
    if (!context) return
    void context.resume()
    const buffer = await this.load(path)
    try {
      this.preview?.stop()
    } catch {
      // já tinha acabado
    }
    if (!buffer) return undefined
    // Direto na saída: a prévia toca mesmo com o jogo mudo (V) ou com volume baixo.
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    source.start()
    this.preview = source
    return buffer.duration
  }

  stopPreview() {
    try {
      this.preview?.stop()
    } catch {
      // já tinha acabado
    }
  }
}

/** Os sons da página (menu, buraco ou mapeador). */
export const sound = new SoundLibrary()

/** Sons simples gerados na hora (sem arquivo). */
function synth(context: AudioContext, destination: GainNode, sound: SynthSound, volume: number) {
  const now = context.currentTime
  const out = context.createGain()
  out.gain.value = volume
  out.connect(destination)
  const tone = (freq: number, start: number, length: number, type: OscillatorType, level = 0.5) => {
    const osc = context.createOscillator()
    const env = context.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now + start)
    env.gain.setValueAtTime(0.0001, now + start)
    env.gain.exponentialRampToValueAtTime(level, now + start + 0.005)
    env.gain.exponentialRampToValueAtTime(0.0001, now + start + length)
    osc.connect(env).connect(out)
    osc.start(now + start)
    osc.stop(now + start + length + 0.02)
    return osc
  }
  const noise = (length: number, filterFreq: number, level = 0.5, q = 0.8) => {
    const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * length),
      context.sampleRate,
    )
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    const source = context.createBufferSource()
    source.buffer = buffer
    const filter = context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = filterFreq
    filter.Q.value = q
    const env = context.createGain()
    env.gain.value = level
    source.connect(filter).connect(env).connect(out)
    source.start(now)
  }
  switch (sound) {
    case 'hit':
      noise(0.08, 2500, 0.9, 0.6)
      tone(180, 0, 0.12, 'sine', 0.6)
      break
    case 'pangya':
      noise(0.08, 2500, 0.9, 0.6)
      for (const [i, f] of [880, 1320, 1760].entries())
        tone(f, 0.05 + i * 0.07, 0.35, 'triangle', 0.3)
      break
    case 'miss':
      noise(0.1, 900, 0.7)
      tone(110, 0, 0.15, 'sawtooth', 0.2)
      break
    case 'bounce':
      tone(140, 0, 0.12, 'sine', 0.5)
      noise(0.06, 600, 0.3)
      break
    case 'roll':
      noise(0.35, 300, 0.15, 0.4)
      break
    case 'wood':
      tone(420, 0, 0.09, 'square', 0.25)
      tone(260, 0.01, 0.12, 'triangle', 0.3)
      break
    case 'water':
      noise(0.5, 1200, 0.6, 0.3)
      break
    case 'coins':
      for (let i = 0; i < 5; i++) {
        tone(1975 + (i % 2) * 660, i * 0.06, 0.18, 'triangle', 0.18)
        tone(3950, i * 0.06 + 0.01, 0.08, 'sine', 0.08)
      }
      break
    case 'cup':
      tone(1046, 0, 0.25, 'sine', 0.4)
      tone(784, 0.12, 0.25, 'sine', 0.35)
      tone(523, 0.3, 0.6, 'sine', 0.35)
      break
  }
}

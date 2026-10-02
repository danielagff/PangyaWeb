/**
 * Sons do jogo: arquivos do cliente original quando existem (os nomes dos sons de cada
 * piso vêm do <curso>_property.xml), e sons sintetizados com Web Audio quando não — o
 * jogo nunca fica mudo. Tecla V liga/desliga.
 */
import { assetNames, findAsset, tryFetchBytes } from '../hole/assets.ts'

export type SynthSound = 'hit' | 'pangya' | 'bounce' | 'roll' | 'wood' | 'water' | 'cup' | 'miss'

/**
 * Padrões para achar, entre os arquivos extraídos, os sons que não vêm do property.xml.
 * Os nomes reais do cliente ainda não foram conferidos (verificar com a extração completa);
 * o primeiro arquivo que casar é usado e aparece no console.
 */
const FILE_PATTERNS: Partial<Record<SynthSound, RegExp>> = {
  hit: /^(ball_?)?(shot|impact|hit|swing)[^/]*\.(wav|ogg|mp3)$/i,
  pangya: /pangya[^/]*\.(wav|ogg|mp3)$/i,
  cup: /(cup|hole_?in|컵|홀인)[^/]*\.(wav|ogg|mp3)$/i,
  water: /(water|splash|물)[^/]*\.(wav|ogg|mp3)$/i,
}

function readMuted() {
  try {
    return localStorage.getItem('pangyaweb.mudo') === '1'
  } catch {
    return false
  }
}

export class SoundLibrary {
  private context: AudioContext | undefined
  private master: GainNode | undefined
  private readonly buffers = new Map<string, Promise<AudioBuffer | undefined>>()
  private readonly matched = new Map<SynthSound, Promise<string | undefined>>()
  muted = readMuted()

  constructor(private readonly round: string) {
    // O navegador só libera áudio depois de uma interação do usuário.
    const unlock = () => void this.audio()?.resume()
    window.addEventListener('keydown', unlock)
    window.addEventListener('pointerdown', unlock)
  }

  toggleMute() {
    this.muted = !this.muted
    try {
      localStorage.setItem('pangyaweb.mudo', this.muted ? '1' : '0')
    } catch {
      // sem armazenamento: só não lembra
    }
    return this.muted
  }

  private audio() {
    if (!this.context) {
      try {
        this.context = new AudioContext()
        this.master = this.context.createGain()
        this.master.gain.value = 0.6
        this.master.connect(this.context.destination)
      } catch {
        return undefined
      }
    }
    return this.context
  }

  private load(name: string): Promise<AudioBuffer | undefined> {
    const key = name.toLowerCase()
    let buffer = this.buffers.get(key)
    if (!buffer) {
      buffer = (async () => {
        const context = this.audio()
        if (!context) return undefined
        const stem = name.replace(/\.[^.]+$/, '')
        for (const candidate of [name, `${stem}.wav`, `${stem}.ogg`, `${stem}.mp3`]) {
          const path = await findAsset(candidate, this.round)
          const bytes = path && (await tryFetchBytes(path))
          if (bytes) return context.decodeAudioData(bytes.slice().buffer)
        }
        return undefined
      })().catch(() => undefined)
      this.buffers.set(key, buffer)
    }
    return buffer
  }

  private fileFor(sound: SynthSound): Promise<string | undefined> {
    let found = this.matched.get(sound)
    if (!found) {
      const pattern = FILE_PATTERNS[sound]
      found = pattern
        ? assetNames().then((names) => {
            const name = names.find((n) => pattern.test(n))
            if (name) console.info(`som "${sound}": ${name}`)
            return name
          })
        : Promise.resolve(undefined)
      this.matched.set(sound, found)
    }
    return found
  }

  /** Toca o arquivo `file` (se existir) ou o som sintetizado `fallback`. */
  async play(fallback: SynthSound, file?: string, volume = 1) {
    if (this.muted) return
    const context = this.audio()
    if (!context || !this.master) return
    const name = file || (await this.fileFor(fallback))
    const buffer = name ? await this.load(name) : undefined
    const gain = context.createGain()
    gain.gain.value = volume
    gain.connect(this.master)
    if (buffer) {
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(gain)
      source.start()
      return
    }
    synth(context, gain, fallback)
  }
}

/** Sons simples gerados na hora (sem arquivo). */
function synth(context: AudioContext, out: GainNode, sound: SynthSound) {
  const now = context.currentTime
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
    case 'cup':
      tone(1046, 0, 0.25, 'sine', 0.4)
      tone(784, 0.12, 0.25, 'sine', 0.35)
      tone(523, 0.3, 0.6, 'sine', 0.35)
      break
  }
}

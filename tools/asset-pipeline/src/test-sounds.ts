/**
 * Sons de teste sintéticos (`pnpm assets:teste`, junto com o personagem de teste): bipes com
 * nomes no padrão do cliente (efeitos em coreano, vozes <prefixo>_<código><n>.wav, músicas
 * numa pasta "bgm"), para testar os sons do jogo e a tela "Sons" do mapeador sem os arquivos
 * do jogo (na nuvem). Ficam em assets/original/data/sound/teste/ (fora do git).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { originalDir } from './config.ts'

const RATE = 22050

/** WAV PCM 16 bits mono: notas (Hz) em sequência, cada uma com `seconds`. */
export function beepWav(notes: number[], seconds: number): Uint8Array {
  const perNote = Math.round(RATE * seconds)
  const samples = perNote * notes.length
  const buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + samples * 2, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20) // PCM
  buffer.writeUInt16LE(1, 22) // mono
  buffer.writeUInt32LE(RATE, 24)
  buffer.writeUInt32LE(RATE * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples * 2, 40)
  notes.forEach((freq, n) => {
    for (let i = 0; i < perNote; i++) {
      const fade = Math.min(1, i / 200, (perNote - i) / 400)
      const value = Math.sin((2 * Math.PI * freq * i) / RATE) * 0.4 * fade
      buffer.writeInt16LE(Math.round(value * 32767), 44 + (n * perNote + i) * 2)
    }
  })
  return new Uint8Array(buffer)
}

/** Caminho (em data/) → notas e duração de cada nota. */
const SOUNDS: Record<string, [number[], number]> = {
  'sound/teste/effect/타격.wav': [[220], 0.08],
  'sound/teste/effect/팡야.wav': [[880, 1320, 1760], 0.08],
  'sound/teste/effect/컵인.wav': [[1046, 784, 523], 0.12],
  'sound/teste/effect/박수.wav': [[300, 320, 300, 320], 0.06],
  'sound/teste/effect/버디.wav': [[523, 659, 784, 1046], 0.12],
  'sound/teste/effect/파.wav': [[523, 659], 0.15],
  'sound/teste/effect/확인.wav': [[1200], 0.04],
  'sound/teste/voice/t_py1.wav': [[600, 900], 0.15],
  'sound/teste/voice/t_bi1.wav': [[700, 800, 900], 0.12],
  'sound/teste/voice/t_par1.wav': [[500, 500], 0.12],
  'sound/teste/voice/t_ps1.wav': [[400, 800], 0.15],
  'sound/teste/ambient/바다소리.wav': [[110, 98, 110, 123], 0.5],
  'sound/teste/ambient/갈매기울음.wav': [[1400, 1800, 1400], 0.08],
  'sound/teste/bgm/로비.wav': [[262, 330, 392, 330], 0.4],
  'round02_blue/sound/teste/bgm_blue.wav': [[392, 494, 587, 494], 0.4],
}

export function installTestSounds(log: (msg: string) => void = console.log) {
  for (const [path, [notes, seconds]] of Object.entries(SOUNDS)) {
    const file = resolve(originalDir, 'data', path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, beepWav(notes, seconds))
  }
  log(`sons de teste: ${Object.keys(SOUNDS).length} arquivos em ${resolve(originalDir, 'data')}`)
}

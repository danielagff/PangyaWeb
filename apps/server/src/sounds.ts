import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname } from 'node:path'
import { isLocal } from './outfits.ts'

/**
 * Sons escolhidos na tela "Sons" do mapeador: arquivos por evento do jogo e o prefixo da voz
 * de cada personagem —
 * { "events": { "pangya": ["data/sound/팡야.wav"] }, "voices": { "data/avatar/h_kaz/h_def": "kaz" } }.
 * Ficam em assets/converted/data/sons.json (no PC, fora do git) e valem para todos.
 */
export interface SoundChoices {
  events: Record<string, string[]>
  voices: Record<string, string>
}

const empty = (): SoundChoices => ({ events: {}, voices: {} })
const AUDIO = /\.(wav|ogg|mp3)$/i
const safePath = (p: unknown) =>
  typeof p === 'string' &&
  p.length < 300 &&
  AUDIO.test(p) &&
  !p.includes('..') &&
  !p.startsWith('/')
const safeKey = (k: string) => k.length > 0 && k.length < 200

export function readSoundChoices(file: string): SoundChoices {
  try {
    if (!existsSync(file)) return empty()
    const data = JSON.parse(readFileSync(file, 'utf8')) as Partial<SoundChoices>
    return { events: data.events ?? {}, voices: data.voices ?? {} }
  } catch {
    return empty()
  }
}

/** Confere o que veio do navegador; undefined se tiver algo estranho. */
export function validSoundChoices(input: unknown): SoundChoices | undefined {
  if (typeof input !== 'object' || input === null) return undefined
  const { events, voices } = input as Record<string, unknown>
  if (typeof events !== 'object' || events === null) return undefined
  if (typeof voices !== 'object' || voices === null) return undefined
  const out = empty()
  for (const [key, list] of Object.entries(events)) {
    if (!safeKey(key) || !Array.isArray(list) || list.length > 50 || !list.every(safePath))
      return undefined
    out.events[key] = list as string[]
  }
  for (const [key, prefix] of Object.entries(voices)) {
    if (!safeKey(key) || typeof prefix !== 'string' || prefix.length > 60) return undefined
    out.voices[key] = prefix
  }
  return out
}

/** GET devolve a escolha; POST grava a escolha inteira (só do próprio PC). */
export function handleSoundChoices(req: IncomingMessage, res: ServerResponse, file: string) {
  const json = (status: number, body: unknown) =>
    res
      .writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
      })
      .end(JSON.stringify(body))
  if (req.method === 'GET') return json(200, readSoundChoices(file))
  if (req.method !== 'POST') return json(405, { error: 'método não suportado' })
  if (!isLocal(req)) return json(403, { error: 'só o PC do servidor pode mudar os sons' })
  let body = ''
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString('utf8')
    if (body.length > 512_000) req.destroy()
  })
  req.on('end', () => {
    let input: unknown
    try {
      input = JSON.parse(body)
    } catch {
      return json(400, { error: 'JSON inválido' })
    }
    const choices = validSoundChoices(input)
    if (!choices) return json(400, { error: 'dados inválidos' })
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(choices, null, 1))
    json(200, choices)
  })
}

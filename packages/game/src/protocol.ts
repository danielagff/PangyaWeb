/**
 * Mensagens entre o cliente web e o servidor da partida (WebSocket, JSON).
 * O servidor é o juiz: recebe só o pedido da tacada, simula e manda o resultado a todos.
 */

import type { Course, MatchState } from './match.ts'
import type { ShotOutcome } from './hole.ts'
import type { ShotRequest } from './world.ts'

export type ClientMessage =
  | { t: 'hello'; name: string }
  | { t: 'start'; course: Course }
  | { t: 'shot'; request: ShotRequest }
  | { t: 'chat'; text: string }

export type ServerMessage =
  | { t: 'welcome'; id: string }
  | { t: 'match'; match: MatchState }
  | {
      t: 'shot'
      playerId: string
      /** Trajetória (Float32Array em base64). */
      frames: string
      carry: number
      hits: number
      outcome: ShotOutcome
      message: string
    }
  | { t: 'chat'; from: string; text: string }
  | { t: 'error'; message: string }

export function encodeFrames(frames: Float32Array): string {
  const bytes = new Uint8Array(frames.buffer, frames.byteOffset, frames.byteLength)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

export function decodeFrames(text: string): Float32Array {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Float32Array(bytes.buffer)
}

import type { Vec3 } from './vec3.ts'

/**
 * A bola entrando na cova: chega até a borda e cai lá dentro (a cova é um buraco de
 * verdade, com fundo `CUP_DEPTH` abaixo do green). Quadros a cada STEP_TIME.
 */
export const CUP_DEPTH = 0.75

/** A queda dentro da cova (unidades por quadro): gravidade, quique no fundo e borda. */
export const CUP_FALL = { gravity: 0.025, bounce: 0.25, rim: 0.12, maxFrames: 60 }

/**
 * Quadros (x, y, z) de `from` até dentro da cova e depois até o fundo (`slideFrames` é o
 * mínimo de quadros até a borda). A curva continua a
 * velocidade que a bola trazia (`previous` = o quadro antes de `from`) e entra na cova
 * descendo, sem parar no meio; no fundo, um quique pequeno. O último quadro é o fundo.
 */
export function dropIntoCup(from: Vec3, cup: Vec3, slideFrames = 4, previous?: Vec3): number[] {
  const frames: number[] = []
  // Velocidade por quadro que a bola trazia (limitada: puxada pela luz vem rápida).
  let vx = previous ? from.x - previous.x : 0
  let vy = previous ? from.y - previous.y : 0
  let vz = previous ? from.z - previous.z : 0
  const speed = Math.hypot(vx, vy, vz)
  const limit = 0.25
  if (speed > limit) {
    vx *= limit / speed
    vy *= limit / speed
    vz *= limit / speed
  }
  // Curva de Hermite até logo abaixo da borda, no centro, já descendo. Quadros pela
  // velocidade da bola (devagar leva mais quadros; senão ela daria um tranco para frente).
  const end = { x: cup.x, y: cup.y - CUP_FALL.rim, z: cup.z }
  const distance = Math.hypot(end.x - from.x, end.y - from.y, end.z - from.z)
  const n = Math.max(
    1,
    slideFrames,
    previous ? Math.min(30, Math.ceil(distance / Math.max(Math.min(speed, limit), 0.02))) : 0,
  )
  // Na borda: parada na horizontal e descendo (no mínimo 3× a descida média, que dá a
  // curva s³ — só desce, sem subir antes de cair).
  const t0 = { x: vx * n, y: vy * n, z: vz * n }
  const t1 = { x: 0, y: Math.min(3 * (end.y - from.y), t0.y, -0.04 * n), z: 0 }
  const down = -t1.y / n
  for (let i = 1; i <= n; i++) {
    const s = i / n
    const h00 = 2 * s ** 3 - 3 * s ** 2 + 1
    const h10 = s ** 3 - 2 * s ** 2 + s
    const h01 = -2 * s ** 3 + 3 * s ** 2
    const h11 = s ** 3 - s ** 2
    frames.push(
      h00 * from.x + h10 * t0.x + h01 * end.x + h11 * t1.x,
      h00 * from.y + h10 * t0.y + h01 * end.y + h11 * t1.y,
      h00 * from.z + h10 * t0.z + h01 * end.z + h11 * t1.z,
    )
  }
  // Queda com gravidade a partir da velocidade de chegada, um quique e para no fundo.
  const bottom = cup.y - CUP_DEPTH
  let y = end.y
  let fall = -down
  let bounced = false
  for (let i = 0; i < CUP_FALL.maxFrames; i++) {
    fall -= CUP_FALL.gravity
    y += fall
    if (y <= bottom) {
      y = bottom
      if (bounced || -fall < CUP_FALL.gravity * 2) break
      bounced = true
      fall = -fall * CUP_FALL.bounce
    }
    frames.push(cup.x, y, cup.z)
  }
  frames.push(cup.x, bottom, cup.z)
  return frames
}

/** Fundo da cova (onde a bola fica depois de cair). */
export const cupBottom = (cup: Vec3): Vec3 => ({ x: cup.x, y: cup.y - CUP_DEPTH, z: cup.z })

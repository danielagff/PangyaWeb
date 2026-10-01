import { BinaryReader } from './binary-reader.ts'

/** Descreve um campo binário de tamanho fixo e como lê-lo. */
export interface Codec<T> {
  readonly size: number
  read(r: BinaryReader): T
}

export type CodecValue<C> = C extends Codec<infer T> ? T : never

const prim = <T>(size: number, read: (r: BinaryReader) => T): Codec<T> => ({ size, read })

export const u8 = prim(1, (r) => r.u8())
export const u16 = prim(2, (r) => r.u16())
export const u32 = prim(4, (r) => r.u32())
export const i32 = prim(4, (r) => r.i32())
export const f32 = prim(4, (r) => r.f32())

/** String de tamanho fixo terminada em zero. Clientes JP usam Shift-JIS. */
export const str = (size: number, encoding = 'shift_jis'): Codec<string> =>
  prim(size, (r) => r.fixedString(size, encoding))

export const array = <T>(codec: Codec<T>, count: number): Codec<T[]> =>
  prim(codec.size * count, (r) => Array.from({ length: count }, () => codec.read(r)))

/** Bytes ignorados (padding ou campos ainda desconhecidos). */
export const pad = (size: number): Codec<undefined> =>
  prim(size, (r) => {
    r.skip(size)
    return undefined
  })

export function struct<S extends Record<string, Codec<unknown>>>(
  fields: S,
): Codec<{ [K in keyof S]: CodecValue<S[K]> }> {
  const entries = Object.entries(fields)
  const size = entries.reduce((sum, [, c]) => sum + c.size, 0)
  return prim(size, (r) => {
    const out: Record<string, unknown> = {}
    for (const [name, codec] of entries) out[name] = codec.read(r)
    return out as { [K in keyof S]: CodecValue<S[K]> }
  })
}

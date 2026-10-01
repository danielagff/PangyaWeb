import { unzipSync } from 'fflate'
import { BinaryReader } from '../binary-reader.ts'
import type { Codec } from '../codec.ts'

export const IFF_HEADER_SIZE = 8

export interface IffTable<T> {
  version: number
  linkFlag: number
  records: T[]
}

/**
 * Lê uma tabela .iff: cabeçalho (u16 quantidade, u16 flag, u32 versão) seguido de
 * registros de tamanho fixo.
 */
export function parseIffTable<T>(
  bytes: Uint8Array,
  layout: Codec<T>,
  name = 'tabela',
): IffTable<T> {
  const r = new BinaryReader(bytes)
  const count = r.u16()
  const linkFlag = r.u16()
  const version = r.u32()

  const expected = IFF_HEADER_SIZE + count * layout.size
  if (bytes.byteLength !== expected) {
    throw new Error(
      `${name}: tamanho ${bytes.byteLength} não bate com ${count} registros de ` +
        `${layout.size} bytes (esperado ${expected}). Layout de outra versão?`,
    )
  }

  const records = Array.from({ length: count }, () => layout.read(r))
  return { version, linkFlag, records }
}

/** O arquivo pangya_<região>.iff é um zip com uma tabela .iff por arquivo. */
export function readIffArchive(zipBytes: Uint8Array): Map<string, Uint8Array> {
  return new Map(Object.entries(unzipSync(zipBytes)))
}

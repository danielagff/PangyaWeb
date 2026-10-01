/** Leitor sequencial little-endian sobre um buffer, base de todos os parsers. */
export class BinaryReader {
  private readonly view: DataView
  offset = 0

  constructor(readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }

  get length(): number {
    return this.bytes.byteLength
  }

  get remaining(): number {
    return this.length - this.offset
  }

  seek(offset: number): this {
    if (offset < 0 || offset > this.length) {
      throw new RangeError(`seek fora do buffer: ${offset} (tamanho ${this.length})`)
    }
    this.offset = offset
    return this
  }

  skip(count: number): this {
    return this.seek(this.offset + count)
  }

  u8(): number {
    return this.view.getUint8(this.advance(1))
  }

  u16(): number {
    return this.view.getUint16(this.advance(2), true)
  }

  u32(): number {
    return this.view.getUint32(this.advance(4), true)
  }

  i32(): number {
    return this.view.getInt32(this.advance(4), true)
  }

  f32(): number {
    return this.view.getFloat32(this.advance(4), true)
  }

  bytesN(count: number): Uint8Array {
    const start = this.advance(count)
    return this.bytes.subarray(start, start + count)
  }

  /** String de tamanho fixo terminada em zero (padrão dos registros .iff). */
  fixedString(size: number, encoding = 'latin1'): string {
    const raw = this.bytesN(size)
    const end = raw.indexOf(0)
    return new TextDecoder(encoding).decode(end === -1 ? raw : raw.subarray(0, end))
  }

  private advance(size: number): number {
    if (size > this.remaining) {
      throw new RangeError(
        `leitura de ${size} bytes no offset ${this.offset} passa do fim (tamanho ${this.length})`,
      )
    }
    const at = this.offset
    this.offset += size
    return at
  }
}

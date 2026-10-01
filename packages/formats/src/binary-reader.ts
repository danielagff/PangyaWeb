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

  i8(): number {
    return this.view.getInt8(this.advance(1))
  }

  i16(): number {
    return this.view.getInt16(this.advance(2), true)
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

  f32n(count: number): number[] {
    return Array.from({ length: count }, () => this.f32())
  }

  /** String terminada em zero, de tamanho variável. */
  cString(encoding = 'euc-kr'): string {
    const start = this.offset
    const end = this.bytes.indexOf(0, start)
    if (end === -1) throw new RangeError(`string sem terminador a partir de ${start}`)
    this.offset = end + 1
    return new TextDecoder(encoding).decode(this.bytes.subarray(start, end))
  }

  /** String com prefixo u32 de tamanho (pode conter zeros de preenchimento). */
  lengthString(encoding = 'euc-kr'): string {
    const length = this.u32()
    if (length === 0) return ''
    if (length > 1 << 20) throw new RangeError(`string de ${length} bytes no offset ${this.offset}`)
    const raw = this.bytesN(length)
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

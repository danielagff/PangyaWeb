/** Escritor binário little-endian para montar arquivos sintéticos nos testes. */
export class Writer {
  private parts: number[] = []
  u8(v: number) {
    this.parts.push(v & 0xff)
    return this
  }
  u16(v: number) {
    return this.u8(v).u8(v >> 8)
  }
  u32(v: number) {
    return this.u16(v & 0xffff).u16(v >>> 16)
  }
  f32(...vs: number[]) {
    for (const v of vs) {
      const b = new Uint8Array(new Float32Array([v]).buffer)
      this.parts.push(...b)
    }
    return this
  }
  bytes(b: ArrayLike<number>) {
    this.parts.push(...Array.from(b))
    return this
  }
  fixed(s: string, size: number) {
    const b = new Uint8Array(size)
    b.set(new TextEncoder().encode(s))
    return this.bytes(b)
  }
  cstr(s: string) {
    return this.bytes(new TextEncoder().encode(s)).u8(0)
  }
  lstr(s: string) {
    const b = new TextEncoder().encode(s)
    return this.u32(b.length + 1)
      .bytes(b)
      .u8(0)
  }
  i32(v: number) {
    return this.u32(v >>> 0)
  }
  /** String fixa a partir de bytes já codificados (ex.: CP949). */
  fixedBytes(b: number[], size: number) {
    const out = new Uint8Array(size)
    out.set(b)
    return this.bytes(out)
  }
  block(id: string, body: Writer) {
    const data = body.done()
    return this.bytes(new TextEncoder().encode(id)).u32(data.length).bytes(data)
  }
  done() {
    return Uint8Array.from(this.parts)
  }
}

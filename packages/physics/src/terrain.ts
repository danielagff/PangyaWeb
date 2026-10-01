/**
 * Terreno para colisão: triângulos em coordenadas do Pangya numa grade espacial,
 * com consulta de altura do chão em (x, z). Ideia do GroundGrid do GhostMapEditor (MIT).
 */
export interface GroundHit {
  y: number
  /** Índice do triângulo atingido (para descobrir o tipo de piso). */
  triangle: number
}

export class TerrainGrid {
  private readonly cells: number[][]
  private readonly minX: number
  private readonly minZ: number
  private readonly cell: number
  private readonly nx: number
  private readonly nz: number

  /** `triangles`: 9 floats por triângulo (x, y, z dos três vértices). */
  constructor(readonly triangles: Float32Array) {
    let minX = Infinity
    let minZ = Infinity
    let maxX = -Infinity
    let maxZ = -Infinity
    for (let i = 0; i < triangles.length; i += 3) {
      minX = Math.min(minX, triangles[i]!)
      maxX = Math.max(maxX, triangles[i]!)
      minZ = Math.min(minZ, triangles[i + 2]!)
      maxZ = Math.max(maxZ, triangles[i + 2]!)
    }
    const empty = triangles.length === 0
    this.minX = empty ? 0 : minX
    this.minZ = empty ? 0 : minZ
    this.cell = empty ? 1 : Math.max(Math.max(maxX - minX, maxZ - minZ) / 64, 8)
    this.nx = empty ? 1 : Math.floor((maxX - minX) / this.cell) + 1
    this.nz = empty ? 1 : Math.floor((maxZ - minZ) / this.cell) + 1
    this.cells = Array.from({ length: this.nx * this.nz }, () => [])

    for (let t = 0; t < triangles.length / 9; t++) {
      const xs = [triangles[t * 9]!, triangles[t * 9 + 3]!, triangles[t * 9 + 6]!]
      const zs = [triangles[t * 9 + 2]!, triangles[t * 9 + 5]!, triangles[t * 9 + 8]!]
      const i0 = this.cellX(Math.min(...xs))
      const i1 = this.cellX(Math.max(...xs))
      const j0 = this.cellZ(Math.min(...zs))
      const j1 = this.cellZ(Math.max(...zs))
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) this.cells[j * this.nx + i]!.push(t)
    }
  }

  get triangleCount(): number {
    return this.triangles.length / 9
  }

  private cellX(x: number) {
    return Math.min(this.nx - 1, Math.max(0, Math.floor((x - this.minX) / this.cell)))
  }

  private cellZ(z: number) {
    return Math.min(this.nz - 1, Math.max(0, Math.floor((z - this.minZ) / this.cell)))
  }

  /** Chão mais alto sob (x, z), ou undefined fora do terreno. */
  groundAt(x: number, z: number): GroundHit | undefined {
    const candidates = this.cells[this.cellZ(z) * this.nx + this.cellX(x)] ?? []
    let best: GroundHit | undefined
    const t = this.triangles
    for (const tri of candidates) {
      const o = tri * 9
      const ax = t[o]!,
        ay = t[o + 1]!,
        az = t[o + 2]!
      const bx = t[o + 3]!,
        by = t[o + 4]!,
        bz = t[o + 5]!
      const cx = t[o + 6]!,
        cy = t[o + 7]!,
        cz = t[o + 8]!
      // Coordenadas baricêntricas no plano XZ.
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz)
      if (Math.abs(det) < 1e-9) continue
      const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det
      const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det
      const l3 = 1 - l1 - l2
      const eps = -1e-6
      if (l1 < eps || l2 < eps || l3 < eps) continue
      const y = l1 * ay + l2 * by + l3 * cy
      if (!best || y > best.y) best = { y, triangle: tri }
    }
    return best
  }
}

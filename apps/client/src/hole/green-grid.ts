import type { TerrainGrid } from '@pangya/physics'
import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments } from 'three'

/**
 * Grade de inclinação do green (spec 11): um traço por ponto, apontando para a descida,
 * maior e mais vermelho quanto mais inclinado. Amostrada na malha de colisão.
 */
export function buildGreenGrid(
  grid: TerrainGrid,
  isGreen: (triangle: number) => boolean,
  center: { x: number; z: number },
  radius = 110,
  spacing = 4,
) {
  const positions: number[] = []
  const colors: number[] = []
  for (let dx = -radius; dx <= radius; dx += spacing) {
    for (let dz = -radius; dz <= radius; dz += spacing) {
      const x = center.x + dx
      const z = center.z + dz
      const hit = grid.groundAt(x, z)
      if (!hit || !isGreen(hit.triangle)) continue
      const [nx, , nz] = grid.normalOf(hit.triangle)
      const slope = Math.hypot(nx, nz)
      // A normal inclina para o lado da descida.
      const length = slope < 1e-4 ? 0.3 : Math.min(3.2, 0.6 + slope * 60)
      const ux = slope < 1e-4 ? 1 : nx / slope
      const uz = slope < 1e-4 ? 0 : nz / slope
      const y = hit.y + 0.25
      // Cena: Z invertido.
      positions.push(x, y, -z, x + ux * length, y, -(z + uz * length))
      const heat = Math.min(1, slope * 12)
      colors.push(1, 1, 1, 1, 1 - heat, 1 - heat)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  const lines = new LineSegments(
    geometry,
    new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }),
  )
  lines.renderOrder = 2
  return lines
}

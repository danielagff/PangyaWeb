import {
  applyMat4x3,
  holePoints,
  petToSubMeshes,
  readCourseProperty,
  readGbin,
  readPet,
  type GbinElement,
  type Mat4x3,
  type PetSubMesh,
  type SurfaceClass,
} from '@pangya/formats'

export interface HoleRef {
  /** Pasta do curso, ex.: "round02_blue". */
  round: string
  /** Prefixo dos arquivos, ex.: "blue" (blue_01.gbin). */
  prefix: string
  hole: number
}

export interface TerrainPart {
  surface: SurfaceClass
  /** Posições já em coordenadas de mundo do Pangya (x, y, z por vértice). */
  positions: Float32Array
}

export interface HoleObject {
  model: string
  subMeshes: PetSubMesh[]
  /** Matrizes de mundo (Pangya) de cada instância. */
  instances: Mat4x3[]
}

export interface LoadedHole {
  ref: HoleRef
  par: number
  tee: [number, number, number]
  pin: [number, number, number]
  terrain: TerrainPart[]
  /** Triângulos do terreno (9 floats cada) e o piso de cada um, para a física. */
  collision: { triangles: Float32Array; surfaces: SurfaceClass[] }
  objects: HoleObject[]
  missingModels: string[]
}

/**
 * Os cursos aparecem em dois lugares: `round02_blue/...` (extraídos dos .pak) ou
 * `data/round02_blue/...` (pacote de exemplo). Tenta os dois.
 */
const ASSET_ROOTS = ['/game-assets/original', '/game-assets/original/data']

async function fetchBytes(path: string): Promise<Uint8Array> {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  for (const root of ASSET_ROOTS) {
    const response = await fetch(`${root}/${encoded}`)
    if (response.ok) return new Uint8Array(await response.arrayBuffer())
  }
  throw new Error(`não encontrado: ${path} (procurado em ${ASSET_ROOTS.join(', ')})`)
}

const transform = (positions: Float32Array, matrix: Mat4x3) => {
  const out = new Float32Array(positions.length)
  for (let i = 0; i < positions.length; i += 3) {
    out.set(applyMat4x3(matrix, positions[i]!, positions[i + 1]!, positions[i + 2]!), i)
  }
  return out
}

export async function loadHole(ref: HoleRef): Promise<LoadedHole> {
  const file = `${ref.prefix}_${String(ref.hole).padStart(2, '0')}`
  const gbin = readGbin(await fetchBytes(`${ref.round}/map/${file}.gbin`))
  const property = readCourseProperty(
    await fetchBytes(`${ref.round}/text/${ref.prefix}_property.xml`),
  )
  if (!gbin.base) throw new Error(`${file}.gbin sem terreno base`)

  // Terreno: uma parte por textura, classificada pelo property.xml.
  const terrainPet = readPet(await fetchBytes(`${ref.round}/map/${gbin.base.name}`))
  const terrain = petToSubMeshes(terrainPet).map((sub) => ({
    surface: property.surfaceOf(sub.texture ?? ''),
    positions: transform(sub.positions, gbin.base!.matrix),
  }))

  const collisionTriangles = new Float32Array(terrain.reduce((n, p) => n + p.positions.length, 0))
  const surfaces: SurfaceClass[] = []
  let offset = 0
  for (const part of terrain) {
    collisionTriangles.set(part.positions, offset)
    offset += part.positions.length
    for (let t = 0; t < part.positions.length / 9; t++) surfaces.push(part.surface)
  }

  // Objetos: um modelo .pet por nome, instanciado em cada posição.
  const byModel = Map.groupBy(gbin.elements, (e: GbinElement) => e.name)
  const objects: HoleObject[] = []
  const missingModels: string[] = []
  await Promise.all(
    [...byModel].map(async ([model, elements]) => {
      try {
        const pet = readPet(await fetchBytes(`${ref.round}/ase/${model}`))
        objects.push({
          model,
          subMeshes: petToSubMeshes(pet),
          instances: elements.map((e) => e.matrix),
        })
      } catch {
        missingModels.push(model)
      }
    }),
  )

  const points = holePoints(gbin)
  return {
    ref,
    par: gbin.mapCheck?.par ?? 0,
    tee: points.tees[0] ?? [0, 0, 0],
    pin: points.pins[0] ?? [0, 0, 0],
    terrain,
    collision: { triangles: collisionTriangles, surfaces },
    objects,
    missingModels,
  }
}

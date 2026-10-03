import {
  applyMat4x3,
  baseCornerColors,
  boxesFromModels,
  holePoints,
  petToSubMeshes,
  readCourseProperty,
  readGbin,
  readPet,
  readPycb,
  solidBoxes,
  type CollisionBox,
  type GbinElement,
  type GbinSoundBox,
  type Mat4x3,
  type Pet,
  type PetSubMesh,
  type SurfaceClass,
} from '@pangya/formats'

/**
 * De onde vêm os arquivos do jogo: `fetch` no navegador, disco no servidor. Os caminhos
 * são relativos à pasta assets/original (ex.: "round02_blue/map/blue_01.gbin").
 */
export interface FileSource {
  /** Bytes do arquivo, ou undefined se não existir. */
  read(path: string): Promise<Uint8Array | undefined>
  /** Arquivo referenciado só pelo nome (modelos, texturas), procurado pelo índice. */
  find(name: string, round: string): Promise<Uint8Array | undefined>
}

/** Índice nome → caminho(s) gerado pelo pipeline (assets/original/_index.json). */
export type AssetIndex = Record<string, string | string[]>

/** Escolhe o caminho de um nome no índice: o da pasta do curso, senão o mais curto. */
export function pickIndexed(index: AssetIndex, name: string, round: string): string | undefined {
  const entry = index[name.toLowerCase()]
  if (entry === undefined || typeof entry === 'string') return entry
  const inRound = entry.find((p) => p.toLowerCase().split('/').includes(round.toLowerCase()))
  return inRound ?? entry[0]
}

export interface HoleRef {
  /** Pasta do curso, ex.: "round02_blue". */
  round: string
  /** Prefixo dos arquivos, ex.: "blue" (blue_01.gbin). */
  prefix: string
  hole: number
}

export interface TerrainPart {
  surface: SurfaceClass
  texture: string | undefined
  blend: boolean
  /** Posições já em coordenadas de mundo do Pangya (x, y, z por vértice). */
  positions: Float32Array
  uvs: Float32Array
  /** Iluminação pré-calculada (RGB 0–1 por vértice), quando o .gbin traz. */
  colors: Float32Array | undefined
}

export interface HoleObject {
  model: string
  /** Tem ossos e animação própria (navio balançando, lâmpada): a cena anima em vez de fixar. */
  animated?: boolean
  subMeshes: PetSubMesh[]
  /** Matrizes de mundo (Pangya) de cada instância. */
  instances: Mat4x3[]
}

export interface CourseFog {
  color: [number, number, number]
  near: number
  far: number
}

export interface HoleData {
  ref: HoleRef
  par: number
  tee: [number, number, number]
  pin: [number, number, number]
  terrain: TerrainPart[]
  /** Triângulos do terreno (9 floats cada) e o piso de cada um, para a física. */
  collision: { triangles: Float32Array; surfaces: SurfaceClass[] }
  objects: HoleObject[]
  missingModels: string[]
  fog: CourseFog | undefined
  /** Caixas sólidas dos objetos (do .pycb do buraco ou geradas pelos modelos). */
  obstacles: CollisionBox[]
  obstacleSource: 'pycb' | 'modelos'
  /** Sons ambientes do buraco (caixas de som do .gbin: "바다" = mar). */
  ambient: string[]
  /** Bichos do cenário (caixas "*pet NPC_SeaGull.pet *num 5"), com a área onde ficam. */
  npcs: HoleNpc[]
}

export interface HoleNpc {
  model: string
  /** Comportamento do jogo ("*type": 0 voa, 1 borboleta, 3 toupeira, 4 golfinho, 5 anda). */
  type?: number
  count: number
  box: { min: [number, number, number]; max: [number, number, number] }
}

/**
 * Caixas de som do .gbin: o nome é um som ambiente ("바다") ou um comando que põe bichos
 * no cenário ("*type 0 *pet NPC_SeaGull.pet *num 5"). "*extra" e vazias ficam de fora.
 */
export function readSoundBoxes(boxes: GbinSoundBox[]): { ambient: string[]; npcs: HoleNpc[] } {
  const ambient = new Set<string>()
  const npcs: HoleNpc[] = []
  for (const { name, box } of boxes) {
    const text = name.trim()
    const pet = /\*pet\s+(\S+)/i.exec(text)?.[1]
    if (pet) {
      const count = Number(/\*num\s+(\d+)/i.exec(text)?.[1] ?? 1)
      const type = /\*type\s+(\d+)/i.exec(text)?.[1]
      npcs.push({
        model: pet,
        ...(type !== undefined && { type: Number(type) }),
        count,
        box: { min: box.min, max: box.max },
      })
    } else if (text && !text.startsWith('*')) ambient.add(text)
  }
  return { ambient: [...ambient], npcs }
}

const transform = (positions: Float32Array, matrix: Mat4x3) => {
  const out = new Float32Array(positions.length)
  for (let i = 0; i < positions.length; i += 3) {
    out.set(applyMat4x3(matrix, positions[i]!, positions[i + 1]!, positions[i + 2]!), i)
  }
  return out
}

/** `<prefixo>_fog.txt`: "r g b" (0–255) e "perto longe" (unidades). */
export function parseFog(text: string): CourseFog | undefined {
  const n = text.trim().split(/\s+/).map(Number)
  if (n.length < 5 || n.slice(0, 5).some((v) => !Number.isFinite(v))) return undefined
  const [r, g, b, near, far] = n as [number, number, number, number, number]
  return { color: [r / 255, g / 255, b / 255], near, far: far > near + 1 ? far : near + 1000 }
}

const holeFile = (ref: HoleRef) => `${ref.prefix}_${String(ref.hole).padStart(2, '0')}`

/**
 * Os cursos aparecem em `round02_blue/...` (extraídos dos .pak) ou `data/round02_blue/...`
 * (pacote de exemplo): tenta os dois.
 */
async function readCourse(files: FileSource, path: string) {
  return (await files.read(path)) ?? (await files.read(`data/${path}`))
}

async function required(files: FileSource, path: string) {
  const bytes = await readCourse(files, path)
  if (!bytes) throw new Error(`não encontrado: ${path}`)
  return bytes
}

/** Verifica se o buraco existe (para saber quantos buracos o curso tem). */
export async function holeExists(files: FileSource, ref: HoleRef) {
  return (await readCourse(files, `${ref.round}/map/${holeFile(ref)}.gbin`)) !== undefined
}

/**
 * Carrega um buraco: terreno (com pisos), objetos, colisão, névoa, tee e pin.
 * `withModels: false` pula as malhas dos objetos que só servem para desenhar (servidor),
 * mas os modelos continuam sendo lidos quando faltam as caixas do .pycb.
 */
export async function loadHoleData(
  files: FileSource,
  ref: HoleRef,
  options: { withModels?: boolean } = {},
): Promise<HoleData> {
  const withModels = options.withModels ?? true
  const file = holeFile(ref)
  const gbin = readGbin(await required(files, `${ref.round}/map/${file}.gbin`))
  const property = readCourseProperty(
    await required(files, `${ref.round}/text/${ref.prefix}_property.xml`),
  )
  if (!gbin.base) throw new Error(`${file}.gbin sem terreno base`)

  // Terreno: uma parte por textura, classificada pelo property.xml.
  const terrainPet = readPet(await required(files, `${ref.round}/map/${gbin.base.name}`))
  const colors = baseCornerColors(terrainPet, gbin.baseColors)
  const terrain: TerrainPart[] = petToSubMeshes(terrainPet, colors).map((sub) => ({
    surface: property.surfaceOf(sub.texture ?? ''),
    texture: sub.texture,
    blend: sub.blend,
    positions: transform(sub.positions, gbin.base!.matrix),
    uvs: sub.uvs,
    colors: sub.colors,
  }))

  const collisionTriangles = new Float32Array(terrain.reduce((n, p) => n + p.positions.length, 0))
  const surfaces: SurfaceClass[] = []
  let offset = 0
  for (const part of terrain) {
    collisionTriangles.set(part.positions, offset)
    offset += part.positions.length
    for (let t = 0; t < part.positions.length / 9; t++) surfaces.push(part.surface)
  }

  const pycb = await readCourse(files, `${ref.round}/map/_coll/${file}.pycb`)

  // Objetos: um modelo .pet por nome, instanciado em cada posição.
  const byModel = Map.groupBy(gbin.elements, (e: GbinElement) => e.name)
  const objects: HoleObject[] = []
  const pets = new Map<string, Pet>()
  const missingModels: string[] = []
  if (withModels || !pycb) {
    await Promise.all(
      [...byModel].map(async ([model, elements]) => {
        try {
          const bytes =
            (await files.find(model, ref.round)) ??
            (await readCourse(files, `${ref.round}/ase/${model}`))
          if (!bytes) throw new Error('não encontrado')
          const pet = readPet(bytes)
          pets.set(model, pet)
          if (withModels) {
            objects.push({
              model,
              ...(pet.bones.length > 0 && pet.animations.length > 0 && { animated: true }),
              subMeshes: petToSubMeshes(pet),
              instances: elements.map((e) => e.matrix),
            })
          }
        } catch {
          missingModels.push(model)
        }
      }),
    )
  }

  // Colisão dos objetos: o .pycb do buraco; sem ele, os blocos COLL dos modelos.
  const boxes = pycb
    ? readPycb(pycb)
    : boxesFromModels(
        gbin.elements.map((e) => ({ model: e.name, matrix: e.matrix })),
        pets,
      )

  const fogBytes =
    (await files.find(`${ref.prefix}_fog.txt`, ref.round)) ??
    (await readCourse(files, `${ref.round}/text/${ref.prefix}_fog.txt`))
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
    fog: fogBytes && parseFog(new TextDecoder().decode(fogBytes)),
    obstacles: solidBoxes(boxes),
    obstacleSource: pycb ? 'pycb' : 'modelos',
    ...readSoundBoxes(gbin.soundBoxes),
  }
}

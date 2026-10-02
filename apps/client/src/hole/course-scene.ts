import {
  BackSide,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  SRGBColorSpace,
  type Material,
  type Scene,
  type Texture,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { flipZ, sceneMatrix } from './coords.ts'
import type { HoleRef, LoadedHole } from './load-hole.ts'
import { SURFACE_COLORS } from './surface-colors.ts'
import { averageColor, type TextureLibrary } from './textures.ts'

/** Unidades por jarda (a névoa do <curso>_fog.txt parece estar em jardas — verificar). */
const FOG_SCALE = 3.2
export const SKY_RADIUS = 5000

const objectColor = (model: string) =>
  /tree|plant|flower|bush|boosh|leaf|grass/i.test(model)
    ? 0x3f9b4a
    : /house|lamp|parasol|box|bottle/i.test(model)
      ? 0xe6d3b3
      : 0xb9b0a3

/** Cores pré-calculadas vêm em sRGB; o Three.js espera atributos lineares. */
const srgbToLinear = (colors: Float32Array) =>
  colors.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))

/** Material como o GhostMapEditor desenha: sem luz, recorte de alfa, "]" = transparente. */
function texturedMaterial(texture: Texture, blend: boolean, vertexColors: boolean) {
  return new MeshBasicMaterial({
    map: texture,
    vertexColors,
    side: DoubleSide,
    alphaTest: blend ? 0.01 : 0.5,
    transparent: blend,
    depthWrite: !blend,
  })
}

export interface CourseScene {
  /** Malhas do terreno (a câmera não deve atravessá-las). */
  terrainMeshes: Mesh[]
  /** Alterna entre texturas reais e o mapa de pisos (cores de depuração). */
  setSurfaceView(on: boolean): void
  setFog(on: boolean): void
  /** Mantém o céu centrado na câmera. */
  update(camera: { position: { x: number; y: number; z: number } }): void
  texturesLoaded: number
  texturesMissing: string[]
}

export async function buildCourseScene(
  hole: LoadedHole,
  scene: Scene,
  textures: TextureLibrary,
  onProgress: (done: number, total: number) => void,
): Promise<CourseScene> {
  // Carrega todas as texturas antes de montar (com progresso).
  const names = new Set<string>()
  for (const part of hole.terrain) if (part.texture) names.add(part.texture)
  for (const object of hole.objects) {
    for (const sub of object.subMeshes) if (sub.texture) names.add(sub.texture)
  }
  let done = 0
  await Promise.all(
    [...names].map((name) => textures.get(name).then(() => onProgress(++done, names.size))),
  )

  const terrainMeshes: Mesh[] = []
  const views: { mesh: Mesh; textured: Material; surface: Material }[] = []
  for (const part of hole.terrain) {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(flipZ(part.positions), 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(part.uvs, 2))
    if (part.colors) {
      geometry.setAttribute('color', new Float32BufferAttribute(srgbToLinear(part.colors), 3))
    }
    geometry.computeVertexNormals()
    const surface = new MeshLambertMaterial({
      color: SURFACE_COLORS[part.surface.kind],
      side: DoubleSide,
    })
    const texture = await textures.get(part.texture)
    const textured = texture ? texturedMaterial(texture, part.blend, !!part.colors) : surface
    const mesh = new Mesh(geometry, textured)
    if (part.blend) mesh.renderOrder = 1
    terrainMeshes.push(mesh)
    views.push({ mesh, textured, surface })
    scene.add(mesh)
  }

  for (const object of hole.objects) {
    const parts = object.subMeshes.map((sub) => {
      const g = new BufferGeometry()
      g.setAttribute('position', new Float32BufferAttribute(sub.positions, 3))
      g.setAttribute('normal', new Float32BufferAttribute(sub.normals, 3))
      g.setAttribute('uv', new Float32BufferAttribute(sub.uvs, 2))
      return g
    })
    const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts, true)
    if (!geometry) continue
    if (parts.length === 1) geometry.addGroup(0, object.subMeshes[0]!.positions.length / 3, 0)
    const fallback = new MeshLambertMaterial({ color: objectColor(object.model), side: DoubleSide })
    const materials = await Promise.all(
      object.subMeshes.map(async (sub) => {
        const texture = await textures.get(sub.texture)
        return texture ? texturedMaterial(texture, sub.blend, false) : fallback
      }),
    )
    const mesh = new InstancedMesh(geometry, materials, object.instances.length)
    object.instances.forEach((m, i) => mesh.setMatrixAt(i, sceneMatrix(m)))
    if (object.subMeshes.some((sub) => sub.blend)) mesh.renderOrder = 1
    scene.add(mesh)
  }

  // Névoa do curso.
  const fog = hole.fog
    ? new Fog(
        new Color().setRGB(...hole.fog.color, SRGBColorSpace),
        hole.fog.near * FOG_SCALE,
        hole.fog.far * FOG_SCALE,
      )
    : new Fog(0x9fd4ff, 900, 2600)
  scene.fog = fog
  scene.background = fog.color.clone()

  const sky = await buildSky(hole.ref, textures)
  if (sky) {
    scene.add(sky.mesh)
    if (sky.up) scene.background = sky.up
  }

  return {
    terrainMeshes,
    setSurfaceView(on) {
      for (const v of views) v.mesh.material = on ? v.surface : v.textured
    },
    setFog(on) {
      scene.fog = on ? fog : null
    },
    update(camera) {
      sky?.mesh.position.set(camera.position.x, camera.position.y, camera.position.z)
    },
    texturesLoaded: textures.loaded,
    texturesMissing: [...textures.missing],
  }
}

/**
 * Céu como no GhostMapEditor: cilindro com `<prefixo>_far.jpg` em volta da câmera, topo e
 * fundo com a cor média de `_up.jpg` e `_dn.jpg`.
 */
async function buildSky(ref: HoleRef, textures: TextureLibrary) {
  const far = await textures.get(`${ref.prefix}_far.jpg`)
  if (!far) return undefined
  const cylinder = new CylinderGeometry(SKY_RADIUS, SKY_RADIUS, SKY_RADIUS * 1.8, 64, 1, true)
  // UV v do Three.js cresce para cima; a imagem (sem flipY) tem o topo em v = 0.
  const uv = cylinder.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i))
  const material = new MeshBasicMaterial({
    map: far,
    side: BackSide,
    fog: false,
    depthWrite: false,
  })
  const mesh = new Mesh(cylinder, material)
  mesh.renderOrder = -1
  mesh.frustumCulled = false

  const capColor = async (name: string) => {
    const image = await textures.image(name)
    return image && new Color().setRGB(...averageColor(image), SRGBColorSpace)
  }
  const up = await capColor(`${ref.prefix}_up.jpg`)
  const down = await capColor(`${ref.prefix}_dn.jpg`)
  if (down) {
    const bottom = new Mesh(
      new CircleGeometry(SKY_RADIUS, 64),
      new MeshBasicMaterial({ color: down, side: DoubleSide, fog: false, depthWrite: false }),
    )
    bottom.rotation.x = Math.PI / 2
    bottom.position.y = -SKY_RADIUS * 0.9
    bottom.renderOrder = -1
    mesh.add(bottom)
  }
  return { mesh, up }
}

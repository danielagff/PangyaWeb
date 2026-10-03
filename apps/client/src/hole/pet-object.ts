/**
 * Modelo parado de um .pet (moeda, bola…) como objeto da cena: as peças com as texturas do
 * jogo, já com o Z invertido (o Pangya tem Z invertido em relação à cena).
 */
import { petToSubMeshes, readPet } from '@pangya/formats'
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshLambertMaterial,
  Vector3,
} from 'three'
import { findAsset, tryFetchBytes } from './assets.ts'
import { TextureLibrary } from './textures.ts'

const textures = new TextureLibrary('')

/**
 * Carrega `name` (nome do arquivo .pet, achado pelo índice) ou undefined sem o arquivo.
 * `center`: o meio do modelo vai para a origem.
 */
export async function loadPetObject(
  name: string,
  options: { center?: boolean; color?: number } = {},
): Promise<Group | undefined> {
  const path = await findAsset(name, '')
  const bytes = path && (await tryFetchBytes(path))
  if (!bytes) return undefined
  const group = new Group()
  const meshes = petToSubMeshes(readPet(bytes))
  for (const sub of meshes) {
    const geometry = new BufferGeometry()
    const positions = sub.positions.slice()
    for (let i = 2; i < positions.length; i += 3) positions[i] = -positions[i]!
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(sub.normals, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(sub.uvs, 2))
    // "!specular…": camada de brilho do jogo, não é a textura da peça.
    if (sub.texture?.startsWith('!')) continue
    const texture = await textures.get(sub.texture)
    group.add(
      new Mesh(
        geometry,
        new MeshLambertMaterial({
          ...(texture ? { map: texture } : { color: options.color ?? 0xdddddd }),
          side: DoubleSide,
          transparent: true,
        }),
      ),
    )
  }
  if (group.children.length === 0) return undefined
  if (options.center) {
    const box = new Vector3()
    const center = new Vector3()
    const bounds = group.children.map((m) => {
      const g = (m as Mesh).geometry
      g.computeBoundingBox()
      return g.boundingBox!
    })
    const all = bounds[0]!.clone()
    for (const b of bounds) all.union(b)
    all.getCenter(center)
    all.getSize(box)
    for (const m of group.children) (m as Mesh).geometry.translate(-center.x, -center.y, -center.z)
  }
  return group
}

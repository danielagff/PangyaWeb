/** Vetor 3D imutável usado pela simulação (Y para cima, metros). */
export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

export const vec3 = {
  of: (x: number, y: number, z: number): Vec3 => ({ x, y, z }),
  add: (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  sub: (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  scale: (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s }),
  dot: (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z,
  length: (a: Vec3): number => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z),
}

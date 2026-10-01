// Leitor do <curso>_property.xml: tabela de tipos de piso do curso.
// Cada classe liga texturas do terreno a um tipo de piso, com os coeficientes de
// quique (bound) e rolagem (roll) e a faixa de força disponível (min/max, em %).
// Formato documentado no guia de lbarceloss (pangya-pet_tools/docs), verificado contra
// o ProjectG.exe (TinyXML, sub_66CF70). Arquivo em EUC-KR (CP949).

export type SurfaceKind =
  | 'default'
  | 'tee'
  | 'fairway'
  | 'rough'
  | 'highRough'
  | 'tallGrass'
  | 'green'
  | 'bunker'
  | 'sand'
  | 'water'
  | 'waterPass'
  | 'road'
  | 'rock'
  | 'cliff'
  | 'hardWood'
  | 'softWood'
  | 'leafBlock'
  | 'leafPass'
  | 'fruit'
  | 'other'

/** Nomes das classes no XML (coreano) → tipo de piso. */
const KIND_BY_NAME: Record<string, SurfaceKind> = {
  default: 'default',
  티샷: 'tee',
  페어웨이: 'fairway',
  러프: 'rough',
  하이러프: 'highRough',
  풀: 'tallGrass',
  그린: 'green',
  벙커: 'bunker',
  모래사장: 'sand',
  천: 'water',
  통과천: 'waterPass',
  길: 'road',
  바위: 'rock',
  절벽: 'cliff',
  '딱딱한 나무': 'hardWood',
  '연질 나무': 'softWood',
  열매: 'fruit',
}

export interface PowerRange {
  min: number
  max: number
}

export interface SurfaceClass {
  /** Nome original da classe (coreano). */
  name: string
  kind: SurfaceKind
  sort: string
  /** Coeficiente de quique. */
  bound: number
  /** Coeficiente de rolagem. */
  roll: number
  /** % de força disponível quando a bola está neste piso. */
  power: PowerRange
  power2?: PowerRange
  power3?: PowerRange
  pass: boolean
  boundSound: string
  rollSound: string
  /** Modelo do efeito de "lie" (ex.: green.pet). */
  pet: string
  textures: string[]
}

export interface CourseProperty {
  round: string
  classes: SurfaceClass[]
  /** Classe de uma textura do terreno (sem diferenciar maiúsculas); "default" se não listada. */
  surfaceOf(texture: string): SurfaceClass
}

const tag = (body: string, name: string) =>
  new RegExp(`<${name}>([^<]*)</${name}>`).exec(body)?.[1]?.trim()

const num = (body: string, name: string) => {
  const value = tag(body, name)
  return value === undefined ? undefined : Number(value)
}

const range = (body: string, suffix = ''): PowerRange | undefined => {
  const min = num(body, `min${suffix}`)
  const max = num(body, `max${suffix}`)
  return min === undefined || max === undefined ? undefined : { min, max }
}

function classifyName(name: string): SurfaceKind {
  if (KIND_BY_NAME[name]) return KIND_BY_NAME[name]
  // Folhas: "불통과 (야자수)" bloqueia, "통과 (잎사귀 그룹)" deixa passar.
  if (name.startsWith('불통과')) return 'leafBlock'
  if (name.startsWith('통과')) return 'leafPass'
  return 'other'
}

export function parseCourseProperty(xml: string): CourseProperty {
  const round = /<round\s+name="([^"]*)"/.exec(xml)?.[1] ?? ''
  const classes: SurfaceClass[] = []

  for (const match of xml.matchAll(
    /<class\s+name="([^"]*)"(?:\s+sort="([^"]*)")?\s*>([\s\S]*?)<\/class>/g,
  )) {
    const [, name = '', sort = '', body = ''] = match
    const textures = [
      ...(/<textures>([\s\S]*?)<\/textures>/.exec(body)?.[1] ?? '').matchAll(
        /<item>([^<]*)<\/item>/g,
      ),
    ].map((m) => m[1]!.trim())
    const power2 = range(body, '2')
    const power3 = range(body, '3')
    classes.push({
      name,
      kind: classifyName(name),
      sort,
      bound: num(body, 'bound') ?? 0.5,
      roll: num(body, 'roll') ?? 0.5,
      power: range(body) ?? { min: 100, max: 100 },
      ...(power2 ? { power2 } : {}),
      ...(power3 ? { power3 } : {}),
      pass: (num(body, 'pass') ?? 0) !== 0,
      boundSound: tag(body, 'bound_sound') ?? '',
      rollSound: tag(body, 'roll_sound') ?? '',
      pet: tag(body, 'pet') ?? '',
      textures,
    })
  }

  const fallback =
    classes.find((c) => c.kind === 'default') ??
    ({
      name: 'default',
      kind: 'default',
      sort: '',
      bound: 0.5,
      roll: 0.5,
      power: { min: 90, max: 100 },
      pass: false,
      boundSound: '',
      rollSound: '',
      pet: '',
      textures: [],
    } satisfies SurfaceClass)

  const byTexture = new Map<string, SurfaceClass>()
  for (const c of classes) for (const t of c.textures) byTexture.set(t.toLowerCase(), c)

  return {
    round,
    classes,
    surfaceOf: (texture) => byTexture.get(texture.toLowerCase()) ?? fallback,
  }
}

/** Lê o arquivo (EUC-KR) do disco/pak. */
export function readCourseProperty(bytes: Uint8Array): CourseProperty {
  return parseCourseProperty(new TextDecoder('euc-kr').decode(bytes))
}

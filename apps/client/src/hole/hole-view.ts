import {
  DEFAULT_POWER,
  HoleWorld,
  isPangya,
  loadHoleData,
  solveShot,
  type ShotEvent,
  type HoleRef,
  type HoleState,
  type Point,
  type ShotRequest,
} from '@pangya/game'
import { readPet, type SurfaceKind } from '@pangya/formats'
import {
  CUP_DEPTH,
  CUP_FALL,
  dropIntoCup,
  STEP_TIME,
  unitsToMeters,
  type PowerShot,
  unitsToYards,
  yardsToUnits,
  type Wind,
} from '@pangya/physics'
import {
  AlwaysDepth,
  AlwaysStencilFunc,
  AmbientLight,
  BackSide,
  Box3,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  EqualStencilFunc,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Raycaster,
  ReplaceStencilOp,
  RingGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { FrameCommand } from '@pangya/formats'
import { courseMusicEvent, scoreSound, scoreVoice, soundEvent } from '../audio/sound-events.ts'
import { sound, type SoundLibrary } from '../audio/sounds.ts'
import {
  CAMERA_PATH_FOV,
  CAMERA_PATH_FPS,
  CameraPath,
  cameraPathName,
  type CameraSegment,
} from '../character/camera-path.ts'
import { categoryOfClub, clubModelFor } from '../character/clubs.ts'
import {
  golfMotions,
  reactionEnding,
  reactionForScore,
  reactionMotion,
  type Reaction,
} from '../character/motions.ts'
import {
  placeAtBall,
  CharacterModel,
  loadCatalog,
  type CharacterEntry,
} from '../character/character.ts'

import { courseName } from '../menu/courses.ts'
import { BALL_PLAYBACK_SPEED } from '../settings.ts'
import { browserFiles, findAsset, tryFetchBytes } from './assets.ts'
import { aimDirection, toScene } from './coords.ts'
import { buildCourseScene, SKY_RADIUS, type CourseScene } from './course-scene.ts'
import { buildGreenGrid } from './green-grid.ts'
import type { PowerBar } from './power-bar.ts'
import { EffectSystem } from '../effects/effect-system.ts'
import { ImpactText } from './impact-text.ts'
import { PangBurst } from './pang-burst.ts'
import { loadPetObject } from './pet-object.ts'
import { createShotHud, type ShotHud } from './shot-hud.ts'
import { lerpFactor, Smooth } from './smooth.ts'
import { SURFACE_LABELS } from './surface-colors.ts'
import { TextureLibrary } from './textures.ts'

/** Raio da bola na tela (unidades). Maior que o real (0,07) para ser vista, como no jogo. */
const BALL_RADIUS = 0.2
const MAX_TRAIL = 4000
/** Raio da cova desenhada (unidades); a captura da física usa GROUND_TUNING.cupRadius. */
const CUP_RADIUS = 0.45
/**
 * Altura desenhada da luz da cova (unidades, ~28 m), alta como no original; a parte que pega a
 * bola é CUP_BEAM.height. No topo dela fica o marcador do pin (desnível e distância).
 */
const BEAM_HEIGHT = 100
/** Raio da coluna de luz (unidades) e a largura mínima dela na tela (px). */
const BEAM_RADIUS = 0.9
const BEAM_MIN_PIXELS = 6
/** Distância da cova (jardas) em que parar arranca um "oh…" do público. */
const NEAR_MISS_YARDS = 1.5
/** Segundos antes de a bola cair em que a câmera livre do voo volta ao normal. */
const FREE_CAMERA_UNTIL_LANDING = 0.8
/**
 * Câmera da tacada, como no Pangya (vídeo do Daniel; distâncias em unidades, tempos em
 * segundos de tela). Cada tacada sorteia uma câmera e vai nela até a bola cair:
 * - `hold`: no swing e logo depois da batida, parada atrás do jogador (a bola e os pangs);
 * - `chase`: colada atrás da bola, baixa, olhando para a frente;
 * - `sky`: do chão, atrás e embaixo da bola, olhando para ela (o céu quando ela sobe);
 * - `high`: bem alta atrás da bola, vendo o curso de cima;
 * - `side`: parada ao lado do meio do voo, girando para acompanhar (tacadas longas).
 * `arrival.lead` s antes de a bola cair, **corta** para uma câmera parada perto da queda (se a
 * bola vai entrar ou parar a menos de `cup.stopYards` da cova, perto da cova) que só gira para
 * ver a bola; se a bola rola para longe dela, vai atrás devagar. Quando a bola para, a câmera
 * fica onde está (sem zoom) até a próxima tacada. No putt: atrás da bola, baixa.
 */
const SHOT_CAMERA = {
  aim: { back: 22, up: 8, look: 40 },
  putt: { back: 18, up: 9, look: 25 },
  hold: 0.5,
  chase: { back: 9, up: 2.5, look: 30, lerp: 0.35 },
  sky: { back: 24, up: 3, lerp: 0.08 },
  high: { back: 30, up: 45, look: 45, lerp: 0.15 },
  side: { along: 0.45, out: 0.35, up: 10 },
  /** Tacadas mais curtas que isto (jardas) sorteiam só `chase` e `high`. */
  shortYards: 60,
  arrival: { lead: 1.1, back: 22, side: 7, up: 8, far: 60, follow: 0.03 },
  cup: { stopYards: 2, back: 13, side: 4, up: 5.5, sideView: 14, near: 15 },
  puttRoll: { back: 11, up: 4.5, look: 6, lerp: 0.1 },
  /** Suavização do ponto para onde a câmera olha (por quadro a 60 q/s). */
  lookLerp: 0.15,
}
type ShotCameraMode = 'chase' | 'sky' | 'high' | 'side'
/**
 * Comemoração depois de embocar: `wait` s vendo a cova (efeitos e pangs); depois corta para o
 * personagem perto da cova (`fromCup`), de frente para a câmera, fazendo a pose do resultado
 * (do hole in one ao double bogey), no máximo `seconds` s antes do quadro de fim. A câmera
 * fica a `distance` alturas do personagem, a `up` altura do chão, olhando a `lookHeight`.
 */
const CELEBRATION = {
  wait: 1.6,
  fromCup: 3,
  distance: 1.7,
  up: 0.55,
  lookHeight: 0.55,
  seconds: 4.5,
}
/**
 * Câmera lenta perto da cova, do próprio jogo (data/lua_script/improve_ingame_play.lua,
 * `near_holecup_present`): a bola a menos de `radius` (unidades) da cova, rente ao chão
 * (`height`), anda a `speed` da velocidade normal, chegando a ela em `ease` s. `holeIn` vale
 * quando a bola vai entrar (o jogo também tem linhas para backspin e tacadas especiais).
 */
const NEAR_CUP_SLOW = {
  normal: { radius: 3.0, speed: 0.3, ease: 0.3 },
  holeIn: { radius: 1.5, speed: 0.1, ease: 0.1 },
  height: 2,
}
/**
 * 2º power shot de madeira: o movimento do personagem, a cena das câmeras animadas e em que
 * fração do movimento o taco acerta a bola (estimativa, quando o .apet não tem o *shot).
 */
const POWER_SHOT_TWO = { motion: '우드샷파워2', camera: '우드파워샷2', impact: 0.45 }
/** Entrada do personagem no começo do buraco (movimento e cena das câmeras). */
const ENTRANCE = '등장모션'
/** Efeitos do jogo (data/effect/renewal/*.seq). */
const EFFECTS = {
  pangya: 'pangya_shot.seq',
  normal: 'nomal_shot.seq',
  holeIn: 'hole_in_eff.seq',
}
/** Força da barra (0..1) a partir da qual o swing usa o som forte ("_s"). */
const SWING_STRONG_PERCENT = 0.7
/** Moedas (pangs) que saem da bola no PANGYA e da cova quando a bola entra. */
/** Moedas saindo da cova por resultado (hole in one/albatross é o "albatross"). */
const PANG_COINS: Partial<Record<Reaction, number>> = {
  albatross: 40,
  eagle: 30,
  birdie: 20,
  par: 12,
  bogey: 6,
}
const UP = new Vector3(0, 1, 0)
/** Altura da vista aérea (unidades): perto da cova até o buraco inteiro. */
const AERIAL = { minHeight: 12, maxHeight: 3000 }
/**
 * Vista aérea segurando as teclas: Shift+↑/↓ = zoom (fator por segundo); ↑/↓ = andar pela
 * linha da mira (fração da altura por segundo, para valer em qualquer zoom).
 */
const AERIAL_ZOOM_RATE = 1
/** ↑/↓: começa devagar (`slow`) e acelera até `fast` (fração da altura por segundo). */
const AERIAL_PAN = { slow: 0.1, fast: 0.45, rampSeconds: 1.5 }

/**
 * Mira (graus): um toque gira um passo fino; segurando, depois de `holdDelay` s, gira sozinha
 * cada vez mais rápido (de `speed[0]` a `speed[1]` graus/s em `rampSeconds`). No green, tudo
 * mais fino.
 */
const AIM_TUNING = {
  step: 0.1,
  greenStep: 0.05,
  holdDelay: 0.25,
  speed: [2, 25],
  greenSpeed: [0.6, 8],
  rampSeconds: 2.5,
}
/** Segundos entre os recálculos exatos do ponto de queda enquanto a mira gira. */
const LANDING_REFRESH = 0.12
const DEG = Math.PI / 180
/** Teclas de mira e o sentido (positivo = esquerda). */
const AIM_KEYS: Record<string, 1 | -1> = { ArrowLeft: 1, KeyA: 1, ArrowRight: -1, KeyD: -1 }

/** "Sempre PANGYA" (desenvolvimento, só sozinho), lembrado neste navegador. */
const AUTO_PANGYA_KEY = 'pangyaweb.semprePangya'
function readAutoPangya() {
  try {
    return localStorage.getItem(AUTO_PANGYA_KEY) === '1'
  } catch {
    return false
  }
}
function saveAutoPangya(on: boolean) {
  try {
    localStorage.setItem(AUTO_PANGYA_KEY, on ? '1' : '0')
  } catch {
    // sem armazenamento: vale só nesta página
  }
}

/**
 * Desenhos por cima do jogo, como no original: na vista aérea, a linha vermelha da bola até o
 * X (onde a bola cai a 100% com o taco e a mira atuais) com a distância; sempre, o marcador do
 * pin (bandeira, triângulo, desnível em m e distância) — no topo da luz da cova na câmera
 * normal, na cova na vista aérea.
 */
const COURSE_OVERLAY = `<svg class="course-overlay" width="100%" height="100%" aria-hidden="true">
  <line class="aim-line" />
  <g class="x-mark">
    <path d="M-7 -7 L7 7 M7 -7 L-7 7" class="x-outline" />
    <path d="M-7 -7 L7 7 M7 -7 L-7 7" class="x-cross" />
    <text class="x-label" y="-14" text-anchor="middle"></text>
  </g>
  <g class="pin-mark">
    <path d="M0 -13 L0 -38" class="pin-pole" />
    <path d="M0 -38 L13 -33 L0 -28 Z" class="pin-flag" />
    <path d="M-7 -13 L7 -13 L0 0 Z" class="pin-tip" />
    <text class="pin-height" x="11" y="-4"></text>
    <text class="pin-distance" y="17" text-anchor="middle"></text>
  </g>
</svg>`

/**
 * Luz da cova (no lugar da bandeira), como no original: coluna verde-água alta, mais clara no
 * meio e sumindo no topo. Ela "puxa" a bola que passa baixo o bastante (CUP_BEAM.height, na
 * física); o desenho é só a coluna.
 */
function cupBeam() {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256
  const g = canvas.getContext('2d')!
  const gradient = g.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, 'rgba(255,255,255,0)')
  gradient.addColorStop(0.12, 'rgba(255,255,255,1)')
  gradient.addColorStop(1, 'rgba(255,255,255,1)')
  g.fillStyle = gradient
  g.fillRect(0, 0, 4, 256)
  const fade = new CanvasTexture(canvas)
  const column = (radius: number, color: number, opacity: number) => {
    const material = new MeshBasicMaterial({
      color,
      map: fade,
      transparent: true,
      opacity,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
    })
    const mesh = new Mesh(new CylinderGeometry(radius, radius, BEAM_HEIGHT, 24, 1, true), material)
    mesh.position.y = BEAM_HEIGHT / 2
    mesh.renderOrder = 2
    return mesh
  }
  const outer = column(BEAM_RADIUS, 0x2ec4b6, 0.45)
  const core = column(BEAM_RADIUS / 3, 0xb8fff6, 0.85)
  const group = new Group()
  group.add(outer, core)
  return { group, material: outer.material as MeshBasicMaterial }
}

/** Ordem de desenho da cova (depois do terreno e dos objetos opacos). */
const CUP_ORDER = 10

/**
 * Cova de verdade, um buraco no green: a boca marca o stencil (só onde está visível, sem
 * morro na frente) e, dentro dela, a parede e o fundo são desenhados por cima do terreno,
 * regravando a profundidade — assim a bola que cai aparece lá dentro (ela é desenhada
 * depois, com CUP_ORDER + 3). `normal` inclina a cova com o green.
 */
function cupHole(normal: Vector3, at: Vector3) {
  const group = new Group()
  group.position.copy(at)
  group.quaternion.setFromUnitVectors(UP, normal)
  const flat = -Math.PI / 2

  const mouth = new Mesh(
    new CircleGeometry(CUP_RADIUS, 32),
    new MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: AlwaysStencilFunc,
      stencilZPass: ReplaceStencilOp,
    }),
  )
  mouth.rotation.x = flat
  mouth.renderOrder = CUP_ORDER

  // Dentro da boca: desenha por cima do terreno e grava a profundidade de dentro da cova.
  const inside = {
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: EqualStencilFunc,
    depthFunc: AlwaysDepth,
    fog: false,
  } as const
  // Parede com a borda branca de plástico em cima, escurecendo para o fundo.
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 64
  const g = canvas.getContext('2d')!
  const shade = g.createLinearGradient(0, 0, 0, 64)
  shade.addColorStop(0, '#f2f2f2')
  shade.addColorStop(0.18, '#d8d8d8')
  shade.addColorStop(0.2, '#4a4a4a')
  shade.addColorStop(1, '#141414')
  g.fillStyle = shade
  g.fillRect(0, 0, 4, 64)
  const wall = new Mesh(
    new CylinderGeometry(CUP_RADIUS, CUP_RADIUS, CUP_DEPTH, 32, 1, true),
    new MeshBasicMaterial({ ...inside, map: new CanvasTexture(canvas), side: BackSide }),
  )
  wall.position.y = -CUP_DEPTH / 2
  wall.renderOrder = CUP_ORDER + 1
  const bottom = new Mesh(
    new CircleGeometry(CUP_RADIUS, 32),
    new MeshBasicMaterial({ ...inside, color: 0x101010 }),
  )
  bottom.rotation.x = flat
  bottom.position.y = -CUP_DEPTH
  bottom.renderOrder = CUP_ORDER + 1

  const rim = new Mesh(
    new RingGeometry(CUP_RADIUS, CUP_RADIUS * 1.12, 32),
    new MeshBasicMaterial({ color: 0xf5f5f5, polygonOffset: true, polygonOffsetFactor: -4 }),
  )
  rim.rotation.x = flat
  group.add(mouth, wall, bottom, rim)
  return group
}

/** Rosa dos ventos: mostrador redondo, seta azul (girada pelo vento) e selo com os metros. */
/**
 * Rosa dos ventos como no original: aro prateado com 4 parafusos, miolo verde translúcido
 * (o chão aparece por baixo), seta azul com degradê (escura na cauda, clara na ponta) e o
 * selo preto com a força em metros. Fica embaixo à direita, ao lado da barra.
 */
const WIND_DIAL = `
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <linearGradient id="wind-ring" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" /><stop offset="0.35" stop-color="#d9dee3" />
        <stop offset="0.55" stop-color="#8e979f" /><stop offset="0.8" stop-color="#e9ecef" />
        <stop offset="1" stop-color="#aab2ba" />
      </linearGradient>
      <radialGradient id="wind-face" cx="0.45" cy="0.35" r="0.75">
        <stop offset="0" stop-color="#1f6b4a" stop-opacity="0.55" />
        <stop offset="1" stop-color="#06301f" stop-opacity="0.8" />
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="48.5" fill="url(#wind-ring)" stroke="#3b4248" stroke-width="1.5" />
    <circle cx="50" cy="50" r="40" fill="url(#wind-face)" stroke="#4a535b" stroke-width="2" />
    <path d="M18 34 A36 36 0 0 1 66 16" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.25" stroke-linecap="round" />
    <g fill="#3a4148">
      <circle cx="50" cy="5.5" r="1.8" /><circle cx="94.5" cy="50" r="1.8" />
      <circle cx="50" cy="94.5" r="1.8" /><circle cx="5.5" cy="50" r="1.8" />
    </g>
  </svg>
  <svg class="arrow" viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <linearGradient id="wind-arrow" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="#0b3f9e" /><stop offset="0.55" stop-color="#1d8be6" />
        <stop offset="1" stop-color="#3fd0ff" />
      </linearGradient>
    </defs>
    <path d="M50 17 L74 45 L61 45 L61 80 L39 80 L39 45 L26 45 Z"
      fill="url(#wind-arrow)" stroke="#06306b" stroke-width="1.2" stroke-linejoin="round" />
  </svg>
  <div class="speed">0m</div>`

export interface ViewPlayer {
  id: string
  name: string
  color: number
  state: HoleState
  /** Personagem (id do catálogo); sem ele, só a bola. */
  character?: string | undefined
  /** Atributo power (força) do jogador. */
  power?: number
  /** Modelo da bola (data/ball/<modelo>.pet); sem ele, a bola branca. */
  ball?: string | undefined
}

/** Etiqueta com o nome acima da bola (multiplayer). */
function nameTag(name: string, color: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const g = canvas.getContext('2d')!
  g.font = 'bold 34px system-ui, sans-serif'
  g.textAlign = 'center'
  g.lineWidth = 6
  g.strokeStyle = 'rgba(0,0,0,0.7)'
  g.strokeText(name, 128, 44)
  g.fillStyle = `#${color.toString(16).padStart(6, '0')}`
  g.fillText(name, 128, 44)
  const sprite = new Sprite(
    new SpriteMaterial({ map: new CanvasTexture(canvas), depthTest: false, fog: false }),
  )
  sprite.scale.set(16, 4, 1)
  sprite.renderOrder = 4
  return sprite
}

/**
 * Tudo o que se vê de um buraco: cenário, bolas dos jogadores, câmera, mira, painel e HUD.
 * Não decide regras nem simula — quem usa (modo sozinho ou online) chama `animateShot`
 * com a trajetória e `setPlayers` com o estado novo.
 */
export class HoleView {
  readonly world: HoleWorld
  readonly panel: ShotHud
  private readonly renderer: WebGLRenderer
  private readonly scene: Scene
  private readonly camera: PerspectiveCamera
  private readonly course: CourseScene
  private readonly elements: HTMLElement[] = []
  private readonly hud: HTMLElement
  private readonly status: HTMLElement
  private readonly balls = new Map<string, { ball: Mesh; tag: Sprite | undefined }>()
  private readonly target: Mesh
  private readonly greenGrid: LineSegments
  private readonly boxLines: LineSegments
  private readonly trailPositions: Float32BufferAttribute
  private readonly trailGeometry = new BufferGeometry()
  private readonly ray = new Raycaster()
  private readonly pangs = new PangBurst()
  /** Efeitos do jogo (.seq/.spr): brilho da batida, cova… */
  private readonly effects = new EffectSystem()
  /** Letreiro da batida (PangYa, Bad) com a imagem do jogo. */
  private readonly impactText = new ImpactText()
  /** Clarão branco dos efeitos (Add_Flash). */
  private readonly flashBox = document.createElement('div')
  /** Para onde a câmera olha (suavizado) nas câmeras da tacada. */
  private readonly lookPoint = new Vector3()
  /** Depois da tacada a câmera fica parada até a próxima vez (sem zoom no fim). */
  private cameraHold = false
  /** Câmera fixa da comemoração (posição e para onde olha). */
  private cinematic:
    | { position: Vector3; look: Vector3 }
    | { path: CameraPath; segment: CameraSegment; model: CharacterModel; started: number }
    | undefined
  /** Câmeras animadas de cada personagem (arquivo <personagem>_cam.apet), já carregadas. */
  /** Entrada do personagem tocando (sem mira nem tacada; espaço pula). */
  private entering = false
  private skipEntrance: (() => void) | undefined
  /** Abertura normal da câmera (a comemoração usa a das câmeras do jogo). */
  private readonly baseFov: number
  private readonly cameraPaths = new Map<CharacterModel, Promise<CameraPath | undefined>>()
  /** A bola entrou: a luz da cova some. */
  private cupHidden = false
  private readonly keys = new Set<string>()
  private readonly cleanups: (() => void)[] = []
  private readonly bar: PowerBar
  private readonly windBox: HTMLElement
  private beamMaterial!: MeshBasicMaterial
  private beam!: Group
  /** Câmera livre no voo: giro (A/D) e vista de cima (S), até a bola quase cair. */
  private flightYaw = 0
  private flightTop = false
  /** Câmera parada pelo __debugCup (testes). */
  private debugFreeze = false
  private wind: Wind = { speed: 0, degree: 0 }

  private players: ViewPlayer[] = []
  private active: ViewPlayer | undefined
  private controllable = false
  private phase: 'aim' | 'flying' | 'idle' = 'idle'
  private aim = 0
  private shotForward = aimDirection(0)
  private targetDirty = true
  private readyAt = 0
  /** Quando começou o toque de mira atual (segurando, gira sozinha depois de um tempo). */
  private turnStart = 0
  /**
   * Pontos de queda exatos (cena), calculados com a mira `aim`: `ring` com a força atual (anel
   * amarelo) e `full` a 100% (o X da vista aérea). Enquanto a mira gira, eles giram junto em
   * volta da bola e o cálculo exato (caro) é refeito a cada `LANDING_REFRESH` s.
   */
  private landing: { aim: number; at: number; ring: Vector3; full: Vector3 } | undefined
  /**
   * Vista aérea (M ou 0), olhando a linha da mira de cima: `along` = quanto o centro está à
   * frente da bola na linha (↑/↓), `height` = altura (Shift+↑/↓). `follow`: o centro fica no X
   * (Delete+0) até a câmera ser movida.
   */
  private aerial: { along: number; height: number; follow: boolean } | undefined
  /** Câmera aérea suavizada (molas): giro, quanto à frente na linha, altura e chão. */
  private aerialCam: { yaw: Smooth; along: Smooth; height: Smooth; ground: Smooth } | undefined
  /** Entrando na vista aérea: de onde a câmera saiu e quando (passagem suave). */
  private aerialFrom: { position: Vector3; look: Vector3; at: number } | undefined
  /** X desenhado (suavizado): ângulo em relação à mira e distância da bola. */
  private readonly shownX = { offset: new Smooth(0, 0.08), reach: new Smooth(0, 0.08) }
  /** Duração do quadro atual (s), para as suavizações contarem pelo tempo. */
  private frameDt = 1 / 60
  /** Quando ↑/↓ começaram a ser segurados (acelera andando pela linha). */
  private aerialMoveStart = 0
  private readonly drawings: HTMLDivElement
  /** Mostrador da mira (graus em relação ao pin), embaixo da rosa dos ventos. */
  private readonly aimBox: HTMLDivElement
  private aimText = ''
  /** Mira que a calculadora (G) achou, para este lugar da bola. */
  private calcAim: { aim: number; ball: Point } | undefined
  /** Ferramentas de desenvolvimento (tecla P: sempre PANGYA) — só no modo sozinho. */
  private readonly devTools: boolean
  private autoPangya = false
  private surfaceView = false
  private fogOn = true
  private flight:
    | {
        playerId: string
        frames: Float32Array
        start: number
        done: () => void
        events: ShotEvent[]
        /** Quantos eventos da linha do tempo já tocaram. */
        fired: number
        impact: number | undefined
        /** Taco e power shot da tacada (som e voz da batida). */
        club: string | undefined
        powerShot: PowerShot | undefined
        /** Quadro em que a bola toca o chão pela primeira vez. */
        landing: number
        /** Quadro mostrado agora e o ponto exato (fracionário) da reprodução. */
        index: number
        playhead: number
        /** Velocidade atual (1 = normal; menos perto da cova, NEAR_CUP_SLOW). */
        slow: number
        /** A bola entra na cova nesta tacada. */
        holed: boolean
        /** Putt (câmera baixa e perto, sem câmera de queda). */
        putt: boolean
        /** Saiu do tee e a força da barra (0..1), para o som do swing. */
        tee: boolean
        percent: number | undefined
        /** Onde a bola estava (cena) e o ponto da primeira queda. */
        from: Vector3
        landingAt: Vector3
        /** A bola vai entrar ou parar pertinho da cova (câmera da queda na cova). */
        endsAtCup: boolean
        /** Câmera sorteada para o voo e a parte da câmera mostrada agora (troca = corte). */
        mode: ShotCameraMode
        stage: string
      }
    | undefined
  readonly sounds: SoundLibrary
  private readonly characters = new Map<string, Promise<CharacterModel | undefined>>()
  private readonly ready = new Map<string, CharacterModel>()
  /** Taco sendo preparado por personagem (evita repetir a cada mudança do painel). */
  private readonly addressing = new Map<CharacterModel, string>()
  /** Movimento escolhido com a tecla N (depuração). */
  private motionIndex = -1
  /** O backswing já começou com a barra (a tacada continua do topo). */
  private backswing = false
  /** O som do 3º toque já tocou (na barra deste jogador); a batida não repete. */
  private timingPlayed = false
  private walking = false

  /** Chamado quando o jogador da vez bate (espaço ou botão). */
  onShoot: (request: ShotRequest) => void = () => {}

  private constructor(
    world: HoleWorld,
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
    scene: Scene,
    course: CourseScene,
    status: HTMLElement,
    options: { lockWind: boolean; title: string; devTools: boolean },
  ) {
    this.world = world
    this.devTools = options.devTools
    // Sons da página: a pasta do curso para os sons dos pisos e a música do curso.
    this.sounds = sound
    const { round, prefix } = world.data.ref
    sound.round = round
    void sound.music(courseMusicEvent(round, prefix, courseName({ round, prefix })))
    // Som ambiente do buraco (o mar no Blue Lagoon) e os bichos do cenário (gaivotas).
    void sound.startAmbient(
      world.data.ambient,
      world.data.npcs.map((n) => n.model),
    )
    this.renderer = renderer
    this.camera = camera
    this.baseFov = camera.fov
    this.scene = scene
    this.course = course
    this.status = status
    this.elements.push(renderer.domElement, status)

    const data = world.data
    // Luzes só para os materiais de depuração (mapa de pisos, modelos sem textura).
    scene.add(new AmbientLight(0xffffff, 0.75))
    const sun = new DirectionalLight(0xffffff, 1.1)
    sun.position.set(300, 800, 200)
    scene.add(sun)

    // Tecla C: caixas de colisão dos objetos (depuração).
    const edges = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]
    this.boxLines = new LineSegments(
      new BufferGeometry().setAttribute(
        'position',
        new Float32BufferAttribute(
          data.obstacles.flatMap((b) =>
            edges.flatMap((i) => {
              const [x, y, z] = b.corners[i]!
              return toScene(x, y, z).toArray()
            }),
          ),
          3,
        ),
      ),
      new LineBasicMaterial({ color: 0xff4081 }),
    )
    this.boxLines.visible = false
    scene.add(this.boxLines)

    // Cova (disco escuro com borda, deitado na inclinação do green) e a luz que puxa a bola.
    const cupHit = world.grid.groundAt(world.cup.x, world.cup.z)
    const [nx, ny, nz] = cupHit ? world.grid.normalOf(cupHit.triangle) : [0, 1, 0]
    scene.add(
      cupHole(new Vector3(nx, ny, -nz).normalize(), toScene(world.cup.x, world.cup.y, world.cup.z)),
    )
    const beam = cupBeam()
    beam.group.position.copy(toScene(world.cup.x, world.cup.y, world.cup.z))
    beam.group.name = 'luz-da-cova'
    scene.add(beam.group)
    this.beamMaterial = beam.material
    this.beam = beam.group

    this.greenGrid = buildGreenGrid(
      world.grid,
      (t) => data.collision.surfaces[t]?.kind === 'green',
      { x: world.cup.x, z: world.cup.z },
    )
    this.greenGrid.visible = false
    scene.add(this.greenGrid)

    this.trailPositions = new Float32BufferAttribute(new Float32Array(MAX_TRAIL * 3), 3)
    this.trailGeometry.setAttribute('position', this.trailPositions)
    this.trailGeometry.setDrawRange(0, 0)
    const trail = new Line(this.trailGeometry, new LineBasicMaterial({ color: 0xffeb3b }))
    trail.frustumCulled = false
    scene.add(trail)
    scene.add(this.pangs.root)
    scene.add(this.effects.root)
    for (const name of Object.values(EFFECTS)) this.effects.preload(name)
    this.flashBox.className = 'effect-flash'
    document.body.appendChild(this.flashBox)
    this.elements.push(this.flashBox)
    document.body.appendChild(this.impactText.element)
    this.elements.push(this.impactText.element)
    this.impactText.preload()
    this.pangs.groundAt = (x, z) => this.world.grid.groundAt(x, -z)?.y
    this.pangs.onLand = () => void this.sounds.play('pangDrop')
    void this.pangs.preload()

    // Anel onde a tacada cai (força, spin e curva atuais, sem vento), como no jogo.
    this.target = new Mesh(
      new RingGeometry(2.2, 3.4, 32),
      new MeshBasicMaterial({ color: 0xffeb3b, side: DoubleSide, depthTest: false, fog: false }),
    )
    this.target.rotation.x = -Math.PI / 2
    this.target.renderOrder = 3
    scene.add(this.target)

    this.hud = document.createElement('div')
    this.hud.className = 'hud'
    document.body.appendChild(this.hud)
    this.elements.push(this.hud)

    this.panel = createShotHud(() => this.shoot())
    this.cleanups.push(() => this.panel.dispose())
    this.bar = this.panel.bar
    this.hud.dataset.title = options.title
    this.windBox = document.createElement('div')
    this.windBox.className = 'wind'
    this.aimBox = document.createElement('div')
    this.aimBox.className = 'aim-readout'
    this.aimBox.hidden = true
    document.body.appendChild(this.aimBox)
    this.elements.push(this.aimBox)
    this.drawings = document.createElement('div')
    this.drawings.className = 'course-overlay-box'
    this.drawings.innerHTML = COURSE_OVERLAY
    document.body.appendChild(this.drawings)
    this.elements.push(this.drawings)
    if (this.devTools) {
      this.setAutoPangya(readAutoPangya(), false)
      // Calibrador da régua: o 2º espaço usa a força dele.
      this.bar.setSnapToMark(true)
    }
    this.windBox.innerHTML = WIND_DIAL
    // Embaixo à direita, ao lado da barra (dentro do HUD da tacada).
    this.panel.windSlot.appendChild(this.windBox)
    this.elements.push(this.windBox)
    this.panel.onChange(() => {
      this.targetDirty = true
      const model = this.active && this.ready.get(this.active.id)
      if (model?.root.visible && this.phase === 'aim' && !this.bar.active) void this.address(model)
    })

    this.listen(window, 'keydown', (e) => {
      const key = (e as KeyboardEvent).code
      if (key === 'KeyM' || key === 'Digit0' || key === 'Numpad0') {
        // Delete + 0: vista aérea já aproximada onde a tacada cai (força máxima).
        this.toggleAerial(this.keys.has('Delete') && key !== 'KeyM')
      }
      if (key === 'Delete') this.keys.add(key)
      if (key === 'KeyT') this.course.setSurfaceView((this.surfaceView = !this.surfaceView))
      if (key === 'KeyF') this.course.setFog((this.fogOn = !this.fogOn) && !this.aerial)
      if (key === 'KeyC') this.boxLines.visible = !this.boxLines.visible
      if (key === 'KeyN') this.cycleMotion()
      if (key === 'KeyV') {
        this.panel.showResult(
          this.sounds.toggleMute() ? '🔇 som desligado (V)' : '🔊 som ligado (V)',
        )
      }
      if (key === 'KeyP' && this.devTools && !(e as KeyboardEvent).repeat) {
        this.setAutoPangya(!this.autoPangya)
      }
      if (key === 'KeyG' && this.devTools && !(e as KeyboardEvent).repeat) this.runCalculator()
      if (key === 'KeyS' && this.flight && this.freeFlightCamera()) this.flightTop = !this.flightTop
      // Vista aérea: ↑/↓ andam pela linha da mira, Shift+↑/↓ = zoom (segurando, suave).
      if (['ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight'].includes(key)) {
        if (key.startsWith('Arrow')) e.preventDefault()
        if (key.startsWith('Arrow') && !(e as KeyboardEvent).repeat) {
          this.aerialMoveStart = performance.now()
        }
        this.keys.add(key)
      }
      // Mira: um toque = passo fino; segurando, gira sozinha cada vez mais rápido.
      const turn = AIM_KEYS[key]
      if (turn) {
        e.preventDefault()
        this.keys.add(key)
        if (!(e as KeyboardEvent).repeat) this.nudgeAim(turn)
      }
    })
    // O mouse nunca move a câmera (como no jogo). A roda sempre troca o taco — também na
    // vista aérea, onde o X vai para onde o novo taco alcança.
    const canvas = renderer.domElement
    this.listen(canvas, 'contextmenu', (e) => e.preventDefault())
    this.listen(canvas, 'wheel', (e) => {
      e.preventDefault()
      if (this.phase === 'aim' && this.controllable) {
        const before = this.panel.read().club
        this.panel.cycleClub((e as WheelEvent).deltaY > 0 ? 1 : -1)
        if (this.panel.read().club !== before) void this.sounds.play('clubChange')
      }
    })
    this.listen(window, 'keyup', (e) => this.keys.delete((e as KeyboardEvent).code))
    // Janela perdeu o foco com tecla apertada: solta tudo (senão a mira gira sozinha).
    this.listen(window, 'blur', () => this.keys.clear())
    this.listen(window, 'resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    })
    this.listen(renderer.domElement, 'webglcontextlost', (e) => {
      e.preventDefault()
      this.showError('A placa de vídeo perdeu o contexto WebGL. Recarregue a página.')
    })

    let last = performance.now()
    renderer.setAnimationLoop((now) => {
      try {
        this.frame(now, Math.min(0.1, (now - last) / 1000))
        last = now
      } catch (err) {
        renderer.setAnimationLoop(null)
        this.showError(
          `Erro ao desenhar: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
        )
      }
    })

    // Depuração (testes automatizados): câmera perto da cova para ver a luz.
    ;(window as unknown as { __debugCup: (near?: boolean) => void }).__debugCup = (near) => {
      const at = toScene(world.cup.x, world.cup.y, world.cup.z)
      this.aerial = undefined
      this.phase = 'idle'
      camera.position.copy(at).add(near ? new Vector3(0.7, 2.4, 0.7) : new Vector3(14, 7, 14))
      camera.lookAt(at.clone().add(new Vector3(0, near ? -0.2 : 4, 0)))
      this.debugFreeze = true
    }
    // Depuração: bola rolando `yards` jardas até cair na cova (padrão 1: vista de perto).
    ;(window as unknown as { __debugDrop: (yards?: number) => void }).__debugDrop = (yards = 1) => {
      if (!this.active) return
      const cup = world.cup
      const k = yardsToUnits(yards) / Math.hypot(3, 1)
      const from = { x: cup.x + 3 * k, y: cup.y, z: cup.z + 1 * k }
      const length = Math.max(30, Math.round(yards * 12))
      const roll = Array.from({ length }, (_, i) => {
        const f = i / length
        const x = from.x + (cup.x + 0.3 - from.x) * f
        const z = from.z + (cup.z + 0.1 - from.z) * f
        return [x, world.grid.groundAt(x, z)?.y ?? cup.y, z]
      }).flat()
      const frames = Float32Array.from([
        ...roll,
        ...dropIntoCup({ x: cup.x + 0.3, y: cup.y, z: cup.z + 0.1 }, cup, 4, {
          x: roll[roll.length - 3]!,
          y: roll[roll.length - 2]!,
          z: roll[roll.length - 1]!,
        }),
      ])
      void this.animateShot(this.active.id, frames, {})
    }
    // Depuração: toca um efeito do jogo (.seq) na bola da vez.
    // (`lift`: acima da bola; `speed`: velocidade do tempo dos efeitos, < 1 = câmera lenta.)
    ;(
      window as unknown as {
        __debugEffect: (name: string, lift?: number, speed?: number) => Promise<boolean>
      }
    ).__debugEffect = (name, lift = 0, speed = 1) => {
      this.effects.timeScale = speed
      return this.effects.play(name, this.ballPosition().add(new Vector3(0, lift, 0)))
    }
    ;(window as unknown as { __debugScene: Scene }).__debugScene = scene
    ;(window as unknown as { __debug: () => unknown }).__debug = () => ({
      camera: camera.position.toArray().map((v) => Math.round(v)),
      cameraExact: camera.position.toArray(),
      phase: this.phase,
      entering: this.entering,
      aim: this.aim,
      active: this.active?.id,
      motion: this.active && this.ready.get(this.active.id)?.playing,
      players: this.players.map((p) => ({ id: p.id, state: p.state })),
      balls: [...this.balls].map(([id, e]) => ({
        id,
        visible: e.ball.visible,
        at: e.ball.position.toArray().map((v) => Math.round(v * 100) / 100),
      })),
      cup: toScene(world.cup.x, world.cup.y, world.cup.z).toArray(),
    })
  }

  private listen(target: EventTarget, type: string, handler: (e: Event) => void) {
    target.addEventListener(type, handler)
    this.cleanups.push(() => target.removeEventListener(type, handler))
  }

  /**
   * Carrega o buraco e monta a cena (com progresso no canto da tela). `lockWind`: vento vem
   * do servidor (sala). `devTools`: atalhos de desenvolvimento (P = sempre PANGYA) — só no
   * modo sozinho, para não valer na sala com os amigos.
   */
  static async create(
    ref: HoleRef,
    options: { lockWind?: boolean; devTools?: boolean } = {},
  ): Promise<HoleView> {
    // Tacos da mão já pedidos agora: depois, ficariam na fila atrás dos arquivos do curso.
    for (const category of ['wood', 'iron', 'wedge', 'putter'] as const) void clubModelFor(category)
    const status = document.createElement('div')
    status.className = 'hole-status'
    status.textContent = 'Carregando buraco…'
    document.body.appendChild(status)
    try {
      const renderer = new WebGLRenderer({ antialias: true, stencil: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(window.innerWidth, window.innerHeight)
      document.body.appendChild(renderer.domElement)
      const camera = new PerspectiveCamera(
        55,
        window.innerWidth / window.innerHeight,
        1,
        SKY_RADIUS * 2.4,
      )
      const data = await loadHoleData(browserFiles, ref)
      const world = new HoleWorld(data)
      const scene = new Scene()
      const textures = new TextureLibrary(ref.round, renderer.capabilities.getMaxAnisotropy())
      const course = await buildCourseScene(data, scene, textures, (done, total) => {
        status.textContent = `Carregando texturas… ${done}/${total}`
      })
      const view = new HoleView(world, renderer, camera, scene, course, status, {
        lockWind: options.lockWind ?? false,
        devTools: options.devTools ?? false,
        title: `${ref.prefix} — buraco ${ref.hole}`,
      })
      status.textContent =
        `${world.grid.triangleCount} triângulos · ${data.objects.length} modelos` +
        (data.missingModels.length ? ` (${data.missingModels.length} faltando)` : '') +
        ` · ${course.texturesLoaded} texturas` +
        (course.texturesMissing.length ? ` (${course.texturesMissing.length} faltando)` : '') +
        ` · ${world.obstacles.size} caixas de colisão (${data.obstacleSource})` +
        ' · A/D mirar (toque = passo fino) · roda: taco · Alt: power shot (2× = 2 PS)' +
        ' · espaço: barra (3 toques) · clique na bola do mostrador: spin/curva' +
        ' · M ou 0: vista aérea (↑/↓ anda na linha, Shift+↑/↓ zoom, espaço volta;' +
        ' Delete+0: no X) · calibrador: clique na barra, Z desce, X sobe' +
        (options.devTools
          ? ' (o 2º espaço usa a força dele) · P: sempre PANGYA · G: calculadora (mira e força para cair na cova)'
          : '') +
        ' · no voo: A/D gira, S de cima · T pisos · F névoa · C colisão'
      if (course.texturesMissing.length) {
        console.info('texturas não encontradas:', course.texturesMissing)
      }
      return view
    } catch (err) {
      status.classList.add('error')
      status.textContent = `Não foi possível abrir o buraco:\n${err instanceof Error ? err.message : String(err)}`
      throw err
    }
  }

  showError(message: string) {
    this.status.classList.add('error')
    this.status.textContent = message
  }

  setWind(wind: Wind) {
    this.wind = wind
    this.updateWind()
  }

  /** Seta do vento relativa à mira (para cima = a favor da tacada). */
  private updateWind() {
    const wind = this.wind
    const relative = wind.degree - (this.aim * 180) / Math.PI
    const arrow = this.windBox.querySelector('.arrow') as SVGElement
    arrow.style.transform = `rotate(${-relative}deg)`
    ;(this.windBox.querySelector('.speed') as HTMLElement).textContent = `${wind.speed}m`
  }

  /** Linha extra no HUD (placar, mensagens). */
  hudExtra = ''

  private ballOf(player: ViewPlayer, withTag: boolean) {
    let entry = this.balls.get(player.id)
    if (!entry) {
      const ball = new Mesh(
        new SphereGeometry(BALL_RADIUS, 20, 10),
        new MeshLambertMaterial({
          color: player.color,
          emissive: player.color,
          emissiveIntensity: 0.3,
        }),
      )
      // Depois da cova (que reescreve a profundidade na boca dela): a bola aparece lá dentro.
      ball.renderOrder = CUP_ORDER + 3
      const tag = withTag ? nameTag(player.name, player.color) : undefined
      if (tag) this.scene.add(tag)
      this.scene.add(ball)
      entry = { ball, tag }
      this.balls.set(player.id, entry)
      if (player.ball) void this.dressBall(ball, player.ball)
    }
    return entry
  }

  /**
   * A bola do jogo (data/ball/<modelo>.pet) no lugar da esfera: o modelo vira filho dela, no
   * tamanho da bola da física (o do jogo tem raio ~0,156), e a esfera fica invisível.
   */
  private async dressBall(ball: Mesh, model: string) {
    const object = await loadPetObject(`${model}.pet`, { center: true })
    if (!object) return
    const size = new Box3().setFromObject(object).getSize(new Vector3())
    object.scale.setScalar((BALL_RADIUS * 2) / Math.max(size.x, size.y, size.z, 0.01))
    object.traverse((o) => (o.renderOrder = ball.renderOrder))
    ;(ball.material as MeshLambertMaterial).visible = false
    ball.add(object)
  }

  private placeBall(id: string, position: Vector3) {
    const entry = this.balls.get(id)
    if (!entry) return
    entry.ball.position.copy(position)
    entry.tag?.position.copy(position).add(new Vector3(0, 9, 0))
  }

  /**
   * Estado novo dos jogadores. `activeId` é quem joga agora; `controllable` diz se é este
   * navegador que controla a tacada (mira, painel e espaço).
   */
  setPlayers(players: ViewPlayer[], activeId: string | undefined, controllable: boolean) {
    const many = players.length > 1
    this.players = players
    for (const p of players) {
      const { ball, tag } = this.ballOf(p, many)
      // Quem já embocou some do green.
      ball.visible = !(p.state.finished && p.state.result === 'holed')
      if (tag) tag.visible = ball.visible
      this.placeBall(p.id, toScene(p.state.ball.x, p.state.ball.y + BALL_RADIUS, p.state.ball.z))
    }
    const changedTurn = this.active?.id !== activeId || this.phase !== 'aim'
    this.active = players.find((p) => p.id === activeId)
    this.controllable = controllable && !!this.active
    if (!this.active) {
      this.phase = 'idle'
      // Na comemoração, o personagem fica.
      if (!this.cinematic) for (const model of this.ready.values()) model.root.visible = false
      this.panel.setEnabled(false, 'Fim do buraco')
      this.bar.setPinDistance(undefined)
      this.target.visible = false
      this.greenGrid.visible = false
      this.updateHud()
      return
    }
    this.phase = 'aim'
    this.readyAt = performance.now()
    this.cameraHold = false
    this.endCinematic()
    this.cupHidden = false
    const state = this.active.state
    this.showCharacter(this.active)
    if (changedTurn) {
      this.bar.cancel()
      this.backswing = false
      this.aim = this.world.aimAtPin(state.ball)
      this.panel.resetShot()
      if (this.controllable) {
        const { club, percent } = this.world.suggestClub(state)
        this.panel.setClub(club)
        this.panel.setPercent(percent)
      }
      this.panel.setPower(this.active.power ?? DEFAULT_POWER)
      this.panel.setBall(this.active.ball)
      this.trailGeometry.setDrawRange(0, 0)
    }
    this.panel.setEnabled(this.controllable, this.controllable ? '' : `Vez de ${this.active.name}…`)
    this.greenGrid.visible = this.world.lieKind(state) === 'green'
    this.targetDirty = true
    this.placeCamera(this.ballPosition(), 1)
    this.updateHud()
  }

  /** Carrega (uma vez) o personagem do jogador. */
  private characterOf(player: ViewPlayer): Promise<CharacterModel | undefined> {
    let model = this.characters.get(player.id)
    if (!model) {
      model = loadCatalog()
        .then((list) => list.find((c) => c.id === player.character))
        .then((entry: CharacterEntry | undefined) =>
          entry ? CharacterModel.load(entry) : undefined,
        )
        .then(async (m) => {
          if (m) {
            // Já com o taco na mão: senão ele aparece de mãos vazias até o taco baixar.
            await this.equipClub(m).catch(() => undefined)
            m.onEvent = (command, model) => this.frameCommand(command, model)
            this.ready.set(player.id, m)
            m.root.visible = false
            this.scene.add(m.root)
            this.idle(m)
          }
          return m
        })
        .catch((err: unknown) => {
          console.warn('personagem:', err)
          return undefined
        })
      this.characters.set(player.id, model)
    }
    return model
  }

  /**
   * Evento de um quadro da animação do personagem (FRAM do .apet): sons (*snd), passos
   * (*stepsnd, pelo piso), efeitos (*fx num osso; os que dependem de item, "&…"/"#…", não)
   * e o taco escondido/mostrado.
   */
  private frameCommand(command: FrameCommand, model: CharacterModel) {
    if (!model.root.visible) return
    const [first = ''] = command.args
    switch (command.name) {
      case 'snd':
        // O som do power shot já toca com a batida.
        if (first && !/^powershot/i.test(first)) void this.sounds.playFile(first, 0.8)
        break
      case 'stepsnd': {
        const at = model.root.position
        const kind = this.world.surfaceAt(at.x, -at.z)?.kind ?? ''
        void this.sounds.playFile(/bunker|sand/i.test(kind) ? '발자국_sand' : '발자국_green', 0.6)
        break
      }
      case 'fx': {
        if (command.args.some((a) => /^[&#]/.test(a))) break
        const file = command.args.find((a) => /\.(spr|seq)$/i.test(a))
        if (!file) break
        for (const bone of command.args.filter((a) => a !== file && !a.startsWith('@'))) {
          const at = model.bonePosition(bone)
          if (at) void this.effects.play(file, at)
        }
        break
      }
      case 'hideclub':
        model.clubByEvent(false)
        break
      case 'showclub':
        model.clubByEvent(true)
        break
    }
  }

  /** Mostra só o personagem de quem joga, ao lado da bola, virado para ela. */
  private showCharacter(player: ViewPlayer) {
    for (const [id, model] of this.ready) model.root.visible = id === player.id
    if (!player.character) return
    void this.characterOf(player).then((model) => {
      if (!model || this.active?.id !== player.id) return
      model.root.visible = true
      this.placeCharacter(model)
      void this.address(model)
    })
  }

  /** Taco na mão e postura de preparação, com a cabeça do taco encostada na bola. */
  private async address(model: CharacterModel, club: string = this.panel.read().club) {
    const category = categoryOfClub(club)
    if (this.addressing.get(model) === category) return
    this.addressing.set(model, category)
    await this.equipClub(model, club)
    if (this.addressing.get(model) !== category) return // trocou de taco enquanto carregava
    model.address(this.golf(model, club).idle)
    this.addressing.delete(model)
    if (model.root.visible && this.phase === 'aim' && !this.bar.active) this.placeCharacter(model)
  }

  /** Movimentos de golfe do personagem para o taco (o do painel, se não informado). */
  private golf(model: CharacterModel, club: string = this.panel.read().club) {
    return golfMotions(model.motions, categoryOfClub(club))
  }

  /** Postura de preparação para o taco atual. */
  private idle(model: CharacterModel) {
    const name = this.golf(model).idle
    if (name && model.requested !== name) model.play(name)
  }

  /** Pose de reação (comemoração/decepção) do personagem; devolve a duração (s). */
  react(playerId: string, reaction: Reaction): number {
    const model = this.ready.get(playerId)
    if (!model?.root.visible) return 0
    return model.play(reactionMotion(model.motions, reaction), false, 0.2)
  }

  private placeCharacter(model: CharacterModel) {
    const ball = this.ballPosition()
    const forward = aimDirection(this.aim)
    // Destro: de frente para a bola, com o alvo à esquerda.
    const right = new Vector3(-forward.z, 0, forward.x)
    placeAtBall(
      model,
      ball,
      right,
      (at) => this.world.grid.groundAt(at.x, -at.z)?.y ?? ball.y - BALL_RADIUS,
      ball.y - BALL_RADIUS,
    )
  }

  /** Põe na mão o taco escolhido no painel (modelo da tabela de tacos do jogo). */
  private equipClub(model: CharacterModel, club: string = this.panel.read().club) {
    return clubModelFor(categoryOfClub(club)).then((path) => model.setClub(path))
  }

  /** Tecla N: percorre os movimentos do personagem da vez (para mapear os nomes). */
  private cycleMotion() {
    const model = this.active && this.ready.get(this.active.id)
    if (!model || model.motionNames.length === 0) {
      this.panel.showResult('Sem personagem/animações carregados.')
      return
    }
    this.motionIndex = (this.motionIndex + 1) % model.motionNames.length
    const name = model.motionNames[this.motionIndex]!
    model.play(name)
    this.panel.showResult(`Movimento ${this.motionIndex + 1}/${model.motionNames.length}: ${name}`)
  }

  /**
   * Tacada do personagem: continua do topo do backswing (se a barra o começou) ou faz o
   * swing inteiro. Devolve quanto falta (s) até o taco acertar a bola.
   */
  private startSwing(playerId: string, club: string | undefined, powerShot?: PowerShot): number {
    const fromTop = this.backswing
    this.backswing = false
    const model = this.ready.get(playerId)
    if (!model || !model.root.visible) return 0
    if (club) void this.equipClub(model, club)
    // 2º power shot de madeira: o swing especial do personagem (우드샷파워2) com a câmera
    // animada do jogo (uma das 4 versões de 우드파워샷2), até a bola sair.
    if (powerShot === 'two' && club && categoryOfClub(club) === 'wood') {
      const duration = model.play(POWER_SHOT_TWO.motion, false, 0.1)
      if (duration > 0) {
        void this.cameraPathOf(model).then((path) => {
          const segment = path?.segment(POWER_SHOT_TWO.camera)
          if (path && segment && this.flight && this.flight.index === 0) {
            this.startCinematic({ path, segment, model, started: performance.now() })
          }
        })
        // Quadro do impacto do próprio jogo (*shot), senão a estimativa.
        const shot = model.motions.find((m) => m.name === POWER_SHOT_TWO.motion)?.shot
        return shot !== undefined ? shot / 30 : duration * POWER_SHOT_TWO.impact
      }
    }
    const motions = this.golf(model, club)
    if (!motions.swing) return 0
    const from = fromTop ? motions.top : 0
    model.play(motions.swing, false, fromTop ? 0.05 : 0.15, from)
    return Math.max(0, motions.impact - from)
  }

  private ballPosition() {
    const id = this.flight?.playerId ?? this.active?.id
    return (id && this.balls.get(id)?.ball.position.clone()) || new Vector3()
  }

  /** Pedido de tacada com os valores do painel e a mira atual. */
  request(): ShotRequest {
    const input = this.panel.read()
    return {
      club: input.club,
      percent: input.percent,
      shot: input.shot,
      powerShot: input.powerShot,
      spin: input.spin,
      curve: input.curve,
      aim: this.aim,
      power: this.active?.power ?? DEFAULT_POWER,
    }
  }

  /** Espaço/botão: barra de força (3 toques), tacada direta ou pula a animação. */
  private shoot() {
    if (this.entering) {
      // Pulou antes de a entrada começar: nem começa.
      if (this.skipEntrance) this.skipEntrance()
      else this.entering = false
      return
    }
    if (this.flight) {
      this.flight.start = -Infinity
      return
    }
    // Espaço apertado para pular a animação logo quando ela acaba não vira nova tacada.
    if (this.phase !== 'aim' || !this.controllable || performance.now() - this.readyAt < 600) {
      return
    }
    // Na vista aérea, o espaço só volta para a câmera normal; o próximo começa a barra.
    if (this.aerial && !this.bar.active) {
      this.toggleAerial()
      return
    }
    if (this.bar.active) {
      this.bar.press()
      return
    }
    void this.sounds.play('bar')
    const model = this.active && this.ready.get(this.active.id)
    const backswing = model?.root.visible ? this.golf(model).backswing : undefined
    if (model && backswing) {
      model.play(backswing, false, 0.15)
      this.backswing = true
    }
    this.bar.start(
      ({ percent, impact }) => {
        this.panel.setPercent(percent)
        this.timingSound(this.panel.read().club, impact)
        this.fire({ ...this.request(), percent, impact })
      },
      {
        // 2º toque: força marcada (na força máxima do taco, o som do PANGYA).
        onPower: (power) => void this.sounds.play(power >= 0.999 ? 'powerMax' : 'powerSet'),
        // Deixou passar da zona: desistiu de bater agora; volta a mirar.
        onCancel: () => {
          this.backswing = false
          if (model?.root.visible) this.idle(model)
          this.readyAt = performance.now()
        },
      },
    )
  }

  /**
   * Escala da barra (alcance do taco a 100%). A distância do pin vai só para o calibrador
   * começar nela (na tela ela fica no marcador do pin).
   */
  private updateBarScale() {
    if (!this.active) return
    const state = this.active.state
    this.bar.setScale(this.world.shotRange(state, this.request()))
    this.bar.setPinDistance(this.world.distanceToPin(state.ball))
  }

  /**
   * Liga/desliga a vista aérea, olhando de cima a linha da mira (a bola embaixo, o X em
   * cima, como no original). M/0: a linha inteira e o pin; Delete+0: já perto do X (ou, se o
   * X passa do buraco, na distância do buraco — ver `followAlong`).
   */
  private toggleAerial(onTarget = false) {
    if (this.aerial && !onTarget) {
      this.aerial = undefined
      this.aerialCam = undefined
      this.aerialFrom = undefined
      this.course.setFog(this.fogOn)
      return
    }
    if (!this.active) return
    this.refreshLanding()
    const reach = this.landingReach()
    if (onTarget) {
      this.aerial = { along: this.followAlong(), height: 90, follow: true }
    } else {
      const ball = this.active.state.ball
      const pin = Math.hypot(this.world.cup.x - ball.x, this.world.cup.z - ball.z)
      const span = Math.max(reach, pin, 30)
      // A linha inteira e o pin, entre o HUD de cima e o de baixo.
      this.aerial = {
        along: span * 0.5,
        height: Math.min(AERIAL.maxHeight, Math.max(AERIAL.minHeight, span * 1.6 + 60)),
        follow: false,
      }
    }
    if (this.aerialCam) return // Delete+0 com a vista aérea já aberta: só muda o alvo
    // De cima, sem névoa (nítido como no original; de tão alto, a névoa apagava o campo).
    this.course.setFog(false)
    // Molas começando no lugar certo; a passagem da câmera normal para cá é suave (0,45 s).
    const ball = this.restingBall()!
    const ground = this.world.grid.groundAt(ball.x, -ball.z)?.y ?? ball.y
    this.aerialCam = {
      yaw: new Smooth(this.aim, 0.15),
      along: new Smooth(this.aerial.along, 0.2),
      height: new Smooth(this.aerial.height, 0.2),
      ground: new Smooth(ground, 0.35),
    }
    const look = new Vector3()
    this.camera.getWorldDirection(look)
    this.aerialFrom = {
      position: this.camera.position.clone(),
      look: this.camera.position.clone().addScaledVector(look, 40),
      at: performance.now(),
    }
  }

  /** Bola do jogador da vez, parada (cena). */
  private restingBall(): Vector3 | undefined {
    const ball = this.active?.state.ball
    return ball && toScene(ball.x, ball.y, ball.z)
  }

  /** Ponto de queda (`ring`: força atual; `full`: 100%), girado para a mira `aim`. */
  private landingPoint(which: 'ring' | 'full', aim = this.aim): Vector3 | undefined {
    const ball = this.restingBall()
    if (!this.landing || !ball) return undefined
    const point = this.landing[which].clone().sub(ball)
    return point.applyAxisAngle(UP, aim - this.landing.aim).add(ball)
  }

  /**
   * Mira desenhada: na vista aérea, o giro suavizado da câmera — a linha, o X e o anel giram
   * junto com a câmera (sem pular na frente dela a cada toque de mira).
   */
  private shownAim() {
    return this.aerialCam?.yaw.value ?? this.aim
  }

  /**
   * Onde o Delete+0 fica (distância na linha da mira): no X; mas se o X passa do buraco, na
   * linha da mira na distância do buraco (o buraco projetado na linha), como no original.
   */
  private followAlong() {
    const reach = this.landingReach()
    const ball = this.active?.state.ball
    if (!ball) return reach
    const { cup } = this.world
    const hole = -Math.sin(this.aim) * (cup.x - ball.x) + Math.cos(this.aim) * (cup.z - ball.z)
    return hole > 0 && reach > hole ? hole : reach
  }

  /** Distância (unidades, no plano) da bola até o X (100%). */
  private landingReach() {
    const ball = this.restingBall()
    const full = this.landingPoint('full')
    return ball && full ? Math.hypot(full.x - ball.x, full.z - ball.z) : 0
  }

  /**
   * X desenhado: o ponto de queda a 100% visto da bola (ângulo em relação à mira e distância),
   * suavizado para os recálculos da física não darem pulo na tela.
   */
  private shownFull(): Vector3 | undefined {
    const ball = this.restingBall()
    const full = this.landingPoint('full')
    if (!ball || !full) return undefined
    const dx = full.x - ball.x
    const dz = full.z - ball.z
    let offset = Math.atan2(-dx, -dz) - this.aim
    offset = Math.atan2(Math.sin(offset), Math.cos(offset))
    const reach = Math.hypot(dx, dz)
    const { shownX } = this
    if (this.frameDt <= 0 || Math.abs(shownX.reach.value - reach) > yardsToUnits(40)) {
      shownX.offset.snap(offset)
      shownX.reach.snap(reach)
    }
    const angle = this.shownAim() + shownX.offset.update(offset, this.frameDt)
    const point = ball.addScaledVector(
      aimDirection(angle),
      shownX.reach.update(reach, this.frameDt),
    )
    point.y = this.world.grid.groundAt(point.x, -point.z)?.y ?? full.y
    return point
  }

  /** Recalcula os pontos de queda exatos (física) com a mira atual. */
  private refreshLanding() {
    if (!this.active) return
    const state = this.active.state
    const request = this.request()
    const ring = this.world.predictLanding(state, request)
    const full = this.world.predictLanding(state, { ...request, percent: 1 })
    this.landing = {
      aim: this.aim,
      at: performance.now(),
      ring: toScene(ring.x, ring.y, ring.z),
      full: toScene(full.x, full.y, full.z),
    }
  }

  /** Um toque de mira: passo fino (mais fino no green). Segurando, `frame` continua. */
  private nudgeAim(direction: 1 | -1) {
    if (this.phase !== 'aim' || !this.controllable || this.bar.active) return
    const step = this.greenGrid.visible ? AIM_TUNING.greenStep : AIM_TUNING.step
    this.aim += direction * step * DEG
    this.turnStart = performance.now()
    const model = this.active && this.ready.get(this.active.id)
    if (model?.root.visible) this.placeCharacter(model)
  }

  /** ↑/↓ e Shift+↑/↓ segurados na vista aérea: anda pela linha e zoom, suaves. */
  private moveAerial(dt: number, now: number) {
    const aerial = this.aerial
    if (!aerial) return
    const move = (this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('ArrowDown') ? 1 : 0)
    const shift = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
    if (move && shift) {
      aerial.height = Math.min(
        AERIAL.maxHeight,
        Math.max(AERIAL.minHeight, aerial.height * Math.exp(-move * AERIAL_ZOOM_RATE * dt)),
      )
    } else if (move) {
      aerial.follow = false
      const ball = this.active?.state.ball
      const pin = ball ? Math.hypot(this.world.cup.x - ball.x, this.world.cup.z - ball.z) : 0
      const limit = Math.max(this.landingReach(), pin) + yardsToUnits(60)
      const held = Math.min(1, (now - this.aerialMoveStart) / 1000 / AERIAL_PAN.rampSeconds)
      const speed = AERIAL_PAN.slow + (AERIAL_PAN.fast - AERIAL_PAN.slow) * held
      aerial.along = Math.min(
        limit,
        Math.max(-yardsToUnits(30), aerial.along + move * aerial.height * speed * dt),
      )
    }
    if (aerial.follow) aerial.along = this.followAlong()
  }

  /**
   * Desenhos por cima do jogo (ver COURSE_OVERLAY). A linha é recortada no plano da câmera:
   * mesmo com a bola atrás da câmera (zoom perto do X), o pedaço visível continua na tela.
   */
  private updateOverlay() {
    const camera = this.camera
    camera.updateMatrixWorld() // a posição deste quadro (senão o desenho fica um quadro atrás)
    const width = window.innerWidth
    const height = window.innerHeight
    const nearZ = -camera.near * 1.01
    const toView = (p: Vector3) => p.clone().applyMatrix4(camera.matrixWorldInverse)
    const toScreen = (v: Vector3) => {
      const n = v.clone().applyMatrix4(camera.projectionMatrix)
      return { x: ((n.x + 1) / 2) * width, y: ((1 - n.y) / 2) * height }
    }
    const point = (p: Vector3) => {
      const v = toView(p)
      return v.z < nearZ ? toScreen(v) : undefined
    }
    const $ = (selector: string) => this.drawings.querySelector(selector) as SVGElement
    const show = (el: SVGElement, on: boolean) => (el.style.display = on ? '' : 'none')
    const aiming = this.phase === 'aim' && !!this.active

    // Vista aérea: linha da bola até o X e a distância.
    const ball = this.restingBall()
    const full = this.aerial && aiming && this.controllable ? this.shownFull() : undefined
    const line = $('.aim-line')
    const mark = $('.x-mark')
    let segment: [{ x: number; y: number }, { x: number; y: number }] | undefined
    if (ball && full) {
      let a = toView(ball)
      let b = toView(full)
      if (a.z < nearZ || b.z < nearZ) {
        if (a.z >= nearZ) a = a.clone().lerp(b, (a.z - nearZ) / (a.z - b.z))
        if (b.z >= nearZ) b = b.clone().lerp(a, (b.z - nearZ) / (b.z - a.z))
        segment = [toScreen(a), toScreen(b)]
      }
    }
    show(line, !!segment)
    if (segment) {
      line.setAttribute('x1', String(segment[0].x))
      line.setAttribute('y1', String(segment[0].y))
      line.setAttribute('x2', String(segment[1].x))
      line.setAttribute('y2', String(segment[1].y))
    }
    const x = full && point(full)
    show(mark, !!x)
    if (x) {
      mark.setAttribute('transform', `translate(${x.x} ${x.y})`)
      $('.x-label').textContent = `${unitsToYards(this.landingReach()).toFixed(2)}y`
    }

    // Pin: no topo da luz da cova (câmera normal) ou na cova (vista aérea).
    const cup = this.world.cup
    const anchor = toScene(cup.x, cup.y + (this.aerial ? 0 : BEAM_HEIGHT), cup.z)
    const pin = aiming ? point(anchor) : undefined
    const pinMark = $('.pin-mark')
    show(pinMark, !!pin)
    if (pin) {
      pinMark.setAttribute('transform', `translate(${pin.x} ${pin.y})`)
      const state = this.active!.state
      const rise = unitsToMeters(cup.y - state.ball.y)
      $('.pin-height').textContent = `${rise.toFixed(2)} m`
      $('.pin-distance').textContent = `${this.world.distanceToPin(state.ball).toFixed(2)}y`
    }
  }

  /**
   * A luz da cova engrossa com a distância, para ter sempre uns 6 px na tela (de longe ela
   * some de tão fina). Na vista aérea some: lá o pin é o marcador desenhado.
   */
  private fitBeam() {
    // Some na vista aérea e depois que a bola entra.
    this.beam.visible = !this.aerial && !this.cupHidden
    if (!this.beam.visible) return
    const at = this.beam.position
    const distance = Math.hypot(this.camera.position.x - at.x, this.camera.position.z - at.z)
    const pixelsPerUnit =
      window.innerHeight / 2 / Math.tan((this.camera.fov * DEG) / 2) / Math.max(distance, 1)
    const scale = Math.max(1, BEAM_MIN_PIXELS / 2 / pixelsPerUnit / BEAM_RADIUS)
    this.beam.scale.set(scale, 1, scale)
  }

  /**
   * Tecla G (só sozinho): calculadora. Acha a mira e a força para a bola cair direto na cova
   * (tacada normal, impacto perfeito) com o vento e o desnível de agora, e já deixa tudo
   * pronto: mira, taco (se o escolhido não alcança), bola no centro e o calibrador na força
   * — com o sempre PANGYA (P), é só dar os 2 toques de espaço.
   */
  private runCalculator() {
    if (this.phase !== 'aim' || !this.controllable || !this.active || this.bar.active) return
    const state = this.active.state
    const current = this.panel.read()
    const result = solveShot(this.world, state, this.wind, {
      club: current.club,
      powerShot: current.powerShot,
      power: this.active.power ?? DEFAULT_POWER,
    })
    if ('reason' in result) {
      const clubName = result.club === 'PT1' ? 'PT' : result.club
      this.panel.showResult(
        result.reason === 'putter'
          ? '🧮 Calculadora: no green ainda não calcula (só tacadas no ar).'
          : result.reason === 'outOfReach'
            ? `🧮 Não alcança nem com o ${clubName}: faltam ${result.shortBy!.toFixed(1)}y (power shot?).`
            : result.reason === 'obstacle'
              ? `🧮 Obstáculo no caminho a ${result.obstacleAt!.toFixed(1)}y (C mostra as caixas).`
              : '🧮 Não achei uma tacada que caia na cova daqui.',
      )
      return
    }
    this.panel.setClub(result.club)
    this.panel.setImpact(0, 0)
    this.panel.setPercent(result.percent)
    this.bar.setCalibratorValue(result.percent)
    const pinAim = this.world.aimAtPin(state.ball)
    this.aim = result.aim
    this.calcAim = { aim: result.aim, ball: { ...state.ball } }
    this.aimText = '' // redesenha o mostrador com o alvo
    this.targetDirty = true
    const model = this.ready.get(this.active.id)
    if (model?.root.visible) void this.address(model)
    const offset = (result.aim - pinAim) / DEG
    const pin = this.world.distanceToPin(state.ball)
    const side =
      Math.abs(offset) < 0.005
        ? 'mira no pin'
        : `mira ${Math.abs(offset).toFixed(2)}° (${(pin * Math.tan(Math.abs(offset) * DEG)).toFixed(1)}y) à ${offset > 0 ? 'esquerda' : 'direita'} do pin`
    const yards = (result.percent * this.world.shotRange(state, this.request())).toFixed(1)
    const clubName = result.club === 'PT1' ? 'PT' : result.club
    this.panel.showResult(
      `🧮 ${clubName} · força ${(result.percent * 100).toFixed(2).replace('.', ',')}% (${yards}y) · ${side}` +
        (result.holed ? ' · entra de dunk' : ` · cai a ${result.miss.toFixed(2)}y do pin`) +
        (this.autoPangya ? '' : ' · acerte o PANGYA (ou P)'),
    )
  }

  /**
   * Mostrador da mira: quantos graus a mira está do pin (e para que lado), quanto isso dá de
   * lado na distância do pin e, se a calculadora (G) achou uma mira daqui, o alvo e quanto
   * falta (✓ quando bate). Cada toque de A/D gira 0,1° (0,05° no green).
   */
  private updateAimReadout() {
    const show = this.phase === 'aim' && this.controllable && !!this.active
    this.aimBox.hidden = !show
    if (!show) return
    const ball = this.active!.state.ball
    const pinAim = this.world.aimAtPin(ball)
    const pin = this.world.distanceToPin(ball)
    const describe = (aim: number) => {
      const deg = Math.atan2(Math.sin(aim - pinAim), Math.cos(aim - pinAim)) / DEG
      const value = Math.abs(deg).toFixed(2).replace('.', ',')
      if (Math.abs(deg) < 0.005) return { deg: 0, text: 'no pin' }
      return { deg, text: `${value}° ${deg > 0 ? '◀ esquerda' : 'direita ▶'}` }
    }
    const now = describe(this.aim)
    const lateral = (pin * Math.tan(Math.abs(now.deg) * DEG)).toFixed(1).replace('.', ',')
    const target =
      this.calcAim &&
      this.calcAim.ball.x === ball.x &&
      this.calcAim.ball.z === ball.z &&
      describe(this.calcAim.aim)
    let calc = ''
    if (target) {
      const diff = Math.atan2(
        Math.sin(this.calcAim!.aim - this.aim),
        Math.cos(this.calcAim!.aim - this.aim),
      )
      const off = Math.abs(diff / DEG)
      calc =
        `<small>🧮 alvo: ${target.text}</small>` +
        (off < 0.005
          ? '<b class="ok">✓ mira certa</b>'
          : `<b>falta ${off.toFixed(2).replace('.', ',')}° ${diff > 0 ? '◀' : '▶'}</b>`)
    }
    const html =
      `<span>Mira</span><strong>${now.text}</strong>` +
      (now.deg ? `<small>${lateral}y do pin, de lado</small>` : '') +
      calc
    if (html === this.aimText) return
    this.aimText = html
    this.aimBox.innerHTML = html
  }

  /** Tecla P (só sozinho): impacto sempre PANGYA, para testar a física. */
  private setAutoPangya(on: boolean, announce = true) {
    this.autoPangya = on
    saveAutoPangya(on)
    this.bar.setAutoPangya(on)
    if (announce) {
      this.panel.showResult(on ? '✨ Sempre PANGYA ligado (P)' : 'Sempre PANGYA desligado (P)')
    }
  }

  private fire(request: ShotRequest) {
    this.phase = 'idle'
    this.panel.setEnabled(false, 'Batendo…')
    this.onShoot(request)
  }

  /**
   * Anima a trajetória da bola de `playerId`, tocando os sons da linha do tempo;
   * `delay` (s) segura a bola parada antes de sair (tempo do swing). Resolve quando ela para.
   */
  animateShot(
    playerId: string,
    frames: Float32Array,
    options: {
      aim?: number
      events?: ShotEvent[]
      impact?: number
      club?: string
      powerShot?: PowerShot
      percent?: number
    } = {},
  ): Promise<void> {
    const { aim, events = [], impact, club, powerShot, percent } = options
    this.flight?.done()
    // A bola só sai quando o taco acerta (meio do swing do personagem).
    const delay = this.startSwing(playerId, club, powerShot)
    this.phase = 'flying'
    this.shotForward = aimDirection(aim ?? this.aim)
    this.target.visible = false
    this.greenGrid.visible = false
    this.panel.setEnabled(false, 'Espaço: pular animação')
    const player = this.players.find((p) => p.id === playerId)
    if (player) this.ballOf(player, this.players.length > 1)
    this.flightYaw = 0
    this.flightTop = false
    const landing = this.landingIndex(frames)
    const putt = club?.startsWith('PT') ?? false
    return new Promise((resolve) => {
      this.flight = {
        playerId,
        frames,
        start: performance.now() + delay * 1000,
        done: resolve,
        events,
        fired: 0,
        impact,
        club,
        powerShot,
        landing,
        index: 0,
        playhead: 0,
        slow: 1,
        holed: events.some((e) => e.type === 'hole'),
        putt,
        tee: player?.state.lie === 'tee',
        percent,
        from: this.frameAt(frames, 0),
        landingAt: this.frameAt(frames, landing),
        endsAtCup: this.endsAtCup(frames, events),
        mode: this.pickShotCamera(frames, landing, putt),
        stage: '',
      }
    })
  }

  /**
   * Contadores do HUD: durante o voo, a distância percorrida e até o pin; quando a bola
   * para, o piso, a distância da tacada e até o pin (como no original).
   */
  private showShotProgress(f: NonNullable<HoleView['flight']>, exact: number, stopped: boolean) {
    const { frames } = f
    const i = Math.floor(exact) * 3
    const t = exact - Math.floor(exact)
    const next = Math.min(i + 3, frames.length - 3)
    const point = {
      x: frames[i]! + (frames[next]! - frames[i]!) * t,
      y: 0,
      z: frames[i + 2]! + (frames[next + 2]! - frames[i + 2]!) * t,
    }
    const traveled = unitsToYards(Math.hypot(point.x - frames[0]!, point.z - frames[2]!))
    const toPin = this.world.distanceToPin(point)
    if (!stopped) {
      this.panel.showFlight(traveled, toPin)
      return
    }
    const end = (type: ShotEvent['type']) => f.events.some((e) => e.type === type)
    const kind = this.world.surfaceAt(point.x, point.z)?.kind
    const label = end('outOfBounds')
      ? 'O.B.'
      : end('water')
        ? 'água'
        : (SURFACE_LABELS[kind as SurfaceKind] ?? kind ?? '')
    this.panel.showStop({
      surface: label.charAt(0).toUpperCase() + label.slice(1),
      distance: traveled,
      toPin: f.holed ? undefined : toPin,
    })
  }

  /** Primeiro quadro, depois do ponto mais alto, em que a bola chega ao chão. */
  private landingIndex(frames: Float32Array) {
    const count = frames.length / 3
    let apex = 0
    for (let i = 1; i < count; i++) if (frames[i * 3 + 1]! > frames[apex * 3 + 1]!) apex = i
    for (let i = apex; i < count; i++) {
      const ground = this.world.grid.groundAt(frames[i * 3]!, frames[i * 3 + 2]!)?.y
      if (ground !== undefined && frames[i * 3 + 1]! - ground <= 0.5) return i
    }
    return count - 1
  }

  /** A bola entra na cova ou para a menos de SHOT_CAMERA.cup.stopYards dela. */
  private endsAtCup(frames: Float32Array, events: ShotEvent[]) {
    if (events.some((e) => e.type === 'hole')) return true
    const last = frames.length - 3
    const cup = this.world.cup
    const gap = Math.hypot(frames[last]! - cup.x, frames[last + 2]! - cup.z)
    return gap < yardsToUnits(SHOT_CAMERA.cup.stopYards)
  }

  /** Sorteia a câmera do voo (as curtas não vão para o céu nem para o lado). */
  private pickShotCamera(frames: Float32Array, landing: number, putt: boolean): ShotCameraMode {
    if (putt) return 'chase'
    // Testes automatizados: window.__shotCamera força uma câmera.
    const forced = (window as unknown as { __shotCamera?: ShotCameraMode }).__shotCamera
    if (forced) return forced
    const reach = Math.hypot(
      frames[landing * 3]! - frames[0]!,
      frames[landing * 3 + 2]! - frames[2]!,
    )
    const modes: ShotCameraMode[] =
      reach < yardsToUnits(SHOT_CAMERA.shortYards)
        ? ['chase', 'high']
        : ['chase', 'sky', 'high', 'side']
    return modes[Math.floor(Math.random() * modes.length)]!
  }

  /** Velocidade da reprodução onde a bola está agora: lenta perto da cova (NEAR_CUP_SLOW). */
  private nearCupSpeed(f: NonNullable<HoleView['flight']>) {
    const slow = f.holed ? NEAR_CUP_SLOW.holeIn : NEAR_CUP_SLOW.normal
    const i = Math.min(Math.floor(f.playhead), f.frames.length / 3 - 1) * 3
    const cup = this.world.cup
    const near = Math.hypot(f.frames[i]! - cup.x, f.frames[i + 2]! - cup.z) < slow.radius
    const low = f.frames[i + 1]! - cup.y < NEAR_CUP_SLOW.height
    // Já dentro da cova: a queda em velocidade normal (lenta, parecia travar).
    const inside = f.frames[i + 1]! < cup.y - CUP_FALL.rim
    return near && low && !inside ? slow.speed : 1
  }

  private nearCupEase(f: NonNullable<HoleView['flight']>) {
    return (f.holed ? NEAR_CUP_SLOW.holeIn : NEAR_CUP_SLOW.normal).ease
  }

  /** A câmera livre do voo vale até pouco antes de a bola cair. */
  private freeFlightCamera() {
    const f = this.flight
    if (!f || f.start === -Infinity) return false
    return f.index < f.landing - (FREE_CAMERA_UNTIL_LANDING * BALL_PLAYBACK_SPEED) / STEP_TIME
  }

  showResult(text: string) {
    this.panel.showResult(text)
  }

  /** Som de cada piso, do property.xml (bound_sound / roll_sound). */
  private surfaceSound(kind: string | undefined, which: 'boundSound' | 'rollSound') {
    return this.world.data.collision.surfaces.find((s) => s.kind === kind)?.[which] || undefined
  }

  /** Toca os eventos da linha do tempo até o quadro `index` (pulando: só o final). */
  private playEvents(index: number, skipped: boolean) {
    const flight = this.flight!
    const sounds = this.sounds
    const character = this.players.find((p) => p.id === flight.playerId)?.character
    while (flight.fired < flight.events.length && flight.events[flight.fired]!.frame <= index) {
      const e = flight.events[flight.fired++]!
      const last = flight.fired === flight.events.length
      if (skipped && !last && e.type !== 'hit') continue
      switch (e.type) {
        case 'hit':
          this.playHit(flight, character)
          this.hitEffect(flight)
          break
        case 'bounce':
          void sounds.playNamed(this.surfaceSound(e.surface, 'boundSound'), 'bounce')
          break
        case 'roll':
          void sounds.playNamed(this.surfaceSound(e.surface, 'rollSound'), 'roll')
          break
        case 'obstacle':
          void sounds.play('obstacle')
          break
        case 'water':
          void sounds.play('water')
          void sounds.play('galleryDisappointed')
          void sounds.voice(character, 'w')
          break
        case 'stop': {
          if (e.surface === 'bunker') void sounds.voice(character, 'bu')
          // Parou pertinho da cova: o público faz "oh…".
          const i = Math.min(e.frame, flight.frames.length / 3 - 1) * 3
          const cup = this.world.cup
          const gap = Math.hypot(flight.frames[i]! - cup.x, flight.frames[i + 2]! - cup.z)
          if (gap < yardsToUnits(NEAR_MISS_YARDS)) void sounds.play('galleryOh')
          break
        }
        case 'outOfBounds':
          void sounds.play('outOfBounds')
          void sounds.play('galleryDisappointed')
          void sounds.voice(character, 'ob')
          break
        case 'hole': {
          void sounds.play('cup')
          void sounds.play('applause')
          this.cupHidden = true
          void this.effects.play(EFFECTS.holeIn, this.cupScene())
          // As moedas saem quando o resultado é conhecido (announceScore).
          break
        }
      }
    }
  }

  /** Brilho da batida saindo da bola: o do PANGYA ou o da batida boa (não no putt). */
  private hitEffect(flight: NonNullable<HoleView['flight']>) {
    if (flight.putt) return
    const { impact } = flight
    const pangya = impact === undefined || isPangya(impact)
    const missed = impact !== undefined && Math.abs(impact) > 1
    if (pangya) void this.impactText.show('pangya')
    else if (missed) void this.impactText.show('bad')
    if (pangya) void this.effects.play(EFFECTS.pangya, flight.from)
    else if (!missed) void this.effects.play(EFFECTS.normal, flight.from)
  }

  /**
   * Som do 3º toque da barra (na hora do toque, como no jogo): PANGYA (shot_best_timing),
   * normal ou errado. No putt, nada. A batida dos outros jogadores toca na hora do impacto.
   */
  private timingSound(club: string, impact: number) {
    if (categoryOfClub(club) === 'putter') return
    this.timingPlayed = true
    const pangya = isPangya(impact)
    void this.sounds.play(pangya ? 'pangya' : Math.abs(impact) > 1 ? 'timingBad' : 'timingGood')
  }

  /** Som da batida: PANGYA, normal ou errada; power shot por cima; e a voz. */
  private playHit(flight: NonNullable<HoleView['flight']>, character: string | undefined) {
    const sounds = this.sounds
    const { impact, club = '1W', powerShot } = flight
    const category = categoryOfClub(club)
    const pangya = impact === undefined || isPangya(impact)
    const missed = impact !== undefined && Math.abs(impact) > 1
    // Swing do jogo: madeira com PANGYA = swing_drive_s, sem = swing_tee_s (como no jogo);
    // ferro/wedge pela força da barra ("_s" forte, "_w" fraco); errada, o "miss".
    const strength = (flight.percent ?? 1) >= SWING_STRONG_PERCENT ? /_s\./ : /_w\./
    const swing = missed
      ? sounds.play('miss', 1, category === 'wood' ? /wood/ : /iron/)
      : category === 'wood'
        ? sounds.play(pangya ? 'swingWood' : 'swingTee', 1, /_s\./)
        : sounds.play(category === 'putter' ? 'swingPutt' : 'swingIron', 1, strength)
    // Sem som próprio do taco, a batida genérica.
    void swing.then((played) => played || sounds.play('shot'))
    // Timing (não no putt): já tocou no 3º toque da barra; dos outros, agora.
    if (category !== 'putter') {
      if (!this.timingPlayed) {
        void sounds.play(pangya ? 'pangya' : missed ? 'timingBad' : 'timingGood')
      }
      // Boa, mas sem PANGYA: "Nice shot!".
      if (!pangya && !missed) void sounds.play('niceShot')
      // A bola voando (공날아가기), um pouco depois da batida.
      if (!missed) setTimeout(() => void sounds.play('ballFly', 0.8), 120)
    }
    this.timingPlayed = false
    const power = powerShot === 'one' || powerShot === 'two' || powerShot === 'item15'
    if (power) void sounds.play('powerShot')
    // Voz: power shot ("ps" / "dps") ou "Pangya!" (não no putt).
    if (power) void sounds.voice(character, powerShot === 'two' ? 'dps' : 'ps')
    else if (pangya && impact !== undefined && category !== 'putter') {
      void sounds.voice(character, 'py')
    }
  }

  /** Som e voz do resultado do buraco (birdie, par…), quando a bola entra. */
  announceScore(playerId: string, strokes: number, par: number, chipIn = false) {
    const character = this.players.find((p) => p.id === playerId)?.character
    void this.sounds.play(chipIn && strokes > 1 ? 'chipIn' : scoreSound(strokes, par))
    // Pangs saindo da cova, pela felicidade do resultado (hole in one > eagle > … > bogey).
    const coins = PANG_COINS[reactionForScore(strokes, par)] ?? 0
    if (coins > 0) {
      this.pangs.burst(this.cupScene().add(new Vector3(0, 0.5, 0)), coins)
      setTimeout(() => void this.sounds.play('pang'), 150)
    }
    if (strokes - par <= -1) void this.sounds.play('galleryWow')
    void this.sounds.voice(character, scoreVoice(strokes, par))
  }

  /**
   * Música do quadro de fim: do buraco (par ou melhor / acima do par) ou da rodada. A do
   * curso volta no próximo buraco.
   */
  endMusic(kind: 'holeGood' | 'holeBad' | 'round') {
    const id = { holeGood: 'musicHoleGood', holeBad: 'musicHoleBad', round: 'musicRoundEnd' }[kind]
    void this.sounds.music(soundEvent(id))
  }

  /** Voz de fim de rodada (ganhou/perdeu). */
  announceEnd(playerId: string, won: boolean) {
    const character = this.players.find((p) => p.id === playerId)?.character
    void this.sounds.voice(character, won ? 'win' : 'lose')
  }

  updateHud() {
    const p = this.active
    if (!p) {
      this.hud.innerHTML = `<strong>Buraco ${this.world.data.ref.hole}</strong> · Par ${this.world.par}${this.hudExtra ? '<br>' + this.hudExtra : ''}`
      return
    }
    const state = p.state
    const kind = this.world.lieKind(state)
    const label = SURFACE_LABELS[kind as SurfaceKind] ?? kind
    const lie = state.lie === 'tee' ? undefined : this.world.surfaceAt(state.ball.x, state.ball.z)
    // Força do piso já sorteada quando a bola parou (a tacada usa ela); senão, a faixa.
    const power =
      state.liePower !== undefined && state.lie !== 'tee'
        ? ` ${state.liePower}%`
        : lie
          ? ` (${lie.power.min}–${lie.power.max}%)`
          : ''
    const rise = unitsToMeters(this.world.cup.y - state.ball.y)
    const who = this.players.length > 1 ? `<strong>${p.name}</strong> · ` : ''
    this.hud.innerHTML =
      who +
      `<strong>Buraco ${this.world.data.ref.hole}</strong> · Par ${this.world.par} · ` +
      `Tacada ${state.strokes + 1}` +
      (state.penalties ? ` (${state.penalties} de penalidade)` : '') +
      ` · <strong>${this.world.distanceToPin(state.ball).toFixed(1)}y</strong> até o pin` +
      ` (${rise >= 0 ? '↑' : '↓'} ${Math.abs(rise).toFixed(2)} m) · Piso: ${label}${power}` +
      (this.hudExtra ? `<br>${this.hudExtra}` : '')
  }

  /** Anel amarelo onde a tacada cai com a força atual (girando junto com a mira). */
  private placeTarget() {
    const ring = this.landingPoint('ring', this.shownAim())
    if (ring) this.target.position.copy(ring).setY(ring.y + 0.3)
  }

  private placeCamera(focus: Vector3, lerp: number) {
    const { camera, world } = this
    const ball = this.restingBall()
    if (this.aerial && this.aerialCam && ball) {
      // De cima, com a linha da mira subindo na tela (a bola embaixo, o X em cima). Giro,
      // posição na linha, altura e chão seguem molas: sem trancos nos toques nem nos
      // recálculos.
      const cam = this.aerialCam
      const dt = this.frameDt
      const forward = aimDirection(cam.yaw.update(this.aim, dt))
      const along = cam.along.update(this.aerial.along, dt)
      const height = cam.height.update(this.aerial.height, dt)
      const center = ball.clone().addScaledVector(forward, along)
      const ground = world.grid.groundAt(center.x, -center.z)?.y ?? ball.y
      center.y = cam.ground.update(ground, dt)
      const position = center
        .clone()
        .add(new Vector3(0, height, 0))
        .addScaledVector(forward, -height * 0.12)
      let look = center
      const from = this.aerialFrom
      if (from) {
        const t = Math.min(1, (performance.now() - from.at) / 450)
        const k = t * t * (3 - 2 * t)
        position.copy(from.position.clone().lerp(position, k))
        look = from.look.clone().lerp(center, k)
        if (t >= 1) this.aerialFrom = undefined
      }
      camera.position.copy(position)
      camera.lookAt(look)
      return
    }
    let forward = this.phase === 'flying' ? this.shotForward : aimDirection(this.aim)
    const putting = this.phase === 'aim' && this.greenGrid.visible
    const free = this.phase === 'flying' && this.freeFlightCamera()
    if (free) forward = forward.clone().applyAxisAngle(UP, this.flightYaw)
    if (free && this.flightTop) {
      // Vista de cima da bola em voo (S).
      this.moveCamera(
        focus,
        focus
          .clone()
          .add(new Vector3(0, 70, 0))
          .addScaledVector(forward, -6),
        0.12,
      )
      camera.lookAt(focus)
      return
    }
    if (this.phase === 'flying' && this.flight) {
      this.flightCamera(focus, forward, free)
      return
    }
    // Mirando: perto, atrás do jogador (no green, um pouco mais alto).
    const view = putting ? SHOT_CAMERA.putt : SHOT_CAMERA.aim
    this.moveCamera(focus, this.behind(focus, forward, view.back, view.up), lerp)
    camera.lookAt(focus.clone().addScaledVector(forward, view.look))
  }

  private behind(focus: Vector3, forward: Vector3, back: number, up: number) {
    return focus
      .clone()
      .addScaledVector(forward, -back)
      .add(new Vector3(0, up, 0))
  }

  /** Câmera da tacada em andamento (SHOT_CAMERA): parada, a sorteada, a da queda; o putt. */
  private flightCamera(focus: Vector3, forward: Vector3, free: boolean) {
    const f = this.flight!
    const { camera } = this
    const elapsed = (performance.now() - f.start) / 1000
    const start = f.putt ? SHOT_CAMERA.putt : SHOT_CAMERA.aim
    const look = (target: Vector3, snap: boolean) => {
      if (snap) this.lookPoint.copy(target)
      else this.lookPoint.lerp(target, lerpFactor(SHOT_CAMERA.lookLerp, this.frameDt))
      camera.lookAt(this.lookPoint)
    }
    // O swing e a bola saindo: parada atrás do jogador.
    if (elapsed < SHOT_CAMERA.hold) {
      f.stage = 'hold'
      this.moveCamera(f.from, this.behind(f.from, forward, start.back, start.up), 0.12)
      look(f.from.clone().addScaledVector(forward, start.look), true)
      return
    }
    // Putt: atrás da bola, baixa, no sentido em que ela anda.
    if (f.putt) {
      const r = SHOT_CAMERA.puttRoll
      const along = this.travel(f, focus, forward, 25)
      this.moveCamera(focus, this.behind(focus, along, r.back, r.up), r.lerp)
      look(focus.clone().addScaledVector(along, r.look), false)
      return
    }
    // Perto de cair: corta para a câmera parada da queda.
    const a = SHOT_CAMERA.arrival
    const lead = (a.lead * BALL_PLAYBACK_SPEED) / STEP_TIME
    const spinning = free && this.flightYaw !== 0
    if (f.index >= f.landing - lead && !spinning) {
      const cut = f.stage !== 'arrival'
      f.stage = 'arrival'
      if (cut) this.cutCamera(this.arrivalPosition(f, forward))
      else if (camera.position.distanceTo(focus) > a.far) {
        // A bola rolou para longe: vai atrás dela devagar.
        const along = this.travel(f, focus, forward, 25)
        this.moveCamera(focus, this.behind(focus, along, a.back, a.up), a.follow)
      }
      // Entre a bola e onde ela vai (o chão sempre na tela, mesmo com a bola lá no alto).
      const ground = f.endsAtCup ? this.cupScene() : f.landingAt
      look(
        f.index < f.landing
          ? ground.clone().lerp(focus, 0.5)
          : focus.clone().lerp(ground, f.endsAtCup ? 0.4 : 0),
        cut,
      )
      return
    }
    // No ar: a câmera sorteada (girando com A/D, a de perseguição).
    const mode: ShotCameraMode = spinning ? 'chase' : f.mode
    const cut = f.stage !== mode
    f.stage = mode
    const place = (at: Vector3, lerp: number, minHeight?: number) =>
      cut ? this.cutCamera(at) : this.moveCamera(focus, at, lerp, minHeight)
    switch (mode) {
      case 'chase': {
        const c = SHOT_CAMERA.chase
        const along = spinning ? forward : this.travel(f, focus, forward, 4)
        place(this.behind(focus, along, c.back, c.up), c.lerp)
        look(focus.clone().addScaledVector(along, c.look), cut)
        break
      }
      case 'sky': {
        const c = SHOT_CAMERA.sky
        const at = focus.clone().addScaledVector(forward, -c.back)
        at.y = (this.world.grid.groundAt(at.x, -at.z)?.y ?? f.from.y) + c.up
        place(at, c.lerp, c.up)
        // Um pouco abaixo da bola: o horizonte aparece enquanto ela não sobe muito.
        const below = this.world.grid.groundAt(focus.x, -focus.z)?.y ?? f.from.y
        look(focus.clone().setY(focus.y - (focus.y - below) * 0.25), cut)
        break
      }
      case 'high': {
        const c = SHOT_CAMERA.high
        const at = focus.clone().addScaledVector(forward, -c.back)
        at.y = Math.max(focus.y, f.from.y) + c.up
        place(at, c.lerp)
        look(
          focus
            .clone()
            .addScaledVector(forward, c.look)
            .setY(focus.y - c.up * 0.3),
          cut,
        )
        break
      }
      case 'side': {
        const c = SHOT_CAMERA.side
        if (cut) {
          const span = f.landingAt.clone().sub(f.from).setY(0)
          const right = new Vector3().crossVectors(span, UP).normalize()
          const at = f.from
            .clone()
            .addScaledVector(span, c.along)
            .addScaledVector(right, span.length() * c.out)
          at.y = Math.max(f.from.y, f.landingAt.y) + c.up
          this.cutCamera(at)
        }
        look(focus, cut)
        break
      }
    }
  }

  /** Câmera parada da queda: perto da cova (atrás ou de lado) ou de lado atrás da queda. */
  private arrivalPosition(f: NonNullable<HoleView['flight']>, forward: Vector3) {
    const a = SHOT_CAMERA.arrival
    const c = SHOT_CAMERA.cup
    let at: Vector3
    if (f.endsAtCup) {
      const cup = this.cupScene()
      const approach = cup.clone().sub(f.landingAt).setY(0)
      const dunk = approach.length() < c.near
      if (approach.lengthSq() < 1e-6) approach.copy(forward)
      approach.setY(0).normalize()
      const side = new Vector3().crossVectors(approach, UP)
      // Caindo perto: de trás, vendo a bola descer na cova; rolando de longe: de lado.
      at = dunk
        ? cup.clone().addScaledVector(approach, -c.back).addScaledVector(side, c.side)
        : cup.clone().addScaledVector(approach, -4).addScaledVector(side, c.sideView)
      at.y = cup.y + c.up
    } else {
      const side = new Vector3().crossVectors(forward, UP).setY(0).normalize()
      at = f.landingAt.clone().addScaledVector(forward, -a.back).addScaledVector(side, a.side)
      at.y = f.landingAt.y + a.up
    }
    return at
  }

  /** Corte: a câmera vai direto para `at` (acima do chão). */
  private cutCamera(at: Vector3) {
    const below = this.world.grid.groundAt(at.x, -at.z)
    if (below && at.y < below.y + 3) at.y = below.y + 3
    this.camera.position.copy(at)
  }

  /** Sentido em que a bola anda (no plano), pelos últimos `frames` quadros. */
  private travel(
    f: NonNullable<HoleView['flight']>,
    focus: Vector3,
    fallback: Vector3,
    frames: number,
  ) {
    const moved = focus
      .clone()
      .sub(this.frameAt(f.frames, Math.max(0, f.index - frames)))
      .setY(0)
    return moved.lengthSq() > 0.25 ? moved.normalize() : fallback
  }

  private cupScene() {
    return toScene(this.world.cup.x, this.world.cup.y, this.world.cup.z)
  }

  /**
   * Comemoração do resultado depois de embocar (do hole in one ao double bogey): um tempo
   * vendo a cova e corta para o personagem perto dela, de frente, fazendo a pose.
   */
  async celebrate(playerId: string, strokes: number, par: number) {
    const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000))
    await sleep(CELEBRATION.wait)
    const model = this.ready.get(playerId)
    const name = model && reactionMotion(model.motions, reactionForScore(strokes, par))
    if (!model || !name) return
    const cup = this.cupScene()
    const toward = this.camera.position.clone().sub(cup).setY(0)
    if (toward.lengthSq() < 1e-6) toward.set(0, 0, 1)
    toward.normalize()
    const spot = cup.clone().addScaledVector(toward, CELEBRATION.fromCup)
    spot.y = this.world.grid.groundAt(spot.x, -spot.z)?.y ?? cup.y
    for (const [id, other] of this.ready) other.root.visible = id === playerId
    model.root.visible = true
    this.pangs.clear()
    this.effects.clear()
    model.root.position.copy(spot)
    // O modelo olha para -X no próprio espaço: virado para a câmera.
    model.root.rotation.y = Math.atan2(toward.z, -toward.x)
    // A câmera animada do jogo para essa pose (uma das 4 versões, sorteada); sem ela, uma
    // câmera parada de frente.
    const path = await this.cameraPathOf(model)
    const segment = path && (path.segment(name) ?? path.segment(name.replace(/0?\d+$/, '')))
    const duration = model.play(name, false, 0.15)
    model.update(0)
    model.clubVisible = false
    if (path && segment) {
      this.startCinematic({ path, segment, model, started: performance.now() })
      await sleep(Math.min(duration, CELEBRATION.seconds))
      const ending = reactionEnding(model.motions, name)
      if (ending && this.cinematic) model.play(ending, true, 0.2)
      return
    }
    // Altura pelo esqueleto (a caixa do modelo inteiro inclui o taco e sobras).
    model.root.updateMatrixWorld(true)
    let top = -Infinity
    const bone = new Vector3()
    model.root.traverse((o) => {
      if ((o as { isBone?: boolean }).isBone) top = Math.max(top, o.getWorldPosition(bone).y)
    })
    const height = Number.isFinite(top) ? Math.max(2, (top - spot.y) * 1.1) : 6
    this.cinematic = {
      position: spot
        .clone()
        .addScaledVector(toward, CELEBRATION.distance * height)
        .add(new Vector3(0, CELEBRATION.up * height, 0)),
      look: spot.clone().add(new Vector3(0, CELEBRATION.lookHeight * height, 0)),
    }
    await sleep(Math.min(duration, CELEBRATION.seconds))
    const ending = reactionEnding(model.motions, name)
    if (ending && this.cinematic) model.play(ending, true, 0.2)
  }

  /** Câmeras animadas do personagem (data/camera_path/<personagem>_cam.apet). */
  private cameraPathOf(model: CharacterModel) {
    let path = this.cameraPaths.get(model)
    if (!path) {
      path = findAsset(cameraPathName(model.entry.skeleton), '')
        .then((file) => (file ? tryFetchBytes(file) : undefined))
        .then((bytes) => (bytes ? new CameraPath(readPet(bytes, 'apet')) : undefined))
        .catch(() => undefined)
      this.cameraPaths.set(model, path)
    }
    return path
  }

  /** Câmera da comemoração neste quadro: a animada do jogo ou a parada de frente. */
  private placeCinematic() {
    const c = this.cinematic!
    const camera = this.camera
    if ('position' in c) {
      camera.position.copy(c.position)
      camera.lookAt(c.look)
      return
    }
    const { segment } = c
    const frame = Math.min(
      segment.end,
      segment.start + ((performance.now() - c.started) / 1000) * CAMERA_PATH_FPS,
    )
    const pose = c.path.pose(frame)
    if (!pose) return
    // Do espaço do personagem (com o Z invertido dele) para a cena.
    const space = c.model.space
    space.updateMatrixWorld(true)
    const at = pose.position.clone().applyMatrix4(space.matrixWorld)
    const target = pose.position.clone().add(pose.forward).applyMatrix4(space.matrixWorld)
    camera.position.copy(at)
    camera.up.copy(pose.up.transformDirection(space.matrixWorld))
    camera.lookAt(target)
  }

  /** Começa uma câmera animada do jogo (lente do jogo). */
  private startCinematic(c: {
    path: CameraPath
    segment: CameraSegment
    model: CharacterModel
    started: number
  }) {
    this.cinematic = c
    this.camera.fov = CAMERA_PATH_FOV
    this.camera.updateProjectionMatrix()
  }

  /**
   * Entrada do personagem no começo do buraco (등장모션), com a câmera animada do jogo, como
   * no original. Espaço (ou clique na barra) pula. Sem o movimento, nada.
   */
  async entrance(playerId: string) {
    // Sem mira nem tacada desde já (o personagem e a câmera ainda vão carregar).
    this.entering = true
    this.panel.setEnabled(false, 'Espaço: pular a entrada')
    const player = this.players.find((p) => p.id === playerId)
    const model = player?.character ? await this.characterOf(player) : undefined
    if (!model || !model.motionNames.includes(ENTRANCE) || !this.entering) {
      this.entering = false
      this.panel.setEnabled(this.controllable, '')
      return
    }
    await this.address(model)
    const path = await this.cameraPathOf(model)
    const segment = path?.segment(ENTRANCE)
    if (!this.entering) {
      this.panel.setEnabled(this.controllable, '')
      return
    }
    model.root.visible = true
    this.placeCharacter(model)
    const duration = model.play(ENTRANCE, false, 0.1)
    if (path && segment) this.startCinematic({ path, segment, model, started: performance.now() })
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, duration * 1000)
      this.skipEntrance = () => {
        clearTimeout(timer)
        resolve()
      }
    })
    this.skipEntrance = undefined
    this.entering = false
    this.endCinematic()
    this.idle(model)
    this.placeCamera(this.ballPosition(), 1)
    this.panel.setEnabled(this.controllable, '')
  }

  /** Fim da comemoração: câmera normal (para cima = +Y, abertura do jogo). */
  private endCinematic() {
    if (!this.cinematic) return
    for (const model of this.ready.values()) model.clubVisible = true
    this.cinematic = undefined
    this.camera.up.set(0, 1, 0)
    this.camera.fov = this.baseFov
    this.camera.updateProjectionMatrix()
  }

  /**
   * Desliza a câmera até `desired`. As proteções valem para a posição real de cada quadro
   * (deslizando, a câmera poderia atravessar paredes do terreno).
   */
  private moveCamera(focus: Vector3, desired: Vector3, lerp: number, minHeight = 6) {
    // `lerp` é por quadro a 60 quadros/s; convertido para o tempo do quadro de verdade.
    const next = this.camera.position.clone().lerp(desired, lerpFactor(lerp, this.frameDt))
    const toCamera = next.clone().sub(focus)
    const distance = toCamera.length()
    if (distance > 0.001) {
      this.ray.set(focus, toCamera.normalize())
      this.ray.far = distance
      const hit = this.ray.intersectObjects(this.course.terrainMeshes, false)[0]
      if (hit) next.copy(focus).addScaledVector(toCamera, Math.max(4, hit.distance - 4))
    }
    const below = this.world.grid.groundAt(next.x, -next.z)
    if (below && next.y < below.y + minHeight) next.y = below.y + minHeight
    this.camera.position.copy(next)
  }

  private frameAt(frames: Float32Array, i: number) {
    return toScene(frames[i * 3]!, frames[i * 3 + 1]! + BALL_RADIUS, frames[i * 3 + 2]!)
  }

  private frame(now: number, dt: number) {
    this.frameDt = dt
    if (this.flight) {
      const { frames, playerId } = this.flight
      const count = frames.length / 3
      const skipped = this.flight.start === -Infinity
      const elapsed = (now - this.flight.start) / 1000
      // A física tem um ponto a cada 0,02 s (50 por segundo) e a tela é 60 Hz ou mais:
      // a bola é desenhada entre dois pontos, pelo tempo exato do quadro — sem isso ela anda
      // aos trancos (uns quadros repetem a posição, outros pulam) e a câmera treme junto.
      // Tocada um pouco mais devagar que a física (BALL_PLAYBACK_SPEED).
      // Perto da cova, câmera lenta (NEAR_CUP_SLOW): a reprodução anda quadro a quadro.
      const f = this.flight
      if (skipped) f.playhead = count - 1
      else if (elapsed > 0) {
        const step = Math.min(dt, elapsed)
        f.slow += (this.nearCupSpeed(f) - f.slow) * Math.min(1, step / this.nearCupEase(f))
        f.playhead += (step * BALL_PLAYBACK_SPEED * f.slow) / STEP_TIME
      }
      const exact = Math.min(f.playhead, count - 1)
      const index = Math.min(Math.floor(exact), count - 1)
      const between = index < count - 1 ? exact - index : 0
      if (elapsed >= 0) this.playEvents(index, skipped)
      this.flight.index = index
      // Câmera livre do voo: A/D giram em volta da bola; perto de cair, volta ao normal.
      if (this.freeFlightCamera()) {
        const spin =
          (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) -
          (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0)
        this.flightYaw += spin * dt * 1.6
      } else {
        this.flightYaw *= Math.pow(0.9, dt * 60)
        this.flightTop = false
      }
      const at = this.frameAt(frames, index)
      if (between > 0) at.lerp(this.frameAt(frames, index + 1), between)
      this.placeBall(playerId, at)
      if (elapsed >= 0 || skipped) this.showShotProgress(f, exact, index === count - 1)
      // Rastro até o último ponto e, na ponta, a bola (que está entre dois pontos).
      const shown = Math.min(index + 1, MAX_TRAIL - 1)
      for (let i = 0; i < shown; i++) {
        const p = this.frameAt(frames, i)
        this.trailPositions.setXYZ(i, p.x, p.y, p.z)
      }
      this.trailPositions.setXYZ(shown, at.x, at.y, at.z)
      this.trailPositions.needsUpdate = true
      this.trailGeometry.setDrawRange(0, shown + 1)
      // Câmera animada (2º power shot) até a bola sair; depois, a da tacada.
      if (this.cinematic && elapsed > SHOT_CAMERA.hold) this.endCinematic()
      if (this.cinematic) this.placeCinematic()
      else if (!this.debugFreeze) this.placeCamera(this.ballPosition(), 0.08)
      if (index === count - 1) {
        const { done } = this.flight
        this.flight = undefined
        this.phase = 'idle'
        this.cameraHold = true
        done()
      }
    } else if (this.phase === 'aim') {
      // Mira só antes de começar a barra: um toque = passo fino (nudgeAim); segurando, gira
      // sozinha cada vez mais rápido. O passo por quadro é limitado (sem pulos se o PC
      // engasgar).
      let turn = 0
      for (const [key, direction] of Object.entries(AIM_KEYS)) {
        if (this.keys.has(key)) turn = direction
      }
      if (!this.controllable || this.bar.active || this.entering) turn = 0
      const model = this.active && this.ready.get(this.active.id)
      const held = (now - this.turnStart) / 1000 - AIM_TUNING.holdDelay
      if (turn && held > 0) {
        const [slow, fast] = this.greenGrid.visible ? AIM_TUNING.greenSpeed : AIM_TUNING.speed
        const speed = slow! + (fast! - slow!) * Math.min(1, held / AIM_TUNING.rampSeconds)
        this.aim += turn * speed * DEG * Math.min(dt, 1 / 30)
        if (model?.root.visible) this.placeCharacter(model)
      }
      // Andando de lado enquanto gira a mira; parado, volta à preparação.
      if (model?.root.visible && !this.bar.active && Boolean(turn) !== this.walking) {
        this.walking = Boolean(turn)
        const walk = this.golf(model).walk
        if (this.walking && walk) model.play(walk, true, 0.1)
        else this.idle(model)
      }
      if (this.targetDirty) {
        this.targetDirty = false
        this.updateBarScale()
        if (this.controllable) this.refreshLanding()
      } else if (
        this.controllable &&
        this.landing &&
        this.landing.aim !== this.aim &&
        (!turn || now - this.landing.at > LANDING_REFRESH * 1000)
      ) {
        this.refreshLanding() // mira girou: recálculo exato (no máximo a cada 0,12 s)
      }
      this.updateWind()
      this.target.visible = this.controllable
      this.moveAerial(dt, now)
      if (this.cinematic) this.placeCinematic()
      else this.placeCamera(this.ballPosition(), 0.12)
      this.placeTarget() // depois da câmera: na vista aérea usa o giro dela deste quadro
    } else if (this.cinematic) {
      this.placeCinematic()
    } else if (!this.debugFreeze && !this.cameraHold) {
      this.placeCamera(this.ballPosition(), 0.08)
    }
    for (const model of this.ready.values()) if (model.root.visible) model.update(dt)
    this.pangs.update(dt)
    this.effects.update(dt)
    this.flashBox.style.opacity = String(this.effects.flash)
    this.updateOverlay()
    this.updateAimReadout()
    this.beamMaterial.opacity = 0.4 + 0.08 * Math.sin(now / 300)
    this.fitBeam()
    this.course.update(this.camera)
    // Tremida dos efeitos só no desenho (as câmeras seguem do lugar certo no próximo quadro).
    const shake = this.effects.shake
    this.camera.position.add(shake)
    this.renderer.render(this.scene, this.camera)
    this.camera.position.sub(shake)
  }

  /** Mostra um quadro no centro da tela (fim do buraco/partida). */
  overlay(html: string) {
    const box = document.createElement('div')
    box.className = 'hole-end'
    box.innerHTML = html
    document.body.appendChild(box)
    this.elements.push(box)
    return box
  }

  dispose() {
    this.impactText.dispose()
    this.effects.clear()
    this.sounds.stopAmbient()
    this.flight?.done()
    this.flight = undefined
    this.renderer.setAnimationLoop(null)
    this.renderer.dispose()
    for (const cleanup of this.cleanups) cleanup()
    for (const el of this.elements) el.remove()
  }
}

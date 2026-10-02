import {
  advanceHole,
  applyMatchShot,
  createMatch,
  describeShot,
  encodeFrames,
  HoleWorld,
  joinMatch,
  leaveMatch,
  loadHoleData,
  randomWind,
  sanitizeRequest,
  DEFAULT_POWER,
  clampPower,
  startMatchHole,
  type ClientMessage,
  type Course,
  type FileSource,
  type MatchState,
  type ServerMessage,
} from '@pangya/game'

/** Conexão de um jogador (o WebSocket, abstraído para os testes). */
export interface Peer {
  send(message: ServerMessage): void
}

/** Tempo para ver o placar do buraco antes do próximo (ms). */
const HOLE_END_DELAY = 8000

/**
 * Uma sala: uma partida por servidor, como numa noite de jogo com os amigos.
 * O servidor carrega o buraco, simula cada tacada e manda o resultado a todos.
 */
export class Room {
  match: MatchState = createMatch()
  private readonly peers = new Map<string, Peer>()
  private world: HoleWorld | undefined
  private busy = false
  private nextId = 1

  constructor(
    private readonly files: FileSource,
    private readonly options: { holeEndDelay?: number; random?: () => number } = {},
  ) {}

  private broadcast(message: ServerMessage) {
    for (const peer of this.peers.values()) peer.send(message)
  }

  private publish() {
    this.broadcast({ t: 'match', match: this.match })
  }

  connect(peer: Peer): string {
    const id = `p${this.nextId++}`
    this.peers.set(id, peer)
    peer.send({ t: 'welcome', id })
    return id
  }

  disconnect(id: string) {
    if (!this.peers.delete(id)) return
    if (this.match.players.some((p) => p.id === id)) {
      this.match = leaveMatch(this.match, id)
      this.publish()
    }
  }

  async handle(id: string, message: ClientMessage) {
    const peer = this.peers.get(id)
    if (!peer) return
    try {
      switch (message.t) {
        case 'hello': {
          const name =
            String(message.name ?? '')
              .trim()
              .slice(0, 16) || 'Jogador'
          const taken = this.match.players.some((p) => p.connected && p.name === name)
          if (taken) throw new Error(`o nome "${name}" já está na sala`)
          const character =
            typeof message.character === 'string' ? message.character.slice(0, 200) : undefined
          const power =
            typeof message.power === 'number' && Number.isFinite(message.power)
              ? clampPower(message.power)
              : undefined
          this.match = joinMatch(this.match, id, name, character, power)
          this.publish()
          break
        }
        case 'chat': {
          const from = this.match.players.find((p) => p.id === id)?.name ?? '?'
          const text = String(message.text ?? '').slice(0, 200)
          if (text.trim()) this.broadcast({ t: 'chat', from, text })
          break
        }
        case 'start':
          await this.start(id, message.course)
          break
        case 'shot':
          this.shot(id, message)
          break
      }
    } catch (err) {
      peer.send({ t: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  private async loadWorld(course: Course, index: number) {
    const hole = course.holes[index]
    if (hole === undefined) throw new Error('buraco inexistente')
    const data = await loadHoleData(
      this.files,
      { round: course.round, prefix: course.prefix, hole },
      { withModels: false },
    )
    return new HoleWorld(data)
  }

  private async start(id: string, course: Course) {
    if (this.match.host !== id) throw new Error('só o anfitrião começa a partida')
    if (this.match.phase === 'playing') throw new Error('a partida já começou')
    if (!course?.round || !course.prefix || !Array.isArray(course.holes) || !course.holes.length) {
      throw new Error('curso inválido')
    }
    const holes = course.holes.map(Number).filter((h) => Number.isInteger(h) && h > 0 && h <= 18)
    const chosen = { round: String(course.round), prefix: String(course.prefix), holes }
    this.world = await this.loadWorld(chosen, 0)
    // Partida nova: cartões zerados.
    this.match = {
      ...this.match,
      holeIndex: 0,
      players: this.match.players.filter((p) => p.connected).map((p) => ({ ...p, card: [] })),
    }
    this.match = startMatchHole(this.match, chosen, this.setup(this.world))
    this.publish()
  }

  private setup(world: HoleWorld) {
    return { par: world.par, tee: world.tee, wind: randomWind(this.options.random) }
  }

  private shot(id: string, message: Extract<ClientMessage, { t: 'shot' }>) {
    if (this.busy) throw new Error('aguarde a tacada anterior')
    const world = this.world
    if (!world || this.match.phase !== 'playing') throw new Error('a partida não está em andamento')
    if (this.match.turn !== id) throw new Error('não é a sua vez')
    const player = this.match.players.find((p) => p.id === id)!
    // Força: a do jogador escolhida ao entrar na sala, não a que vem na tacada.
    const request = { ...sanitizeRequest(message.request), power: player.power ?? DEFAULT_POWER }
    const played = world.play(player.state!, request, this.match.wind, this.options.random)
    this.match = applyMatchShot(this.match, id, played.outcome, world.cup)
    this.broadcast({
      t: 'shot',
      playerId: id,
      frames: encodeFrames(played.frames),
      carry: played.carry,
      hits: played.hits,
      events: played.events,
      club: request.club,
      aim: request.aim,
      ...(played.impact !== undefined && { impact: played.impact }),
      outcome: played.outcome,
      message: describeShot(player.state!.ball, played),
    })
    this.publish()
    if (this.match.phase === 'holeEnd') this.scheduleNextHole()
  }

  private scheduleNextHole() {
    this.busy = true
    setTimeout(() => {
      void (async () => {
        try {
          const course = this.match.course!
          this.world = await this.loadWorld(course, this.match.holeIndex + 1)
          this.match = advanceHole(this.match, this.setup(this.world))
        } catch (err) {
          this.broadcast({ t: 'error', message: `próximo buraco: ${String(err)}` })
          this.match = { ...this.match, phase: 'finished' }
        } finally {
          this.busy = false
          this.publish()
        }
      })()
    }, this.options.holeEndDelay ?? HOLE_END_DELAY)
  }
}

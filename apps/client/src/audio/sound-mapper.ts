/**
 * Tela "Sons" do mapeador: o que toca em cada momento do jogo e todos os arquivos de som da
 * extração, para ouvir e escolher com um clique.
 *
 * Esquerda: os momentos (batida, PANGYA, cova, birdie, música de cada curso, menus…), cada
 * um com os arquivos que tocam hoje e de onde vieram (escolhido, automático pelo nome,
 * sintetizado ou mudo), e a voz de cada personagem. Direita: os arquivos por pasta, com ▶
 * para ouvir e ＋ para usar no momento escolhido. Grava sozinho no servidor (sons.json).
 */
import type { CharacterEntry } from '../character/character.ts'
import { assetPaths } from '../hole/assets.ts'
import { courseName } from '../menu/courses.ts'
import {
  audioFiles,
  courseMusicEvent,
  emptyChoices,
  resolveEvent,
  resolveVoice,
  SOUND_EVENTS,
  SOUND_GROUPS,
  VOICE_CODES,
  voiceFiles,
  voicePrefixesFor,
  type ChoiceSource,
  type SoundChoices,
  type SoundEvent,
} from './sound-events.ts'
import { loadSoundChoices, sound } from './sounds.ts'

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const baseName = (path: string) => path.split('/').pop() ?? path
const folderOf = (path: string) => path.split('/').slice(0, -1).join('/') || '(raiz)'

const SOURCE_TEXT: Record<ChoiceSource, string> = {
  chosen: '⭐ escolhido por você',
  auto: 'automático (pelo nome)',
  synth: 'sintetizado (sem arquivo)',
  none: 'sem arquivo ainda (mudo)',
}

interface CourseInfo {
  round: string
  prefix: string
}

export class SoundMapper {
  readonly element = document.createElement('div')
  /** Lugar no cabeçalho para os botões do mapeador (animações, estúdio). */
  readonly tools: HTMLElement
  private readonly events: HTMLElement
  private readonly files: HTMLElement
  private readonly status: HTMLElement
  private readonly search: HTMLInputElement
  private loaded: Promise<void> | undefined
  private all: string[] = []
  private choices: SoundChoices = emptyChoices()
  private soundEvents: SoundEvent[] = [...SOUND_EVENTS]
  private selected = 'pangya'

  constructor(private readonly characters: CharacterEntry[]) {
    this.element.className = 'sound-mapper'
    this.element.hidden = true
    this.element.innerHTML = `
      <header>
        <h1>Sons do jogo</h1>
        <span class="sound-count"></span>
        <div class="sound-tools"></div>
        <span class="sound-status"></span>
        <p class="hint">1) Clique num momento do jogo (esquerda) · 2) ouça os arquivos (▶, direita) e
          clique ＋ para usar nele · grava sozinho e o jogo já usa (recarregue a página do jogo).</p>
      </header>
      <div class="sound-columns">
        <section class="sound-events"></section>
        <section class="sound-files">
          <input class="search" type="search" placeholder="Buscar arquivo (ex.: 팡야, cup, py1, round02)" />
          <div class="sound-file-list"></div>
        </section>
      </div>`
    const $ = <T extends Element>(selector: string) => this.element.querySelector(selector) as T
    this.tools = $('.sound-tools')
    this.events = $('.sound-events')
    this.files = $('.sound-file-list')
    this.status = $('.sound-status')
    this.search = $('input.search')
    this.search.addEventListener('input', () => this.filterFiles())
  }

  get visible() {
    return !this.element.hidden
  }

  show(on: boolean) {
    this.element.hidden = !on
    if (on) this.loaded ??= this.load()
    else sound.stopPreview()
  }

  private async load() {
    this.status.textContent = 'Carregando…'
    const [paths, choices, courses] = await Promise.all([
      assetPaths(),
      loadSoundChoices(),
      fetch('/api/courses')
        .then((r) => (r.ok ? (r.json() as Promise<CourseInfo[]>) : []))
        .catch(() => [] as CourseInfo[]),
    ])
    this.all = audioFiles(paths).sort((a, b) => a.localeCompare(b))
    this.choices = choices
    // Uma música por curso, depois da música do menu.
    const music = courses.map((c) => courseMusicEvent(c.round, c.prefix, courseName(c)))
    const at = this.soundEvents.findIndex((e) => e.id === 'musicMenu') + 1
    this.soundEvents.splice(at, 0, ...music)
    this.status.textContent = ''
    ;(this.element.querySelector('.sound-count') as HTMLElement).textContent =
      `${this.all.length} arquivos de som`
    this.render()
  }

  private resolved(event: SoundEvent) {
    return resolveEvent(event, this.choices, this.all)
  }

  private render() {
    const eventsScroll = this.events.scrollTop
    const filesScroll = this.files.scrollTop
    this.renderEvents()
    this.renderFiles()
    this.events.scrollTop = eventsScroll
    this.files.scrollTop = filesScroll
  }

  private renderEvents() {
    const fileRow = (path: string, id: string, removable: boolean) => `
      <li><button class="play" data-path="${escapeHtml(path)}" title="Ouvir">▶</button>
        <span title="${escapeHtml(path)}">${escapeHtml(baseName(path))}</span>
        ${removable ? `<button class="remove" data-id="${escapeHtml(id)}" data-path="${escapeHtml(path)}" title="Tirar">✕</button>` : ''}</li>`
    const groups = SOUND_GROUPS.map((group) => {
      const rows = this.soundEvents
        .filter((e) => e.group === group)
        .map((e) => {
          const { files, source } = this.resolved(e)
          const chosen = this.choices.events[e.id] !== undefined
          const text = chosen && source === 'none' ? '🔇 sem som (você tirou)' : SOURCE_TEXT[source]
          return `<div class="sound-event ${e.id === this.selected ? 'selected' : ''}" data-id="${escapeHtml(e.id)}">
            <div class="row"><button class="select">${escapeHtml(e.label)}</button>
              <span class="source ${source}">${text}</span></div>
            ${files.length ? `<ul>${files.map((f) => fileRow(f, e.id, true)).join('')}</ul>` : ''}
            <div class="actions">
              <button class="test">▶ testar</button>
              <button class="mute">🔇 sem som</button>
              ${chosen ? '<button class="auto">↺ automático</button>' : ''}
            </div>
          </div>`
        })
        .join('')
      return `<h2>${group}</h2>${rows}`
    }).join('')
    this.events.innerHTML = groups + this.voicesHtml()
    this.bindEvents()
  }

  /** Vozes: o pacote de voz de cada personagem (<pacote>_<nº>_py1.wav…), com as falas. */
  private voicesHtml() {
    const voices = voiceFiles(this.all)
    const all = [...voices.keys()].sort((a, b) => a.localeCompare(b))
    const option = (p: string, chosen: string | undefined) =>
      `<option value="${escapeHtml(p)}" ${chosen === p ? 'selected' : ''}>${escapeHtml(p)} (${voices.get(p)!.size} falas)</option>`
    const rows = this.characters
      .map((c) => {
        const { prefix, source } = resolveVoice(c.id, this.choices, voices)
        const chosen = this.choices.voices[c.id]
        const mine = voicePrefixesFor(c.id, voices)
        const others = all.filter((p) => !mine.includes(p))
        const options = [
          `<option value="*" ${chosen === undefined ? 'selected' : ''}>automático${source === 'auto' ? `: ${escapeHtml(prefix!)}` : ' (nenhum achado)'}</option>`,
          mine.length
            ? `<optgroup label="Deste personagem">${mine.map((p) => option(p, chosen)).join('')}</optgroup>`
            : '',
          others.length
            ? `<optgroup label="Outros pacotes">${others.map((p) => option(p, chosen)).join('')}</optgroup>`
            : '',
          `<option value="" ${chosen === '' ? 'selected' : ''}>sem voz</option>`,
        ].join('')
        const codes = prefix ? voices.get(prefix) : undefined
        const buttons = VOICE_CODES.filter((v) => codes?.has(v.code))
          .map(
            (v) =>
              `<button class="play" data-path="${escapeHtml(codes!.get(v.code)![0]!)}" title="${escapeHtml(v.code)}">▶ ${escapeHtml(v.label)}</button>`,
          )
          .join('')
        return `<div class="sound-voice" data-id="${escapeHtml(c.id)}">
          <div class="row"><strong>${escapeHtml(c.name)}</strong>
            <select>${options}</select></div>
          <div class="voice-codes">${buttons || '<small>sem arquivos de voz</small>'}</div>
        </div>`
      })
      .join('')
    return `<h2>Vozes dos personagens</h2>
      <p class="hint">No Pangya as falas vêm dos pacotes de voz (tacos de voz e eventos):
        &lt;pacote&gt;_&lt;nº do personagem&gt;_&lt;fala&gt;.wav — ${all.length} pacotes achados.
        O automático usa o pacote mais completo de cada personagem; troque para ouvir os outros.</p>${rows}`
  }

  private bindEvents() {
    const box = this.events
    box.querySelectorAll<HTMLButtonElement>('button.play').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation()
        void sound.previewFile(b.dataset['path']!)
      }),
    )
    box.querySelectorAll<HTMLElement>('.sound-event').forEach((row) => {
      const id = row.dataset['id']!
      const event = this.soundEvents.find((e) => e.id === id)!
      row.addEventListener('click', () => {
        if (this.selected === id) return
        this.selected = id
        this.render()
      })
      row.querySelector('.test')!.addEventListener('click', (e) => {
        e.stopPropagation()
        const { files, source } = this.resolved(event)
        const path = files[Math.floor(Math.random() * files.length)]
        if (path) void sound.previewFile(path)
        else if (source === 'synth') void sound.play(event)
      })
      row.querySelector('.mute')!.addEventListener('click', (e) => {
        e.stopPropagation()
        this.choices.events[id] = []
        void this.save()
      })
      row.querySelector('.auto')?.addEventListener('click', (e) => {
        e.stopPropagation()
        delete this.choices.events[id]
        void this.save()
      })
      row.querySelectorAll<HTMLButtonElement>('.remove').forEach((b) =>
        b.addEventListener('click', (e) => {
          e.stopPropagation()
          const files = this.resolved(event).files.filter((f) => f !== b.dataset['path'])
          this.choices.events[id] = files
          void this.save()
        }),
      )
    })
    box.querySelectorAll<HTMLElement>('.sound-voice').forEach((row) => {
      const select = row.querySelector('select')!
      select.addEventListener('change', () => {
        const id = row.dataset['id']!
        if (select.value === '*') delete this.choices.voices[id]
        else this.choices.voices[id] = select.value
        void this.save()
      })
    })
  }

  private renderFiles() {
    const selected = this.soundEvents.find((e) => e.id === this.selected)
    // Em quais momentos cada arquivo toca hoje.
    const usedBy = new Map<string, string[]>()
    for (const e of this.soundEvents) {
      for (const f of this.resolved(e).files) usedBy.set(f, [...(usedBy.get(f) ?? []), e.label])
    }
    const inSelected = new Set(selected ? this.resolved(selected).files : [])
    const folders = new Map<string, string[]>()
    for (const path of this.all) {
      const folder = folderOf(path)
      folders.set(folder, [...(folders.get(folder) ?? []), path])
    }
    if (this.all.length === 0) {
      this.files.innerHTML =
        '<p class="hint">Nenhum arquivo de som na extração (rode o servidor.cmd no PC com o jogo).</p>'
      return
    }
    const add = selected ? `＋ ${escapeHtml(selected.label)}` : '＋'
    this.files.innerHTML = [...folders]
      .map(
        ([folder, list]) =>
          `<details open><summary>${escapeHtml(folder)} <small>${list.length}</small></summary><ul>${list
            .map((path) => {
              const tags = (usedBy.get(path) ?? []).map(
                (t) => `<span class="tag">${escapeHtml(t)}</span>`,
              )
              const using = inSelected.has(path)
              return `<li data-search="${escapeHtml(path.toLowerCase())}">
              <button class="play" data-path="${escapeHtml(path)}" title="Ouvir">▶</button>
              <span class="name">${escapeHtml(baseName(path))}</span> ${tags.join('')}
              <button class="add ${using ? 'using' : ''}" data-path="${escapeHtml(path)}" ${using ? 'disabled' : ''}>${using ? '✓ usando' : add}</button>
            </li>`
            })
            .join('')}</ul></details>`,
      )
      .join('')
    this.files
      .querySelectorAll<HTMLButtonElement>('button.play')
      .forEach((b) => b.addEventListener('click', () => void sound.previewFile(b.dataset['path']!)))
    this.files.querySelectorAll<HTMLButtonElement>('button.add').forEach((b) =>
      b.addEventListener('click', () => {
        if (!selected) return
        const current = this.resolved(selected)
        // Saindo do automático, começa só com o arquivo escolhido.
        const base = current.source === 'chosen' ? current.files : []
        this.choices.events[selected.id] = [...base, b.dataset['path']!]
        void sound.previewFile(b.dataset['path']!)
        void this.save()
      }),
    )
    this.filterFiles()
  }

  private filterFiles() {
    const query = this.search.value.trim().toLowerCase()
    this.files.querySelectorAll<HTMLElement>('li').forEach((li) => {
      li.hidden = query !== '' && !li.dataset['search']!.includes(query)
    })
    this.files.querySelectorAll<HTMLDetailsElement>('details').forEach((d) => {
      d.hidden = [...d.querySelectorAll('li')].every((li) => li.hidden)
    })
  }

  /** Grava no servidor (sons.json) e o jogo passa a usar. */
  private async save() {
    this.render()
    this.status.textContent = 'Gravando…'
    try {
      const response = await fetch('/api/sons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.choices),
      })
      if (!response.ok) throw new Error(String(response.status))
      this.status.textContent = '✓ salvo'
      sound.reloadChoices(this.choices)
    } catch {
      this.status.textContent = '⚠ não salvou (o servidor/mapeador está ligado neste PC?)'
    }
  }
}

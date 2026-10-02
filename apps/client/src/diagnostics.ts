/**
 * Página de diagnóstico (?diagnostico): lista o que a extração local tem de personagens,
 * movimentos, tacos e sons, para ajustar o jogo aos nomes reais do cliente. Tudo fica num
 * texto com botão de copiar (para colar na conversa).
 */
import { readPet } from '@pangya/formats'
import { loadCatalog } from './character/character.ts'
import { ASSET_BASE, assetNames, findAsset, tryFetchBytes } from './hole/assets.ts'

async function petOf(path: string, kind: 'bpet' | 'apet') {
  const bytes = await tryFetchBytes(path)
  return bytes ? readPet(bytes, kind) : undefined
}

export async function showDiagnostics() {
  const box = document.createElement('div')
  box.className = 'lobby diagnostics'
  box.innerHTML = `
    <h1>Diagnóstico</h1>
    <p>Copie o texto abaixo e cole na conversa. <button>Copiar</button> <a href="/">← Menu</a></p>
    <textarea readonly rows="30">Coletando…</textarea>`
  document.body.appendChild(box)
  const text = box.querySelector('textarea') as HTMLTextAreaElement
  const lines: string[] = []
  const log = (line = '') => {
    lines.push(line)
    text.value = lines.join('\n')
  }

  const names = await assetNames()
  log(`arquivos no índice: ${names.length}`)

  // Personagens: ossos, movimentos e peças.
  const catalog = await loadCatalog()
  log(`\n== PERSONAGENS (${catalog.length})`)
  for (const c of catalog.slice(0, 12)) {
    log(`\n# ${c.name}  esqueleto=${c.skeleton}  animações=${c.animations ?? '-'}`)
    log(
      `slots: ${Object.entries(c.parts)
        .map(([slot, list]) => `${slot}(${list.length})`)
        .join(' ')}`,
    )
    log(`roupa padrão: ${c.defaults.map((p) => p.split('/').pop()).join(', ')}`)
    try {
      const bpet = await petOf(c.skeleton, 'bpet')
      if (bpet) {
        log(`ossos (${bpet.bones.length}): ${bpet.bones.map((b) => b.name).join(' | ')}`)
        if (bpet.collisions.length) {
          log(
            `caixas COLL: ${bpet.collisions.map((b) => `${b.boxName}@${b.boneName}`).join(' | ')}`,
          )
        }
      }
      const apet = c.animations ? await petOf(c.animations, 'apet') : undefined
      if (apet) {
        log(`movimentos (${apet.motions.length}):`)
        log(
          apet.motions.map((m) => `${m.name}[${m.frameStart}-${m.frameEnd}→${m.next}]`).join('  '),
        )
      }
    } catch (err) {
      log(`erro lendo: ${String(err)}`)
    }
  }

  // Tacos: do Club.iff convertido (pnpm assets:build) e arquivos com cara de taco.
  log('\n== TACOS')
  try {
    const response = await fetch('/game-assets/converted/data/clubs.json')
    if (response.ok) {
      const clubs = (await response.json()) as { name?: string; model?: string; kind?: number }[]
      log(`clubs.json: ${clubs.length} registros`)
      for (const club of clubs.slice(0, 25)) {
        const model = club.model ?? ''
        const found =
          (await findAsset(`${model}.mpet`, '')) ??
          (await findAsset(`${model}.pet`, '')) ??
          (await findAsset(model, ''))
        log(`  ${club.name} · modelo "${model}" · tipo ${club.kind} · ${found ?? 'NÃO ACHADO'}`)
      }
    } else log('clubs.json não encontrado (rode o servidor.cmd/assets:build)')
  } catch (err) {
    log(`erro: ${String(err)}`)
  }
  const pets = names.filter((n) => /\.(pet|mpet|bpet|apet)$/.test(n))
  const show = (label: string, re: RegExp, max = 60) => {
    const list = pets.filter((n) => re.test(n))
    log(`${label} (${list.length}): ${list.slice(0, max).join(' | ')}`)
  }
  show('modelos com "club/cl_"', /club|^cl_|_cl_|^c_/)
  show('modelos com "cup/hole/flag/pin"', /cup|hole|flag|pin/)
  show('modelos com "ball"', /ball/)
  const bpets = pets.filter((n) => n.endsWith('.bpet'))
  log(`todos os .bpet (${bpets.length}): ${bpets.join(' | ')}`)

  // Sons.
  const sounds = names.filter((n) => /\.(wav|ogg|mp3)$/.test(n))
  log(`\n== SONS (${sounds.length})`)
  // Vozes: <prefixo>_<código><n>.wav (py = "Pangya!", bi = birdie, ob = O.B., …).
  const voice = /^(.*)_(bi|bo|bu|dbo|dps|e|ha|lose|ob|par|pre|ps|py|w|win)\d\.(wav|ogg|mp3)$/
  const prefixes = new Map<string, number>()
  const effects: string[] = []
  for (const n of sounds) {
    const m = voice.exec(n)
    if (m) prefixes.set(m[1]!, (prefixes.get(m[1]!) ?? 0) + 1)
    else effects.push(n)
  }
  log(`vozes (${prefixes.size} prefixos): ${[...prefixes.keys()].slice(0, 200).join(' | ')}`)
  log(`\nefeitos (${effects.length}):`)
  log(effects.slice(0, 1500).join(' | '))

  log(`\n(base dos assets: ${ASSET_BASE})`)
  box.querySelector('button')!.addEventListener('click', () => {
    text.select()
    void navigator.clipboard?.writeText(text.value).catch(() => document.execCommand('copy'))
  })
}

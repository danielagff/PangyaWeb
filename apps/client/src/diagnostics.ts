/**
 * Página de diagnóstico (?diagnostico): lista o que a extração local tem de personagens,
 * movimentos, tacos e sons, para ajustar o jogo aos nomes reais do cliente. Tudo fica num
 * texto com botão de copiar (para colar na conversa).
 */
import { readIffArchive, readPet } from '@pangya/formats'
import { loadCatalog } from './character/character.ts'
import {
  CAMERA_NAME,
  CURIOUS_FILE,
  DATA_FILE,
  extensionCounts,
  findCameraMarkers,
} from './camera-search.ts'
import { ASSET_BASE, assetNames, assetPaths, findAsset, tryFetchBytes } from './hole/assets.ts'

/** Arquivos de dados lidos por dentro na busca da câmera (no máximo) e o tamanho máximo. */
const CAMERA_SEARCH = { maxFiles: 4000, maxBytes: 8 * 1024 * 1024, parallel: 6 }

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
    const response = await fetch('/game-assets/converted/data/clubs.json', { cache: 'no-cache' })
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

  // Pastas dos sons e músicas com o caminho (para achar a música de cada curso).
  const soundPaths = (await assetPaths()).filter((p) => /\.(wav|ogg|mp3)$/i.test(p))
  const folders = new Map<string, number>()
  for (const p of soundPaths) {
    const folder = p.split('/').slice(0, -1).join('/')
    folders.set(folder, (folders.get(folder) ?? 0) + 1)
  }
  log(`\n== PASTAS DE SOM (${folders.size})`)
  log([...folders].map(([f, n]) => `${f} (${n})`).join(' | '))
  const music = soundPaths.filter((p) => /\.(mp3|ogg)$/i.test(p))
  log(`\n== MÚSICAS (${music.length})`)
  log(music.join(' | '))

  await cameraSection(await assetPaths(), log)

  log(`\n(base dos assets: ${ASSET_BASE})`)
  box.querySelector('button')!.addEventListener('click', () => {
    text.select()
    void navigator.clipboard?.writeText(text.value).catch(() => document.execCommand('copy'))
  })
}

/**
 * Pistas da câmera nos arquivos do jogo: tipos de arquivo, nomes com cara de câmera, as
 * tabelas .iff e palavras de câmera dentro dos arquivos de dados.
 */
async function cameraSection(paths: string[], log: (line?: string) => void) {
  log('\n== CÂMERA')
  log(
    `tipos de arquivo: ${extensionCounts(paths)
      .map(([ext, n]) => `${ext} (${n})`)
      .join(' | ')}`,
  )
  const named = paths.filter((p) => CAMERA_NAME.test(p))
  log(`\nnomes com cara de câmera (${named.length}): ${named.slice(0, 300).join(' | ')}`)
  const curious = paths.filter((p) => CURIOUS_FILE.test(p))
  log(`\nsequências, scripts e outros (${curious.length}): ${curious.slice(0, 700).join(' | ')}`)
  // As tabelas do jogo ficam dentro de pangya_<região>.iff (um zip): o nome e o tamanho de
  // cada uma, e as palavras de câmera dentro delas.
  for (const archive of paths.filter((p) => /(^|\/)pangya_\w+\.iff$/i.test(p))) {
    const bytes = await tryFetchBytes(archive)
    let tables: Map<string, Uint8Array> | undefined
    try {
      tables = bytes && readIffArchive(bytes)
    } catch (err) {
      log(`\n${archive}: não abriu (${err instanceof Error ? err.message : String(err)})`)
    }
    if (!tables) continue
    log(`\ntabelas em ${archive} (${tables.size}):`)
    log([...tables].map(([name, t]) => `${name} (${t.length} bytes)`).join(' | '))
    const found = [...tables].flatMap(([name, t]) =>
      findCameraMarkers(t).map((f) => `${name} → ${f}`),
    )
    log(`palavras de câmera nas tabelas (${found.length}):`)
    log(found.slice(0, 200).join('\n') || '(nenhuma)')
  }

  const data = paths
    .filter((p) => DATA_FILE.test(p) && !/(^|\/)pangya_\w+\.iff$/i.test(p))
    .slice(0, CAMERA_SEARCH.maxFiles)
  log(`\nprocurando palavras de câmera dentro de ${data.length} arquivos de dados…`)
  const hits: string[] = []
  let done = 0
  let next = 0
  const worker = async () => {
    while (next < data.length) {
      const path = data[next++]!
      const bytes = await tryFetchBytes(path).catch(() => undefined)
      if (bytes && bytes.length <= CAMERA_SEARCH.maxBytes) {
        for (const found of findCameraMarkers(bytes)) hits.push(`${path} → ${found}`)
      }
      done++
    }
  }
  await Promise.all(Array.from({ length: CAMERA_SEARCH.parallel }, worker))
  log(`lidos ${done}; achados (${hits.length}):`)
  log(hits.slice(0, 400).join('\n') || '(nenhum)')
}

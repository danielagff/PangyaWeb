import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { unzipSync } from 'fflate'
import { originalDir, repoRoot } from './config.ts'

/** Curso de exemplo já extraído, publicado em lbarceloss/pangya-pet_tools. */
const SOURCE_REPO = 'https://github.com/lbarceloss/pangya-pet_tools'
const ZIP_NAME = 'Blue Lagoon.zip'
const ZIP_PREFIX = 'Blue Lagoon/data/'
const ROUND = 'round02_blue'

export const exampleUrl = 'http://localhost:5173/?curso=round02_blue&prefixo=blue&buraco=1'

/**
 * Baixa (git clone raso) o repositório com o Blue Lagoon e extrai a pasta do curso para
 * assets/original/data/round02_blue. Não faz nada se ela já existir.
 */
export function installExampleCourse(log: (msg: string) => void = console.log) {
  const target = resolve(originalDir, 'data', ROUND)
  if (existsSync(join(target, 'map', 'blue_01.gbin'))) {
    log(`Blue Lagoon já instalado em ${target}`)
    return target
  }

  const cache = resolve(repoRoot, 'assets', '.cache', 'pangya-pet_tools')
  if (!existsSync(join(cache, ZIP_NAME))) {
    rmSync(cache, { recursive: true, force: true })
    mkdirSync(dirname(cache), { recursive: true })
    log(`baixando ${SOURCE_REPO}…`)
    execFileSync('git', ['clone', '--depth', '1', SOURCE_REPO, cache], { stdio: 'inherit' })
  }

  log(`extraindo ${ZIP_NAME}…`)
  const files = unzipSync(readFileSync(join(cache, ZIP_NAME)))
  let count = 0
  for (const [name, data] of Object.entries(files)) {
    const path = name.replaceAll('\\', '/')
    if (!path.startsWith(ZIP_PREFIX) || path.endsWith('/')) continue
    const out = resolve(originalDir, 'data', path.slice(ZIP_PREFIX.length))
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, data)
    count++
  }
  if (!existsSync(join(target, 'map', 'blue_01.gbin'))) {
    throw new Error(`o zip não tinha ${ROUND}/map/blue_01.gbin — o repositório de origem mudou?`)
  }
  log(`${count} arquivos instalados em ${target}`)
  return target
}

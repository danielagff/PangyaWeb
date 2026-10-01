import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readGameData } from '@pangya/formats'
import { convertedDir, originalDir, repoRoot, resolvePangyaDir } from './config.ts'

const envFile = resolve(repoRoot, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

const commands: Record<string, (args: string[]) => void> = {
  build() {
    const dir = resolvePangyaDir()
    console.log(`cliente: ${dir}`)
    console.log(`extração → ${originalDir}`)
    console.log(`conversão → ${convertedDir}`)
    console.log('Extração (.pak) ainda não implementada — spec 03.')
  },

  /** Converte um pangya_<região>.iff em JSON: `pnpm assets:iff <arquivo.iff>`. */
  iff([file]) {
    if (!file) throw new Error('uso: pnpm assets:iff <caminho/do/pangya_jp.iff>')
    const data = readGameData(readFileSync(file))
    const outDir = resolve(convertedDir, 'data')
    mkdirSync(outDir, { recursive: true })
    const { version, ...tables } = data
    for (const [name, rows] of Object.entries(tables)) {
      writeFileSync(resolve(outDir, `${name}.json`), JSON.stringify(rows, null, 2))
      console.log(`${name}: ${rows.length} registros`)
    }
    writeFileSync(resolve(outDir, 'meta.json'), JSON.stringify({ source: file, version }, null, 2))
    console.log(`versão ${version} → ${outDir}`)
  },
}

const [name = 'help', ...args] = process.argv.slice(2)
const command = commands[name]
if (!command) {
  console.log(`uso: asset-pipeline <${Object.keys(commands).join('|')}>`)
  process.exitCode = name === 'help' ? 0 : 1
} else {
  try {
    command(args)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  }
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readGameData } from '@pangya/formats'
import { extractClient, mountClient } from './extract.ts'
import { convertedDir, originalDir, repoRoot, resolvePangyaDir } from './config.ts'

const envFile = resolve(repoRoot, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

const commands: Record<string, (args: string[]) => void> = {
  /** Extrai todos os .pak do cliente para assets/original e converte o .iff. */
  build() {
    const dir = resolvePangyaDir()
    console.log(`cliente: ${dir}`)
    const { written, failures, vfs } = extractClient(dir, originalDir)
    console.log(`${written} arquivos extraídos → ${originalDir}`)
    if (failures.length > 0) {
      const report = resolve(originalDir, '_falhas.txt')
      writeFileSync(report, failures.join('\n'))
      console.log(`${failures.length} falhas (detalhes em ${report})`)
    }
    const iff = vfs.list().find((e) => /^pangya_\w+\.iff$/i.test(e.path.split('/').pop() ?? ''))
    if (iff) commands['iff']!([resolve(originalDir, iff.path)])
    else console.log('nenhum pangya_*.iff encontrado nos pacotes')
  },

  /** Lista os .pak do cliente: entradas e região detectada. */
  pak() {
    const dir = resolvePangyaDir()
    const { vfs, paks } = mountClient(dir)
    for (const p of paks) {
      const status = p.error ? 'ERRO' : (p.region ?? '-')
      console.log(`${p.name.padEnd(28)} ${String(p.entries).padStart(6)} entradas  ${status}`)
    }
    for (const p of paks.filter((p) => p.error)) console.log(`\nERRO em ${p.name}: ${p.error}`)
    const byExt = Map.groupBy(vfs.list(), (e) => e.path.split('.').pop()?.toLowerCase() ?? '')
    const top = [...byExt].sort((a, b) => b[1].length - a[1].length).slice(0, 25)
    console.log(`\n${vfs.size} arquivos após patches. Extensões:`)
    console.log(top.map(([ext, list]) => `${ext}: ${list.length}`).join(', '))
  },

  /** Converte um pangya_<região>.iff em JSON: `pnpm assets:iff <arquivo.iff>`. */
  iff(args) {
    // Junta os argumentos: caminhos com espaço funcionam mesmo sem aspas.
    const file = args.join(' ')
    if (!file) throw new Error('uso: pnpm assets:iff <caminho/do/pangya_jp.iff>')
    if (!existsSync(file)) throw new Error(`arquivo não encontrado: ${file}`)
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

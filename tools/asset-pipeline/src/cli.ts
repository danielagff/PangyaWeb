import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readGameData } from '@pangya/formats'
import { extractClient, findPaks, mountClient, searchPakKey } from './extract.ts'
import { exampleUrl, installExampleCourse } from './example-course.ts'
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
    console.log(`cliente: ${dir}\n`)
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

  /** Baixa e instala o Blue Lagoon de exemplo: `pnpm assets:exemplo`. */
  exemplo() {
    installExampleCourse()
    console.log(`\nPronto! Rode "pnpm dev" e abra:\n  ${exampleUrl}`)
  },

  /** Procura a chave XTEA de um .pak no cliente: `pnpm assets:pak-key [arquivo.pak]`. */
  'pak-key'(args) {
    const dir = resolvePangyaDir()
    const pakFile = args.length > 0 ? args.join(' ') : resolve(dir, findPaks(dir)[0] ?? '')
    if (!existsSync(pakFile)) throw new Error(`arquivo não encontrado: ${pakFile}`)
    console.log(`procurando a chave de ${pakFile} nos arquivos .exe/.dll/.dat de ${dir}…`)
    let found = false
    for (const { file, keys } of searchPakKey(dir, pakFile)) {
      console.log(`  ${file}: ${keys.length > 0 ? 'ACHOU' : 'nada'}`)
      for (const key of keys) {
        found = true
        const hex = key.map((k) => '0x' + k.toString(16).padStart(8, '0')).join(',')
        console.log(`\n    PAK_KEY=${hex}\n`)
      }
    }
    console.log(
      found
        ? 'Coloque a linha PAK_KEY=... no arquivo .env do PangyaWeb e rode "pnpm assets:pak" de novo.'
        : 'Chave não encontrada nos arquivos (o executável pode estar compactado/protegido).',
    )
  },

  /** Mostra rodapé e índice de um .pak em hexadecimal: `pnpm assets:pak-dump <arquivo.pak>`. */
  'pak-dump'(args) {
    const file = args.join(' ')
    if (!existsSync(file)) throw new Error(`arquivo não encontrado: ${file}`)
    const bytes = readFileSync(file)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const footer = bytes.byteLength - 9
    const indexOffset = view.getUint32(footer, true)
    const count = view.getUint32(footer + 4, true)
    console.log(`tamanho=${bytes.byteLength} índice@${indexOffset} entradas=${count}`)
    console.log(`versão=0x${view.getUint8(footer + 8).toString(16)}`)
    const dump = (from: number, to: number) => {
      for (let at = from; at < to; at += 16) {
        const row = Array.from(bytes.subarray(at, Math.min(at + 16, to)), (b) =>
          b.toString(16).padStart(2, '0'),
        )
        console.log(`${at.toString(16).padStart(8, '0')}  ${row.join(' ')}`)
      }
    }
    console.log('\n-- início do arquivo --')
    dump(0, Math.min(64, bytes.byteLength))
    console.log('\n-- índice + rodapé (até 2 KB) --')
    const start = Math.max(0, Math.min(indexOffset, bytes.byteLength - 2048))
    dump(start, bytes.byteLength)
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

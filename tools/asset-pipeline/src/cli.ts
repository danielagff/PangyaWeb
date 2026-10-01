import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { convertedDir, originalDir, repoRoot, resolvePangyaDir } from './config.ts'

const envFile = resolve(repoRoot, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

const commands: Record<string, () => void> = {
  build() {
    const dir = resolvePangyaDir()
    console.log(`cliente: ${dir}`)
    console.log(`extração → ${originalDir}`)
    console.log(`conversão → ${convertedDir}`)
    console.log('Extração (.pak) e conversão ainda não implementadas — specs 02 a 06.')
  },
}

const [name = 'help'] = process.argv.slice(2)
const command = commands[name]
if (!command) {
  console.log(`uso: asset-pipeline <${Object.keys(commands).join('|')}>`)
  process.exitCode = name === 'help' ? 0 : 1
} else {
  try {
    command()
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  }
}

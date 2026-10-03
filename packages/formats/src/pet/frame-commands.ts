/**
 * Comandos dos eventos de quadro (FRAM): `*nome arg arg` ou `*nome("a" "b")`, vários no
 * mesmo texto. Ex.: `*ball_dist 5.4 *grip_pos -0.02 *fx("@x" "Dust.spr" "Bip01 L Toe0")`.
 */
export interface FrameCommand {
  name: string
  args: string[]
}

export function parseFrameCommands(text: string): FrameCommand[] {
  const out: FrameCommand[] = []
  // Cada comando começa em "*"; o "*" dentro de aspas não conta.
  const parts: string[] = []
  let current: string | undefined
  let quoted = false
  for (const ch of text) {
    if (ch === '"') quoted = !quoted
    if (ch === '*' && !quoted) {
      if (current?.trim()) parts.push(current)
      current = ''
      continue
    }
    // Antes do primeiro "*" é lixo (ex.: "v*hidebone").
    if (current !== undefined) current += ch
  }
  if (current?.trim()) parts.push(current)
  for (const part of parts) {
    const m = /^\s*([\w-]+)\s*(.*)$/s.exec(part)
    if (!m) continue
    const rest = m[2]!.trim()
    const quotedArgs = [...rest.matchAll(/"([^"]*)"/g)].map((q) => q[1]!)
    const args = quotedArgs.length
      ? quotedArgs
      : rest
          .replace(/[()]/g, ' ')
          .split(/\s+/)
          .filter((a) => a.length > 0)
    out.push({ name: m[1]!.toLowerCase(), args })
  }
  return out
}

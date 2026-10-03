/**
 * Transição entre telas (menu → buraco, buraco → próximo buraco): uma cortina por cima de
 * tudo enquanto a próxima tela carrega, e ela só sai quando tudo está pronto (curso,
 * personagem, música). Do buraco para o próximo, a cortina é a última imagem do buraco
 * anterior e ela se dissolve no novo, como no original; do menu, uma tela com o nome do
 * curso. Se o navegador ainda não liberou o som (página aberta direto num buraco), pede um
 * toque antes de mostrar, para o jogo nunca começar sem música.
 */
import { sound } from '../audio/sounds.ts'

const FADE_MS = 700

let curtain: HTMLDivElement | undefined

/** Enquanto carrega, teclas e roda do mouse não chegam ao jogo (nem começam a barra). */
const block = (e: Event) => {
  e.stopImmediatePropagation()
  if (e.cancelable && e.type !== 'wheel') e.preventDefault()
}
const BLOCKED = ['keydown', 'keyup', 'wheel'] as const
const setBlocking = (on: boolean) => {
  for (const type of BLOCKED) {
    if (on) window.addEventListener(type, block, true)
    else window.removeEventListener(type, block, true)
  }
}

function element() {
  if (curtain) return curtain
  curtain = document.createElement('div')
  curtain.className = 'transition'
  curtain.innerHTML = `
    <div class="transition-card">
      <p class="transition-title"></p>
      <p class="transition-subtitle"></p>
      <div class="transition-bar"><span></span></div>
      <p class="transition-status"></p>
    </div>`
  return curtain
}

/** Mostra a cortina: a imagem da tela anterior (`image`) ou o fundo com o título. */
export function cover(info: { image?: string; title?: string; subtitle?: string } = {}) {
  const el = element()
  el.classList.remove('leaving')
  el.style.backgroundImage = info.image ? `url("${info.image}")` : ''
  el.classList.toggle('snapshot', Boolean(info.image))
  el.querySelector('.transition-title')!.textContent = info.title ?? ''
  el.querySelector('.transition-subtitle')!.textContent = info.subtitle ?? ''
  progress(0, 'Carregando…')
  setBlocking(true)
  if (!el.isConnected) {
    document.body.appendChild(el)
    // Sem a imagem, a cortina aparece com um fade (a tela anterior some aos poucos).
    if (!info.image) {
      el.classList.add('entering')
      void el.offsetWidth
      el.classList.remove('entering')
    }
  }
}

/** Progresso do carregamento (0..1) e o texto embaixo. */
export function progress(fraction: number, text?: string) {
  const el = curtain
  if (!el) return
  el.querySelector<HTMLSpanElement>('.transition-bar span')!.style.width =
    `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`
  if (text !== undefined) el.querySelector('.transition-status')!.textContent = text
}

/** Tudo pronto: tira a cortina (dissolvendo). Sem som liberado, espera um toque antes. */
export async function reveal() {
  const el = curtain
  if (!el?.isConnected) return
  if (!sound.unlocked) {
    progress(1, 'Pronto! Clique ou aperte uma tecla para começar')
    el.classList.add('waiting')
    setBlocking(false)
    // O toque que libera o som não vai para o jogo (não começa a barra nem pula a entrada).
    await new Promise<void>((resolve) => {
      const start = (e: Event) => {
        e.stopImmediatePropagation()
        e.preventDefault()
        window.removeEventListener('keydown', start, true)
        window.removeEventListener('pointerdown', start, true)
        void sound.resume()
        resolve()
      }
      window.addEventListener('keydown', start, true)
      window.addEventListener('pointerdown', start, true)
    })
    el.classList.remove('waiting')
  }
  setBlocking(false)
  el.classList.add('leaving')
  await new Promise((r) => setTimeout(r, FADE_MS))
  if (el.classList.contains('leaving')) el.remove()
}

/** A cortina está na tela (carregando)? */
export const covering = () => Boolean(curtain?.isConnected)

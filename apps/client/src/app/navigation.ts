/**
 * Navegação dentro da página entre o menu e os buracos do modo sozinho: o endereço muda
 * (history), mas a página não recarrega — a música continua tocando e a troca é feita com
 * a transição (app/transition.ts). Os outros modos (sala, treino, visualizador) continuam
 * abrindo como página nova.
 */

/** Tela aberta agora; `dispose` a desmonta. */
export interface Screen {
  dispose(): void
  /** Imagem da tela agora (para a transição dissolver dela para a próxima). */
  snapshot?(): string | undefined
}

let router: ((previous: Screen | undefined) => Promise<Screen | undefined>) | undefined
let current: Screen | undefined
let routedSearch = ''
let busy: Promise<void> = Promise.resolve()

/** Endereços tratados aqui (sem recarregar): o menu e o modo sozinho (?curso=…). */
export function handledHere(url: URL) {
  if (url.origin !== location.origin || url.pathname !== location.pathname) return false
  const params = url.searchParams
  return params.has('curso') || [...params.keys()].length === 0
}

/** Monta a tela do endereço atual (desmontando a anterior). */
function route() {
  busy = busy.then(async () => {
    routedSearch = location.search
    const previous = current
    current = undefined
    try {
      current = await router!(previous)
    } catch (err) {
      console.error(err)
    }
  })
  return busy
}

/**
 * Vai para `url` sem recarregar a página (se for uma tela daqui). `again`: refaz a tela
 * mesmo com o mesmo endereço ("jogar este buraco de novo").
 */
export function goTo(url: string, again = false) {
  const target = new URL(url, location.href)
  if (!handledHere(target)) {
    location.href = target.href
    return
  }
  const path = target.pathname + target.search + target.hash
  if (again && target.href === location.href) history.replaceState(null, '', path)
  else history.pushState(null, '', path)
  if (again || target.search !== routedSearch) void route()
  else window.dispatchEvent(new PopStateEvent('popstate'))
}

/**
 * Liga a navegação: `start(previous)` monta a tela do endereço atual (recebe a anterior, já
 * fora de uso, para tirar a imagem dela e desmontá-la na hora certa).
 */
export function startNavigation(
  start: (previous: Screen | undefined) => Promise<Screen | undefined>,
) {
  router = start
  // Links para o menu e para os buracos: sem recarregar.
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
    const link = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!link || link.target) return
    const url = new URL(link.href, location.href)
    if (!handledHere(url)) return
    const sameScreen = url.search === location.search
    // Só a parte depois do "#" mudou (telas do menu): o próprio menu cuida.
    if (sameScreen && !url.searchParams.has('curso')) return
    e.preventDefault()
    goTo(url.href, sameScreen)
  })
  // Voltar/avançar do navegador: só refaz a tela se mudou de modo (o menu cuida do "#").
  window.addEventListener('popstate', () => {
    if (location.search !== routedSearch) void route()
  })
  return route()
}

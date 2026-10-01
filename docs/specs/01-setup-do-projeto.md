# 01 — Setup do projeto

- **Status:** rascunho
- **Fase:** 0 Fundação
- **Depende de:** —
- **Estimativa:** P

## Objetivo
Repositório com estrutura de monorepo, build, testes e CI funcionando, abrindo uma página
web vazia com um canvas 3D.

## Contexto
Tudo o que vem depois (parsers, engine, servidor) compartilha tipos e assets. Separar em pacotes desde o início evita que o código do jogo
dependa do pipeline de conversão.

## Escopo
**Inclui**
- Monorepo (pnpm workspaces) em TypeScript estrito.
- Pacotes iniciais:
  - `packages/formats` — parsers de arquivos (`.pak`, `.iff`, `.pet`…), roda em Node e no navegador.
  - `packages/physics` — física da bola, sem dependência de renderização.
  - `packages/game` — regras, estado da partida.
  - `apps/client` — cliente web (Vite + Three.js).
  - `apps/server` — servidor (Node, WebSocket), vazio por enquanto.
  - `tools/asset-pipeline` — CLI que lê a instalação original e gera `assets/converted/`.
- Vitest para testes, ESLint + Prettier, GitHub Actions rodando lint/typecheck/test.
- `.gitignore` bloqueando `assets/`, `*.pak`, `*.iff`, `*.pet`/`*.apet`/`*.bpet`/`*.mpet`.
- `.env.example` com `PANGYA_DIR=` (caminho da instalação local do cliente).
- Script `pnpm assets:build` (extrai + converte para `assets/converted/`) e o cliente
  servindo `assets/converted/` em dev.
- Helper de teste `describeWithAssets(...)` que pula testes de integração sem `PANGYA_DIR`.

**Não inclui**
- Qualquer lógica de jogo.

## Requisitos
1. `pnpm install && pnpm dev` abre o cliente em `localhost` com uma cena Three.js
   (plano verde + esfera branca).
2. `pnpm test` roda os testes de todos os pacotes.
3. CI roda só os testes que não dependem de assets; localmente, com `PANGYA_DIR`, rodam
   também os de integração.
4. Escolha da engine registrada em `docs/adr/0001-engine.md` (Three.js recomendado pela
   simplicidade e ecossistema glTF; Babylon.js é alternativa válida).

## Critérios de aceite
- [ ] `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm lint` funcionam.
- [ ] CI verde no GitHub Actions.
- [ ] Nenhum arquivo do jogo é rastreado pelo git.

## Riscos e perguntas em aberto
- WebGPU vs WebGL2: começar em WebGL2 (suporte universal); Three.js permite migrar depois.

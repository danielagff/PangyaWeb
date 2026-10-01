# PangyaWeb

Projeto pessoal para recriar Pangya rodando no navegador, usando os assets originais do jogo
(mantidos só localmente, fora do git).

Specs e roadmap: [`docs/specs/README.md`](docs/specs/README.md).

## Começando

Requisitos: Node 22+ e pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm dev            # cliente em http://localhost:5173
```

## Comandos

| Comando                     | O que faz                                                      |
| --------------------------- | -------------------------------------------------------------- |
| `pnpm dev`                  | Cliente web (Vite) com recarga automática                      |
| `pnpm server`               | Servidor (Node) em modo watch                                  |
| `pnpm test`                 | Testes (Vitest)                                                |
| `pnpm typecheck`            | Checagem de tipos de todos os pacotes                          |
| `pnpm lint` / `pnpm format` | ESLint + Prettier                                              |
| `pnpm build`                | Build de produção do cliente                                   |
| `pnpm assets:build`         | Extrai e converte os assets do cliente original para `assets/` |

## Assets do jogo

1. Copie `.env.example` para `.env` e defina `PANGYA_DIR` com a pasta da sua instalação
   (a que contém os `projectg*.pak`).
2. Rode `pnpm assets:build`. Os arquivos vão para `assets/original/` e `assets/converted/`,
   que ficam fora do git.
3. Em dev, o cliente serve `assets/converted/` em `/game-assets/`.

Com `PANGYA_DIR` definido, `pnpm test` também roda os testes de integração com os assets reais.

## Estrutura

```
apps/client            cliente web (Vite + Three.js)
apps/server            servidor (Node)
packages/formats       parsers dos arquivos do jogo (.pak, .iff, .pet…)
packages/physics       física determinística da bola
packages/game          regras e estado da partida
packages/test-utils    utilitários de teste (ex.: describeWithAssets)
tools/asset-pipeline   CLI de extração/conversão de assets
docs/                  specs e decisões de arquitetura (ADRs)
```

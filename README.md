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

1. Coloque o cliente JP (com os patches aplicados) numa pasta `cliente-jp` **ao lado** deste
   repositório — ex.: `C:\Projects\PangyaWeb\cliente-jp` e `C:\Projects\PangyaWeb\PangyaWeb`.
   Para usar outro lugar, defina `PANGYA_DIR` no `.env` (veja `.env.example`).
2. Rode `pnpm assets:build`. Os arquivos vão para `assets/original/` e `assets/converted/`,
   que ficam fora do git.
3. Em dev, o cliente serve `assets/converted/` em `/game-assets/`.

Com o cliente disponível, `pnpm test` também roda os testes de integração com os assets reais.

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

## Ver um buraco real (Blue Lagoon)

Enquanto o leitor de `.pak` não tem um cliente com chave conhecida, dá para usar o Blue
Lagoon já extraído que está no repositório
[lbarceloss/pangya-pet_tools](https://github.com/lbarceloss/pangya-pet_tools) (`Blue Lagoon.zip`):

1. Baixe o zip e copie a pasta `Blue Lagoon\data\round02_blue` para
   `assets\original\data\round02_blue` (dentro deste repositório; a pasta `assets/` fica fora do git).
2. `pnpm dev` e abra http://localhost:5173/?curso=round02_blue&prefixo=blue&buraco=1
   (troque `buraco=1` por 1–18).

O terreno aparece colorido pelo tipo de piso (fairway, rough, green, bunker…) lido do
`blue_property.xml`; **M** alterna para a vista aérea.

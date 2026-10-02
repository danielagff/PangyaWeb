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

## Jogar com amigos (o seu PC é o servidor)

No Windows, clique duas vezes em **`servidor.cmd`**. Ele atualiza tudo, compila o jogo, liga
o servidor e abre a sala no navegador. Os amigos só precisam do navegador:

- **Mesma rede (Wi-Fi/cabo):** abrem `http://<seu IP>:7777/?online` (o endereço aparece na
  janela). Na primeira vez o Windows pergunta se libera o Node na rede: aceite.
- **Pela internet:** instale o cloudflared uma vez (`winget install Cloudflare.cloudflared`);
  o script cria um link público temporário e já copia para você colar no grupo.

Na sala, o primeiro a entrar (👑) escolhe o curso e quantos buracos e começa. O servidor
simula todas as tacadas (ninguém trapaceia) e manda o resultado para todos; joga quem está
mais longe do pin. Em qualquer sistema: `pnpm servidor`.

Teclas: ←/→ mira · espaço barra de força (3 toques) · M vista aérea · V som ·
N movimentos do personagem · T mapa de pisos · F névoa · C caixas de colisão.

Para jogar sozinho: **`jogar.cmd`** (ou `pnpm dev` e abrir `http://localhost:5173`).

## Mapeador de personagens

**`mapeador.cmd`** abre, separado do jogo (`http://localhost:7778`), um visualizador no estilo
do Mixamo: o personagem gira com o mouse, as animações aparecem traduzidas e separadas por
categoria (postura, cada taco, resultado do buraco, emoções do chat, itens…), com busca,
linha do tempo quadro a quadro e as peças (skins) por slot. Cada item tem um campo de
anotação; "Copiar lista" junta tudo para conferir os nomes com o jogo original.

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

```bash
pnpm assets:exemplo   # baixa e instala o Blue Lagoon de exemplo (precisa de git)
pnpm dev
```

Depois abra http://localhost:5173/?curso=round02_blue&prefixo=blue&buraco=1 (buraco de 1 a 18).
O curso vem de [lbarceloss/pangya-pet_tools](https://github.com/lbarceloss/pangya-pet_tools)
(`Blue Lagoon.zip`) e é instalado em `assets/original/data/round02_blue`, fora do git.

O terreno aparece colorido pelo tipo de piso (fairway, rough, green, bunker…) lido do
`blue_property.xml`; **M** alterna para a vista aérea.

# ADR 0001 — Engine de renderização: Three.js

- **Status:** aceita
- **Data:** 2026-10-01

## Contexto

O cliente web precisa renderizar os modelos originais convertidos para glTF (spec 05),
os cursos (spec 06) e rodar a 60 fps em hardware modesto. A física fica num pacote
separado (`@pangya/physics`) e não depende da engine.

## Opções

- **Three.js** — biblioteca de renderização enxuta, loader glTF maduro, enorme quantidade de
  exemplos; o resto (loop, cenas, UI) fica por nossa conta.
- **Babylon.js** — engine mais completa (inspector, física, GUI), porém mais pesada e opinativa.
- **Engine própria em WebGL/WebGPU** — controle total, custo alto sem ganho claro.

## Decisão

Three.js, com WebGL2. O jogo precisa de pouco além de renderização (física e regras são
nossas), e Three.js permite migrar para WebGPU (`WebGPURenderer`) mais tarde sem reescrever
a cena.

## Consequências

- Loop de jogo, gerenciamento de assets e UI são implementados no projeto.
- Debug visual com ferramentas externas (lil-gui, stats.js) quando necessário.

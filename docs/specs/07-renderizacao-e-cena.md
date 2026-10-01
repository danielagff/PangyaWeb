# 07 — Renderização e cena

- **Status:** rascunho
- **Fase:** 2 Engine
- **Depende de:** 01, 05, 06
- **Estimativa:** M

## Objetivo
Cliente web que carrega um buraco (real ou procedural), céu, iluminação, água e objetos,
rodando a 60 fps em hardware modesto.

## Escopo
**Inclui**
- Loader de buraco a partir de `hole.json` + `.glb`.
- Céu (skybox/gradiente), luz direcional + ambiente, sombras simples (só personagem e bola).
- Água com shader simples, vegetação/objetos do cenário.
- Visual igual ao original: mesmas texturas, materiais *unlit/lambert*, céus e efeitos do
  jogo; evitar PBR que mude a aparência dos assets.
- Gerenciador de assets com cache (IndexedDB) e barra de carregamento.
- Painel de debug (lil-gui / stats.js): wireframe, colisão, fps, posição da câmera.

**Não inclui**
- Câmera de jogo (spec 10), personagem (spec 12).

## Requisitos
1. Loop de jogo separado: `update(dt fixo)` da simulação vs `render(alpha)` interpolado.
2. Renderização não pode bloquear a física; a física não depende do Three.js.
3. Resolução dinâmica / limite de pixel ratio para notebooks.

## Critérios de aceite
- [ ] Buraco procedural e um buraco real renderizados com câmera livre de debug.
- [ ] 60 fps estáveis em GPU integrada em 1080p.
- [ ] Segundo carregamento do mesmo buraco vem do cache.

# 07 — Renderização e cena

- **Status:** em andamento
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
- Visual igual ao original: mesmas texturas, materiais _unlit/lambert_, céus e efeitos do
  jogo; evitar PBR que mude a aparência dos assets.
- Gerenciador de assets com cache (IndexedDB) e barra de carregamento.
- Painel de debug (lil-gui / stats.js): wireframe, colisão, fps, posição da câmera.

**Não inclui**

- Câmera de jogo (spec 10), personagem (spec 12).

## Requisitos

1. Loop de jogo separado: `update(dt fixo)` da simulação vs `render(alpha)` interpolado.
2. Renderização não pode bloquear a física; a física não depende do Three.js.
3. Resolução dinâmica / limite de pixel ratio para notebooks.

## Progresso

- Texturas reais: `.dds` decodificado em software (`packages/formats/src/dds`: DXT1/3/5 e
  formatos sem compressão por máscara), sem depender de S3TC na GPU. Imagens comuns
  (jpg/png/bmp) via `createImageBitmap`; máscara opcional `<nome>_mask.png` vira o alfa.
- Nomes de textura resolvidos pelo `_index.json` (nomes repetidos em vários cursos: prefere
  o da pasta do curso). Prefixos de material (ex.: `]2#_`) são tentados com e sem prefixo.
- Materiais como o GhostMapEditor: sem luz, recorte de alfa 0,5; texturas com `]` nos 5
  primeiros caracteres são transparentes (sem escrita de profundidade, desenhadas depois).
- Iluminação "assada" do terreno: cores por canto do `.gbin` 0x70/0x71
  (`Gbin.baseColors` → `baseCornerColors`), na ordem do GhostMapEditor. Versão 0x72 e as
  sombras do `.sbin` ainda não.
- Céu: cilindro com `<prefixo>_far.jpg`, topo/fundo com a cor média de `_up.jpg`/`_dn.jpg`.
- Névoa: `<prefixo>_fog.txt` (cor + perto/longe). Os valores parecem estar em jardas
  (800 unidades esconderiam o green); aplicados ×3,2 — **verificar** com o original.
- Teclas: T alterna texturas ↔ mapa de pisos (depuração), F liga/desliga a névoa.

## Critérios de aceite

- [ ] Buraco procedural e um buraco real renderizados com câmera livre de debug.
- [ ] 60 fps estáveis em GPU integrada em 1080p.
- [ ] Segundo carregamento do mesmo buraco vem do cache.

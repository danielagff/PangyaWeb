# 06 — Pipeline de cursos (mapas)

- **Status:** rascunho
- **Fase:** 1 Formatos
- **Depende de:** 03, 05
- **Estimativa:** G

## Objetivo

Para cada buraco: modelo visual (`.glb`) + dados de jogabilidade (`hole.json`) com malha de
colisão classificada por tipo de piso, posição do tee, posição do buraco (pin) e limites.

## Contexto

Cursos conhecidos incluem Blue Lagoon, Blue Water, Sepia Wind, Wind Hill, Wiz Wiz, West Wiz,
Blue Moon, Silvia Cannon, Ice Cannon, White Wiz, Shining Sand, Pink Wind, Deep Inferno,
Ice Spa, Lost Seaway, Eastern Valley, Ice Inferno, Wiz City, Abbot Mine, Mystic Ruins,
entre outros. Cada curso tem 18 buracos; cada buraco provavelmente tem modelo próprio,
dados de colisão/terreno separados do visual e vários pins possíveis (verificar).

Para a física, o essencial é o **tipo de superfície** de cada triângulo:
`tee | fairway | rough | bunker | green | water | ob | rock/wall | cart-path…`

## Escopo

**Inclui**

- Identificar e converter os arquivos de um buraco (comece por Blue Lagoon buraco 1).
- `hole.json`:
  ```ts
  interface HoleData {
    courseId: number
    hole: number
    par: 3 | 4 | 5
    tees: Vec3[]
    pins: Vec3[]
    collisionMesh: string // caminho para .bin (posições + índice + tipo por triângulo)
    surfaces: Record<SurfaceId, SurfaceKind>
    bounds: { min: Vec3; max: Vec3 }
    waterLevel?: number
  }
  ```
- Malha de colisão otimizada (BVH pré-calculada ou gerada no carregamento).
- Conversão em lote de todos os cursos/buracos, gerada em `assets/converted/courses/` (local).
- Opcional: buraco procedural simples no mesmo formato, para testes de física com geometria
  conhecida (green plano, rampa de 5°, etc.).

**Não inclui**

- Editor de cursos.

## Critérios de aceite

- [ ] Um buraco real convertido e renderizado com colisão alinhada ao visual.
- [ ] Debug view colorindo cada triângulo pelo tipo de superfície.
- [ ] Todos os cursos da versão de referência convertidos.

## Riscos e perguntas em aberto

- Se os tipos de superfície não estiverem em dados explícitos, podem estar codificados em
  material/textura — mapear material → tipo manualmente para o primeiro curso.

# 06 — Pipeline de cursos (mapas)

- **Status:** em andamento
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

## Andamento

- [x] Estrutura confirmada: buraco = `map/<curso>_NN.pet` (terreno) + `map/<curso>_NN.gbin`
      (cena) + `ase/*.pet` (objetos) + texturas `.dds`.
- [x] `readGbin` (câmeras, tee/pin, elementos com matriz, par e mapCheck) portado do
      GhostMapEditor; `holePoints` para tee e pin.
- [x] **Caixas de som** do `.gbin` (`readSoundBoxes` → `HoleData.ambient` e `npcs`): o nome é
      um som ambiente ("바다" = mar, a caixa cobre o campo todo no Blue Lagoon) ou um comando
      que põe **bichos no cenário** com a área onde ficam ("*type 0 *pet NPC_SeaGull.pet
      *num 5": gaivotas, borboletas, toupeira, golfinho, caranguejo). O som já toca; os bichos
      ainda não aparecem (falta desenhar e animar os `NPC_*.pet`).
- [x] Tipos de piso: textura do triângulo → classe do `<curso>_property.xml`
      (`readCourseProperty` / `surfaceOf`). Validado no Blue Lagoon buraco 1.
- [x] `.sbin` é só sombra assada (não é colisão) — opcional para o visual.
- [ ] O.B. (origem não confirmada).

## Riscos e perguntas em aberto

- Se os tipos de superfície não estiverem em dados explícitos, podem estar codificados em
  material/textura — mapear material → tipo manualmente para o primeiro curso.

- **Vida do cenário** (04/10/2026, `apps/client/src/hole/scene-life.ts`): objetos com ossos e
  animação própria (no Blue Lagoon: `blue_ship02` balançando e `blue_house02_lamp`) tocam a
  animação em laço, cada instância com a sua (antes eram desenhados parados); as partes
  "Night…" (janelas acesas, luzes) ficam escondidas nos cursos de dia. Os **bichos** das
  caixas "*type N *pet NPC_….pet *num K" do .gbin aparecem com a animação do arquivo
  (NPC_Default) e um movimento por tipo — aproximado, porque o caminho é código do jogo:
  0 gaivota voa em círculos na caixa; 1 borboleta passeia; 3 toupeira sai do chão e some;
  4 golfinho pula da água e some; 5 caranguejo anda de lado. Os modelos olham para −Z.
  Conferido na nuvem (buraco 1: 15 bichos, gaivotas batendo as asas de frente).

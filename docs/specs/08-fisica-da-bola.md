# 08 — Física da bola

- **Status:** em andamento
- **Fase:** 2 Engine
- **Depende de:** 01 (usa terreno procedural até a 06 ficar pronta)
- **Estimativa:** G

## Objetivo

Pacote `packages/physics` que, dados os parâmetros de uma tacada e o terreno, simula a
trajetória da bola até ela parar, de forma **determinística** e independente de renderização.

## Contexto

É o coração do jogo e a parte que mais vale a pena escrever do zero. O objetivo não é copiar
a fórmula exata do original (desconhecida), e sim **calibrar** o comportamento para "parecer
Pangya" usando medições do jogo original (vídeos, replays, tabelas de distância por taco).

Características do original a reproduzir:

- Distância máxima por taco depende de taco + atributos (power) + bola.
- Vento de 1 a 9 m/s com direção; afeta mais tacadas altas e longas.
- Diferença de altura entre bola e alvo altera o alcance.
- Spin (top/back) muda o quique e a rolagem; curve faz a bola fazer curva no ar.
- Tipo de piso onde a bola está reduz a força disponível (ex.: rough, bunker) e muda
  quique/rolagem onde ela cai.
- Tacadas especiais com trajetórias próprias (spec 09).

**Referência:** `Smart Calculator App/smart_calculator.js` do SuperSS-Dev (MIT) implementa o
lançamento oblíquo com resistência do ar e efeito Magnus obtido por engenharia reversa do
Pangya. Partir dele (portando para TypeScript determinístico) em vez de calibrar do zero; as
medições de referência passam a servir para validar.

## Escopo

**Inclui**

- Modelo de voo: gravidade, arrasto, sustentação (Magnus) simplificado, vento, curva.
- Contato com terreno: colisão contra malha (BVH), quique com restituição e atrito por
  tipo de superfície, rolagem com inclinação, parada por velocidade mínima.
- Água / OB: detecção e retorno do evento (`'water' | 'ob'`) para as regras.
- Entrada na cova (buraco): raio, velocidade máxima de captura, "lip-out".
- Previsão de trajetória (para a mira/HUD) usando a mesma simulação sem vento/aleatoriedade.
- Ferramenta de calibração: página que roda N tacadas e plota distância × taco × atributo,
  comparando com tabela de referência em `fixtures/calibracao.json`.

**Não inclui**

- Entrada do jogador (spec 09), visual (07/10).

## Requisitos

1. Passo fixo (ex.: 1/120 s), sem dependência de `Date`/`requestAnimationFrame`.
2. Determinismo: mesma entrada → mesma saída bit a bit em Node e navegadores. Evitar
   `Math.sin/cos/pow/exp` nativos nos caminhos críticos (podem variar entre engines);
   usar implementações próprias ou tabelas. RNG próprio com seed.
3. API pura:
   ```ts
   interface ShotInput {
     origin: Vec3
     aimYaw: number // direção
     club: ClubData
     power: number // 0..1 da barra
     impactError: number // -1..1 (0 = perfeito)
     spin: number
     curve: number // -1..1, ponto de contato na bola
     special?: 'tomahawk' | 'spike' | 'cobra'
     powerShot: 0 | 1 | 2
     lie: SurfaceKind
     wind: Wind
     stats: Stats
     seed: number
   }
   interface ShotResult {
     frames: Float32Array // posições amostradas para replay
     events: ShotEvent[] // 'land' | 'bounce' | 'hole' | 'water' | 'ob' | 'stop'
     final: { position: Vec3; lie: SurfaceKind }
   }
   function simulateShot(input: ShotInput, terrain: Terrain): ShotResult
   ```
4. Todos os coeficientes em `physics.config.ts`, documentados, para calibração.

## Critérios de aceite

- [ ] Testes de golden-file: 50 tacadas fixas geram exatamente os mesmos resultados no CI
      (Node) e num teste de navegador (Playwright).
- [ ] Distâncias sem vento dentro de ±3% da tabela de referência para cada taco.
- [ ] Bola não atravessa terreno em nenhum dos testes de stress (tacadas aleatórias).
- [ ] Simulação completa de uma tacada de driver em < 5 ms.

## Andamento

- [x] Voo portado do `smart_calculator.js` (SuperSS-Dev, MIT): arrasto, Magnus, vento, curva,
      spin, power shot e tacadas especiais (Tomahawk, Spike, Cobra), passo fixo de 0,02 s.
- [x] Tabela dos 15 tacos, força/alcance por categoria (madeira, ferro, wedge, putter).
- [x] Testes: determinismo, regressão de distâncias, vento, curva, tacadas especiais.
- [x] Demonstração no cliente (`pnpm dev`) com painel de parâmetros.
- [ ] Quique e rolagem por tipo de piso. **No Pangya quem simula é o cliente**: o servidor
      (SuperSS-Dev) só recebe o resultado em `ShotSyncData` (posição final, OB/no buraco/
      jogável, flag de bunker, pang) e confia nele — por isso o SuperSS não tem quique/rolagem
      (`Game Server/TYPE/game_type.hpp`, `GAME/*::requestTranslateSyncShotData`). O
      `QuadTree3D` do servidor só simula o voo, para posicionar moedas/cubos
      (`GAME/coin_cube_location_update_system.cpp`). Plano: modelo próprio de quique/rolagem
      com coeficientes por piso e por bola (`Ball.iff` tem `bound` e `roll`), calibrado com o
      cliente original jogando contra um SuperSS local, cujos logs registram a posição final
      de cada tacada.
- [ ] Colisão com a malha do terreno (depende da spec 06).
- [x] **Coeficientes de quique e rolagem por piso encontrados:** `<curso>_property.xml`
      (`bound`/`roll` por classe de textura; ex. Blue Lagoon: green 0.3/0.18, fairway
      0.4/0.2, rough 0.2/0.42, bunker 0.1/0.6, estrada 0.7/0.1). Leitor em
      `packages/formats/src/course/property.ts`. Falta a fórmula de como o jogo os aplica.
- [ ] Putt (spec 11).
- [x] **A barra é a distância de verdade** (decisão do Daniel, 03/10/2026; não precisa ser
      igual ao original, precisa dar para calcular): no plano, sem vento, com a bola no
      centro (sem spin/curva) e piso 100%, x% da barra cai a x% do alcance do taco — o número
      da barra (ex.: pin a 115y, 1W de 230y, 50% cai no pin). `barLaunchScale` em
      `flight.ts` acha por busca a velocidade de saída que dá essa distância (erro < 0,002 y,
      guardada por taco/faixa/força/PS/%); o resto do voo é o do SuperSS, então vento,
      desnível, spin, curva, piso e especiais mudam a distância a partir daí. Antes, no
      modelo do SuperSS (√força), 100% voava ~83% da barra e 50% só 42% da distância. O
      modelo antigo continua nos testes de referência (`launchScale: √força`).
      Conferido no Blue Lagoon: 1W a 25/50/75/100% no plano = 57,5/115/172,5/230 y; no
      buraco 1 o fairway fica ~4 m abaixo do tee e a bola vai mais longe (desnível); nos
      buracos 2 e 6 (par 3), a força certa já contando o desnível dá Hole in One sem vento.
- [ ] Com a bola saindo mais rápida, a **curva** abre mais: 1W a 100% com curva máxima cai
      ~12 y ao lado da mira (no SuperSS ~1 y; a 50–75% já caía 15–25 y ao lado nos dois).
      Ajustar junto com as **tacadas especiais** (tomahawk, spike, cobra), que também ainda
      usam partes da conta antiga (`percentSqrt`).

## Colisão com objetos

- Caixas do próprio jogo: `map/_coll/<prefixo>_NN.pycb` (formato documentado em
  `packages/formats/src/pycb/pycb.ts`). Sem o arquivo, as mesmas caixas são geradas dos
  blocos COLL dos .pet (osso + matriz da instância) — conferido: 452 de 452 caixas iguais
  no Blue Lagoon 1.
- Ficam de fora as caixas de efeito (`Day_Only`, `Night_Only`, `Window_glow`…) e as
  degeneradas (±99999).
- `Obstacles` (physics): teste exato segmento × caixa orientada, com grade espacial. Vale no
  voo (o voo termina e a bola segue rebatida), nos quiques e na rolagem.
- Resposta ao choque (`OBSTACLE_TUNING`: restituição 0,3, sobra tangencial 0,5) é
  estimativa — entra na calibração final.
- Tecla C no cliente mostra as caixas.

## Calibração final do quique e da rolagem (adiada para o fim)

Os valores de `GROUND_TUNING` são uma estimativa: nenhuma referência pública tem essa parte
(a calculadora do SuperSS e o GhostPro só fazem o voo). Plano para deixar igual ao original,
combinado para depois de terminar o resto do jogo:

1. Ferramenta de calibração: lê tacadas reais (CSV), simula no mesmo buraco, mostra o erro
   e ajusta as constantes automaticamente.
2. Gravar tacadas reais: o cliente original manda ao servidor `ShotData` (entradas),
   `ShotEndLocationData` (estado da bola) e `ShotSyncData` (onde parou, O.B., cova) — ver
   `game_type.cs` do Pangya-Server-Community. Adicionar log em CSV no servidor local e
   jogar ~40–60 tacadas variadas (pisos, spin, putts planos e inclinados).
3. Se o erro continuar grande em algum caso, mudar o formato do modelo, não só os números.
4. Último recurso: engenharia reversa do executável (parece compactado/protegido).

## Riscos e perguntas em aberto

- Falta de dados de referência: montar a tabela assistindo vídeos/replays com distância
  exibida no HUD do original.

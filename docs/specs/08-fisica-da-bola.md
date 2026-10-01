# 08 — Física da bola

- **Status:** rascunho
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

## Riscos e perguntas em aberto

- Falta de dados de referência: montar a tabela assistindo vídeos/replays com distância
  exibida no HUD do original.

# 09 — Mecânica de tacada (barra de força, impacto, spin, especiais)

- **Status:** rascunho
- **Fase:** 2 Engine
- **Depende de:** 08
- **Estimativa:** M

## Objetivo
Implementar a interação do jogador que gera um `ShotInput`: mira, escolha do taco,
ponto de contato na bola, barra de força em dois cliques e tacadas especiais.

## Contexto (comportamento do original — verificar detalhes)
- **Barra:** 1º clique define a força (a barra sobe), 2º clique define o impacto quando o
  cursor volta; acertar a zona "Pangya!" dá impacto perfeito. Errar desvia a bola
  (hook/slice) proporcionalmente ao erro.
- A largura da zona de impacto depende dos atributos (control/accuracy) e do piso.
- **Power Shot:** consome a barra de PS (enchida acertando Pangyas); aumenta a distância e
  estreita a zona de impacto. Existe Double Power Shot.
- **Spin/curve:** o jogador move o ponto de contato na bola antes da tacada.
- **Tacadas especiais** (com power shot + combinação de ponto de contato/entrada):
  - *Tomahawk*: alta, cai quase sem rolar.
  - *Spike*: sobe muito e desce "cravando" com efeito.
  - *Cobra*: sai baixa e sobe no final da trajetória.
- **Inclinação/piso:** % de força disponível mostrada no HUD conforme o piso.

## Escopo
**Inclui**
- Máquina de estados: `aim → choose-club → set-spin → swing(power) → swing(impact) → flight`.
- Barra com velocidade configurável, zona Pangya, zona de erro, power shot.
- Controles: teclado + mouse (padrão do original) e toque (celular, opcional).
- Seleção automática do taco sugerido pela distância até o pin.
- Testes de unidade da máquina de estados com entradas simuladas.

**Não inclui**
- Cartas/itens que alteram a tacada (pode virar spec futura).

## Contratos / interfaces
```ts
type ShotPhase = 'aim' | 'power' | 'impact' | 'flight' | 'done'
interface ShotController {
  phase: ShotPhase
  press(): void            // espaço/clique
  setAim(yaw: number): void
  setContact(spin: number, curve: number): void
  togglePowerShot(): void
  toShotInput(): ShotInput // spec 08
}
```

## Critérios de aceite
- [ ] Jogável no buraco procedural: mirar, escolher taco, bater, ver a bola voar.
- [ ] Acertar a zona Pangya produz `impactError = 0` e feedback visual/sonoro.
- [ ] As três tacadas especiais produzem trajetórias visivelmente distintas.
- [ ] A barra funciona igual a 30, 60 e 144 fps (independe do frame rate).

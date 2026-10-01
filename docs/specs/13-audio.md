# 13 — Áudio

- **Status:** rascunho
- **Fase:** 2 Engine
- **Depende de:** 03, 09
- **Estimativa:** P

## Objetivo
Efeitos sonoros e música tocando nos eventos certos.

## Escopo
**Inclui**
- Web Audio API com mixer (música, efeitos, vozes) e volumes configuráveis.
- Mapa evento → som: tacada (por tipo/qualidade), Pangya, quique por superfície, água,
  entrada na cova, vozes do personagem, música por curso.
- Desbloqueio de áudio após primeira interação (exigência dos navegadores).
- Placeholders livres de direitos para rodar sem assets.

## Critérios de aceite
- [ ] Todos os eventos da física e da tacada têm som associado.
- [ ] Configurações de volume persistem entre sessões.

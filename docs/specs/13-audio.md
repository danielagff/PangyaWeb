# 13 — Áudio

- **Status:** em andamento
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
- Usar os sons, vozes e músicas originais (convertidos para formato web pelo pipeline).

## Progresso

- A física marca o quadro de cada evento (quique, rolagem, colisão, água, cova…); o
  `HoleWorld` monta a linha do tempo da tacada (`PlayedShot.events`), que também vai pela
  rede no multiplayer.
- `apps/client/src/audio/sounds.ts`: quique e rolagem usam os `.wav` de cada piso do
  property.xml (`bound_sound`/`roll_sound`); batida, "Pangya!", cova e água procuram
  arquivos por padrão de nome (a confirmar com a extração completa — o escolhido aparece
  no console). Sem arquivo, o som é sintetizado com Web Audio.
- Tecla V liga/desliga (lembrado no navegador). Pulando a animação, só tocam a batida e o
  som final.
- Ainda não: música do curso, vozes dos personagens, volume por categoria.

## Critérios de aceite

- [ ] Todos os eventos da física e da tacada têm som associado.
- [ ] Configurações de volume persistem entre sessões.

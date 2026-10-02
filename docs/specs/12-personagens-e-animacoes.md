# 12 — Personagens e animações

- **Status:** em andamento
- **Fase:** 2 Engine
- **Depende de:** 05, 09
- **Estimativa:** M

## Objetivo

Personagem jogável (com partes/roupas e taco) animado e sincronizado com a tacada.

## Contexto

Personagens do original incluem Nuri, Hana, Azer, Cecilia, Max, Kooh, Arin, Kaz, Lucia,
Nell, Spika, entre outros. Roupas/acessórios são partes trocáveis; também existem caddies
e mascotes.

## Escopo

**Inclui**

- Composição de personagem: corpo base + partes (cabelo, roupa, luvas, sapatos) + taco
  preso ao osso da mão.
- Máquina de animações: idle, preparar, backswing (sincronizado com a barra), impacto,
  follow-through, reações (comemoração, frustração).
- O impacto da animação dispara a física no momento certo.
- Usar as animações originais do jogo, inclusive as de reação e de cada tipo de tacada.

**Não inclui**

- Caddie e mascote (spec futura), loja de roupas (spec 15).

## Progresso

- Catálogo (`tools/asset-pipeline/src/characters.ts` → `assets/original/_characters.json`,
  gerado junto com o índice): cada `.bpet` com o `.apet` e as `.mpet` da mesma pasta,
  peças por slot (2º pedaço do nome: ha, fc, ts, pv, ft, hn…; `!xx` = slots escondidos) e
  uma roupa padrão (uma peça por slot básico, preferindo as que não escondem outras).
- Montagem (`apps/client/src/character/character.ts`): ossos do .bpet; cada peça é um
  SkinnedMesh com as inversas da pose de repouso _da peça_ — mesma conta do
  pet-source_tools (Σ wᵢ · Bpet[i] · Mpet[i]⁻¹ · Mpet[principal] · v).
- Animação: um clipe por "motion" do .apet, amostrado a 30 quadros/s; rotação gravada
  invertida (x,y,z,w); posição/rotação/escala locais ao pai, com a pose de repouso onde
  faltam chaves.
- Em jogo: só o personagem da vez aparece, ao lado da bola (destro, alvo à esquerda),
  parado; na tacada faz o swing do taco e a bola sai no impacto (`CHARACTER_TUNING`).
  Escolha do personagem no menu e na sala; tecla N percorre os movimentos.
- Validado com um personagem sintético no formato real (8 ossos, peças com pesos em 2
  ossos, motions stand/swing). **A conferir com os arquivos reais:** nomes dos movimentos
  (padrões `IDLE_MOTIONS`/`SWING_MOTIONS` em hole-view.ts), para onde o modelo olha
  (`facingDegrees`), a escala e o momento do impacto.
- Ainda não: trocar roupa/peças na interface, expressões faciais (FANM), taco na mão.
- Taco encostando no chão: na postura de preparação, `fitClub` estica/encolhe o taco a
  partir da mão (0,75–1,5×, `CLUB_FIT`) para a cabeça tocar o chão debaixo da bola.

## Critérios de aceite

- [ ] Um personagem completo com taco executando a tacada inteira em sincronia.
- [ ] Troca de pelo menos uma parte (ex.: roupa) em tempo de execução.

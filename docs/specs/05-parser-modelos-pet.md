# 05 — Parser de modelos `.pet` → glTF

- **Status:** em andamento
- **Fase:** 1 Formatos
- **Depende de:** 03
- **Estimativa:** G

## Objetivo

Converter modelos do jogo (personagens, tacos, bolas, objetos de cenário) para glTF 2.0
(`.glb`), com malha, materiais, esqueleto e animações.

## Contexto

O formato `.pet` (e variantes `.apet`, `.bpet`, `.mpet`) é baseado em blocos/chunks com
tag de 4 caracteres + tamanho (verificar), contendo coisas como versão, lista de texturas,
materiais, ossos, malha (vértices, normais, UVs, pesos), frames/animações e possivelmente
colisão. Converter para glTF permite usar o loader padrão do Three.js e validar visualmente
no Blender ou em visualizadores online.

## Escopo

**Inclui**

- Leitor genérico de chunks que loga tags desconhecidas sem quebrar.
- Decodificação de: malha estática → malha com skinning → animações.
- Exportador glTF (pode usar `@gltf-transform/core`).
- Ferramenta de inspeção: `asset-pipeline pet-info arquivo.pet` (lista chunks e tamanhos).
- Página de debug no cliente (`/viewer`) para abrir qualquer `.glb` convertido.

**Não inclui**

- Efeitos especiais (partículas), shaders customizados do jogo.

## Requisitos

1. Implementar em etapas, cada uma com critério próprio:
   1. objeto estático (ex.: bola) com textura;
   2. taco;
   3. personagem em pose de repouso com skinning;
   4. animações do personagem.
2. Sistema de coordenadas e escala convertidos para glTF (Y para cima, metros) —
   documentar a transformação aplicada.

## Critérios de aceite

- [ ] `.glb` de bola, taco e um personagem abrem corretamente no Blender e no `/viewer`.
- [ ] Pelo menos a animação de tacada (swing) e a de espera (idle) tocam corretamente.
- [ ] Testes unitários com chunks sintéticos no CI.
- [ ] Todos os modelos e animações do jogo convertidos em lote para
      `assets/converted/models/` (local); lista de arquivos que falharam no relatório do pipeline.

## Andamento

- [x] `readPet` (TEXT, BONE, MESH, ANIM, MOTI, COLL) portado do GhostMapEditor; `.apet/.bpet/.mpet`.
- [x] `petToSubMeshes`: pose de repouso agrupada por textura, ordem dos cantos preservada.
- [x] Testes com `.pet` sintético.
- [ ] Exportar para glTF e testar com arquivos reais (depende de um cliente com chave conhecida).

## Riscos e perguntas em aberto

- É a tarefa de engenharia reversa mais pesada. Mitigação: procurar documentação da
  comunidade antes; enquanto não ficar pronta, as outras specs usam primitivas simples
  (esfera, cápsula) só para não ficarem bloqueadas.
- Partes de personagem (roupas/cabelo) são modelos separados anexados a ossos — definir
  como compor no cliente (spec 12).

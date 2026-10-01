# PangyaWeb — Specs

Projeto pessoal: recriar uma versão jogável de Pangya rodando no navegador, o mais fiel
possível ao original — mesmos modelos, animações, texturas, sons, cursos e dados.

## Política de assets

- O jogo **usa os assets originais como estão** (modelos, animações, texturas, sons, UI,
  tabelas `.iff`, cursos) — nada de substitutos genéricos.
- Os assets **ficam só na máquina local, fora do git**. O repositório contém apenas código
  e documentação.
- Estrutura local (ignorada pelo git): `assets/original/` (extraído dos `.pak`, intocado) e
  `assets/converted/` (glTF, JSON, áudio web gerados pelo pipeline). Tudo é regenerável a
  partir da instalação do cliente apontada por `PANGYA_DIR`:
  `pnpm assets:build` → extrai e converte.
- Testes em dois níveis:
  - **unitários** com dados sintéticos gerados no próprio teste — rodam no CI e na nuvem;
  - **de integração** com os assets reais — rodam localmente quando `PANGYA_DIR` está
    definido e são pulados automaticamente quando não está.

## As duas abordagens

|                        | A. Rodar o cliente original no navegador                           | B. Reescrever para web aos poucos                                    |
| ---------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Como                   | Emular x86 + Windows + Direct3D 9 (Boxedwine, v86 + Windows, etc.) | Cliente novo em TypeScript + WebGL/WebGPU que lê os assets originais |
| Rede                   | Navegador não abre TCP cru → precisa de proxy WebSocket→TCP        | Protocolo próprio (WebSocket) ou ponte para servidor emulador        |
| Performance            | Muito baixa (emulação de CPU + tradução D3D9→WebGL)                | Nativa do navegador                                                  |
| Anti-cheat / proteções | GameGuard/packers costumam quebrar em emuladores                   | Não se aplica                                                        |
| Resultado              | "Funciona" com sorte, difícil de evoluir                           | Código seu, evolutivo, testável                                      |

**Recomendação:** abordagem **B**, com um _spike_ curto e com prazo fixo para a A
(spec [`90-spike-cliente-original-no-navegador.md`](./90-spike-cliente-original-no-navegador.md)),
só para tirar a dúvida. A reescrita pode ser incremental: primeiro um "range" de treino
offline com física, depois um curso completo, depois multiplayer.

## Roadmap (fases e specs)

| Fase       | Spec                                                                            | Entrega                                              |
| ---------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 0 Fundação | [01](./01-setup-do-projeto.md) Setup do projeto                                 | Monorepo, build, testes, CI                          |
|            | [02](./02-inventario-de-assets.md) Inventário de assets                         | Mapa de todos os arquivos/formatos do cliente        |
| 1 Formatos | [03](./03-parser-pak.md) Parser `.pak`                                          | Extrair arquivos dos pacotes                         |
|            | [04](./04-parser-iff.md) Parser `.iff`                                          | Tabelas de itens, tacos, personagens, cursos em JSON |
|            | [05](./05-parser-modelos-pet.md) Parser de modelos `.pet`                       | Malhas, ossos, animações → glTF                      |
|            | [06](./06-pipeline-de-cursos.md) Pipeline de cursos                             | Terreno, tipos de piso, buracos, colisão             |
| 2 Engine   | [07](./07-renderizacao-e-cena.md) Renderização e cena                           | Curso visível no navegador                           |
|            | [08](./08-fisica-da-bola.md) Física da bola                                     | Simulação determinística da tacada                   |
|            | [09](./09-mecanica-de-tacada.md) Mecânica de tacada                             | Barra de força, impacto, spin, tacadas especiais     |
|            | [10](./10-camera-e-hud.md) Câmera e HUD                                         | Mira, vento, distância, inclinação                   |
|            | [11](./11-green-e-putt.md) Green e putt                                         | Grade de inclinação, putt, "chip-in"                 |
|            | [12](./12-personagens-e-animacoes.md) Personagens e animações                   | Personagem animado executando a tacada               |
|            | [13](./13-audio.md) Áudio                                                       | Efeitos e música                                     |
| 3 Jogo     | [14](./14-regras-e-modo-offline.md) Regras e modo offline                       | Partida completa de 18 buracos single-player         |
|            | [15](./15-interface-e-menus.md) Interface e menus                               | Seleção de personagem, curso, inventário             |
| 4 Online   | [16](./16-servidor-e-protocolo.md) Servidor e protocolo                         | Login, salas, persistência                           |
|            | [17](./17-multiplayer.md) Multiplayer                                           | Partida com 2–4 jogadores sincronizada               |
| Spike      | [90](./90-spike-cliente-original-no-navegador.md) Cliente original no navegador | Relatório go/no-go da abordagem A                    |

Dependências principais: `01 → 02 → (03 → 04, 05, 06)`; `07 ← 05, 06`; `08` pode começar
logo após `01` com terreno procedural; `09 ← 08`; `14 ← 08–12`; `17 ← 14, 16`.

## Formato de cada spec

Todas as specs seguem o [`TEMPLATE.md`](./TEMPLATE.md): objetivo, contexto, escopo,
requisitos, contratos/interfaces, critérios de aceite, dependências, riscos e perguntas
em aberto. Itens marcados com **(verificar)** são suposições sobre o jogo original ou
sobre formatos de arquivo que precisam ser confirmadas na prática ou em documentação
da comunidade antes de virar código.

## Status

Use o cabeçalho de cada spec (`Status: rascunho | pronta | em andamento | concluída`)
para acompanhar o andamento.

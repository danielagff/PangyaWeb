# Referência: SuperSS-Dev

Repositório: https://github.com/Acrisio-Filho/SuperSS-Dev — simulador (servidor privado)
de Pangya feito por Acrisio Filho, **licença MIT**. Pode ser estudado e ter código portado
para este projeto, desde que o aviso de copyright do MIT seja mantido nos arquivos portados:

```
// Portado de SuperSS-Dev (https://github.com/Acrisio-Filho/SuperSS-Dev)
// Copyright (c) 2021 Acrisio Fragoso Vieira Filho — Licença MIT
```

Clone local sugerido: ao lado deste repositório (`../SuperSS-Dev`), apontado por
`SUPERSS_DIR` no `.env`.

## O que ele tem e onde usar

| Conteúdo no SuperSS-Dev                                                                  | Para que serve aqui                                                                                                            | Spec       |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `Server Lib/IFF Manager/IFF Manager/data/pangya_jp*.iff`                                 | Tabelas reais do jogo (versão **JP**, ~962–994): Character, Part, Club, ClubSet, Ball, Course, Card, Caddie, Mascot…           | 04         |
| `Server Lib/Projeto IOCP/TYPE/data_iff.h`                                                | Layout de todos os registros `.iff` (struct `Base`, `Character`, `ClubSet`…)                                                   | 04         |
| `Tools/lzpak.cpp`                                                                        | Formato dos `.pak` (cabeçalho, entradas, LZ77) e descompressão                                                                 | 03         |
| `Tools/CryptXTEA.*`, `gbin_to_text.cpp`, `sbin_to_text.cpp`, `puppet_to_text.cpp`        | Outros formatos de arquivo do cliente                                                                                          | 02, 05, 06 |
| `Smart Calculator App/smart_calculator.js` + `Server Lib/Smart Calculator lib`           | Física da tacada obtida por engenharia reversa: lançamento oblíquo com arrasto + efeito Magnus, power shot, inclinação, desvio | 08, 09     |
| `Server Lib/Game Server/GAME/*` (`game`, `hole`, `course`, `match`, `practice`, `room`…) | Regras, fluxo de partida, modos de jogo                                                                                        | 14, 17     |
| `Server Lib/Projeto IOCP/CRYPT`, `PACKET`, `Game Server/PACKET`                          | Protocolo de rede e criptografia do cliente original                                                                           | 16         |
| `bk-squema-*.sql`                                                                        | Esquema do banco (jogador, inventário, etc.)                                                                                   | 16         |

## O que ele **não** tem

Os assets do **cliente**: modelos 3D (`.pet`), texturas, cursos, sons e UI ficam nos
`projectg*.pak` da instalação do cliente, que não faz parte do SuperSS-Dev. Para as specs
05, 06, 07, 12 e 13 é preciso uma instalação do cliente **JP** compatível com a versão dos
`.iff` acima (`PANGYA_DIR`).

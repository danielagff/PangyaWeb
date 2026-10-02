# Estado do projeto — onde estamos e o que falta

> Resumo vivo do PangyaWeb: o que estamos fazendo, o que já funciona, o que está em
> andamento, o que falta, as decisões tomadas e os projetos de referência que estudamos.
> Atualizado a cada entrega (última: 02/10/2026). Detalhes técnicos de cada parte ficam nas
> [specs](./specs/README.md).

## O que estamos fazendo

Recriando o **Pangya** para rodar no navegador (TypeScript + Three.js), usando os **arquivos
originais do jogo** (modelos, texturas, cursos, sons, tabelas). É um projeto **pessoal**:
jogar com amigos, com o **PC do Daniel como servidor**. Não é vendido nem publicado.

- Os assets ficam **só no PC** (pasta `assets/`, fora do git). O repositório tem só código e
  documentação.
- Tudo roda com **um clique** no Windows:

  | Arquivo        | O que faz                                                                                                                               |
  | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
  | `servidor.cmd` | Atualiza (git pull), compila e liga o jogo em `http://localhost:7777`; cria o link para os amigos (cloudflared). Fecha servidor antigo. |
  | `mapeador.cmd` | Mesmo processo, abre o **mapeador de personagens** em `http://localhost:7778` (também em `:7777/mapeador.html`).                        |
  | `jogar.cmd`    | Modo de desenvolvimento sozinho (`pnpm dev`, porta 5173).                                                                               |

- O menu mostra a **versão** (commit) ao lado do título — serve para conferir se o PC
  atualizou.

## O que já funciona

| Área                    | Situação                                                                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extração dos arquivos   | `.pak` (chave JP), `.iff`, `.pet/.bpet/.apet/.mpet`, `.gbin`, `property.xml`, `.dds`, `.pycb`; índice de nomes e catálogo de personagens.                                                                                  |
| Cursos                  | Buracos reais com texturas, céu, névoa, iluminação assada, objetos; cova e bandeira em escala; grade do green.                                                                                                             |
| Física                  | Voo da bola portado do SuperSS-Dev; quique, rolagem e putt no terreno real; colisão com árvores/objetos pelas caixas `.pycb`; água, O.B., bunker.                                                                          |
| Tacada                  | Barra de força em 3 toques com erro de impacto ("Pangya!"), mira, vento, spin, curva, power shot, sugestão de taco.                                                                                                        |
| Regras                  | Buraco completo (par, penalidades, chip-in), placar entre buracos.                                                                                                                                                         |
| Multiplayer             | Servidor no PC do anfitrião; sala com chat, escolha de personagem, curso e buracos; turnos (honra no tee, depois o mais longe do pin); placar; o servidor simula as tacadas.                                               |
| Personagens             | 15 personagens montados com skinning; animações reais do jogo (preparação, backswing, swing, andar de lado, comemorações); taco na mão (Bone01); rosto pelo bloco FANM; posicionado com a cabeça do taco na bola.          |
| Mapeador de personagens | Estilo Mixamo (girar, zoom, linha do tempo quadro a quadro); animações **traduzidas e separadas por categoria**; peças por categoria com **base × acessório**; anotações salvas; "usar como roupa padrão"; "copiar lista". |
| Sons                    | Linha do tempo da tacada (batida, quiques, rolagem, colisão, cova) com os sons de piso do jogo ou sintetizados.                                                                                                            |
| Atualização             | Scripts avisam se o `git pull` falhar; o navegador sempre confere se os arquivos mudaram (sem precisar limpar cache).                                                                                                      |

## Em andamento agora

**Personagens corretos, com a ajuda do Daniel no mapeador.**

1. O Daniel confere no mapeador (`mapeador.cmd`) o que é cada animação e cada peça, anota e
   manda a lista ("Copiar lista") no chat.
2. Com isso: corrigir os nomes/traduções marcados com "?", o **quadro exato do impacto** do
   swing de cada taco, a roupa padrão de cada personagem e a posição do personagem na bola.

Regras de nomes de peças já confirmadas pelo Daniel (implementadas em
`packages/formats/src/pet/part-name.ts`):

- `<letra>_<slot>_<código>`: a letra liga a peça ao personagem (`h_` = Kaz, `h_def.bpet`).
- Slots: `fc` rosto, `ha` cabelo, `ts` tronco/camisa (alguns são vestidos), `pv` calça/saia,
  `ft` pés, `hn` mãos, `wi` asas, e vários itens (brinco, arma, veículos…).
- Código numérico = peça base (`ha_01` é o cabelo padrão; o **rosto é `fc_01_!fc`**). Código
  com letra = acessório (`fc_a_z01`, `ha_a09_!ha`), que vai junto com a base (rosto +
  acessório de rosto).
- Roupa padrão automática = base de menor número de cada categoria. Exceções (ex.: a mão sem
  luva da Cecilia R é `cc_hn_28`) são escolhidas no mapeador com "usar como roupa padrão"
  (gravado em `assets/converted/data/roupas-padrao.json`).

## O que falta (em ordem)

1. **Personagens**: aplicar as anotações do mapeador (impacto do swing, nomes, roupas),
   conferir a frente do modelo e a posição na bola com os personagens reais.
2. **Sons**: mapear os efeitos e as vozes ("Pangya!", birdie…) — falta a parte "== SONS" do
   diagnóstico (`?diagnostico`) para saber os nomes dos arquivos; música do curso; volume.
3. **Interface e menus** (spec 15): escolha de personagem/curso mais bonita, fluxo de 18
   buracos, resultado final.
4. **Problema conhecido**: tela inteira azul depois de várias tacadas no Pink Wind 1 (spec 10)
   — ainda não reproduzido.
5. **Calibração final do quique e da rolagem** (spec 08), combinada para o fim: gravar
   tacadas reais e ajustar as constantes até ficar igual ao original.
6. Depois: itens/cartas/caddies, mais modos de jogo, polimento visual.

## Decisões tomadas

- **Reescrever para web** (abordagem B), em vez de emular o cliente original
  ([ADR 0001](./adr/0001-engine.md)).
- **Assets só no PC**, nunca no git.
- **Física própria**: o voo vem do SuperSS-Dev (MIT); quique e rolagem são modelo nosso,
  calibrado no fim. O Leonardo Barcelos (autor do GhostPro) confirmou: "isso é motor
  dinâmico do Pangya, você pode criar o seu próprio".
- **Não descompilar o GhostPro** (produto pago e fechado de outra pessoa). Ele só faz o voo,
  que já temos.
- **Servidor autoritativo** no PC do anfitrião: o servidor simula as tacadas e manda o
  resultado para todos (ninguém trapaceia).
- **Trabalho feito na nuvem** (Claude Code) para usar os créditos da sessão; no PC só os
  scripts de um clique.

## Projetos de referência que estudamos

Detalhes em [`referencias/superss-dev.md`](./referencias/superss-dev.md) e
[`referencias/ghostmapeditor.md`](./referencias/ghostmapeditor.md).

| Projeto                                                                            | Licença | O que tiramos dele                                                                                 |
| ---------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| [SuperSS-Dev](https://github.com/Acrisio-Filho/SuperSS-Dev) (Acrisio Filho)        | MIT     | Tabelas `.iff` reais, formato `.pak`, **física do voo** (portada), regras e protocolo.             |
| [GhostMapEditor](https://github.com/lbarceloss/GhostMapEditor) (Leonardo Barcelos) | MIT     | Leitura de `.pet`, `.gbin`, terreno, `.dds`; ordem das cores assadas.                              |
| [pet-source_tools](https://github.com/Acrisio-Filho/pet-source_tools)              | sem     | Só documentação de formato: `.pet/.apet/.bpet/.mpet`, `.sbin`, bloco **FANM** (texturas do rosto). |
| [pangya-pet_tools](https://github.com/lbarceloss/pangya-pet_tools) + guia PDF      | —       | Guia de mapas e personagens conferido no IDA; `Blue Lagoon.zip` usado como curso de exemplo.       |
| [PangYa-Map-Toolkit](https://github.com/lbarceloss/PangYa-Map-Toolkit)             | GPL-3.0 | Só referência (não copiar código): estrutura de um buraco, ordem dos vértices.                     |
| [dx9-collision-boxes](https://github.com/lbarceloss/dx9-collision-boxes)           | sem     | Formato `.pycb` (caixas de colisão por buraco) — usado na colisão com objetos.                     |
| [GhostPro](https://github.com/lbarceloss/GhostPro)                                 | sem     | Calculadora (port do SuperSS, só voo). Nada novo; decidido não descompilar.                        |
| Pangya-Server-Community (`game_type.cs`)                                           | —       | Mensagens `ShotData`/`ShotSyncData`, para gravar tacadas reais na calibração final.                |

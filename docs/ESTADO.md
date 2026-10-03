# Estado do projeto — onde estamos e o que falta

> Resumo vivo do PangyaWeb: o que estamos fazendo, o que já funciona, o que está em
> andamento, o que falta, as decisões tomadas e os projetos de referência que estudamos.
> Atualizado a cada entrega (última: 03/10/2026). Detalhes técnicos de cada parte ficam nas
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

| Área                    | Situação                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Extração dos arquivos   | `.pak` (chave JP), `.iff`, `.pet/.bpet/.apet/.mpet`, `.gbin`, `property.xml`, `.dds`, `.pycb`; índice de nomes e catálogo de personagens.                                                                                                                                                                                                                                                                    |
| Cursos                  | Buracos reais com texturas, céu, névoa, iluminação assada, objetos; cova e bandeira em escala; grade do green.                                                                                                                                                                                                                                                                                               |
| Física                  | Voo da bola portado do SuperSS-Dev; quique, rolagem e putt no terreno real; colisão com árvores/objetos pelas caixas `.pycb`; água, O.B., bunker.                                                                                                                                                                                                                                                            |
| Tacada                  | HUD embaixo como no original: taco na roda do mouse, power shot no Alt (2× = 2 PS), spin/curva clicando na bola do mostrador, força do personagem; barra sempre visível (3 toques, escala do taco, linha do pin, faixa PANGYA; deixar passar cancela); mira A/D precisa (toque = 0,1°).                                                                                                                      |
| Câmera e cova           | O mouse nunca move a câmera; no voo A/D giram e S mostra de cima até a bola quase cair. Vista aérea (M ou 0) como no original: **linha vermelha até o X** (100% do taco) com a distância, pin com desnível (m) e distância; ↑/↓ andam pela linha, Shift+↑/↓ zoom suave, roda troca o taco, espaço volta à câmera normal; Delete+0 abre no X. Cova de verdade (a bola cai dentro), com a luz que puxa a bola. |
| Ferramentas de teste    | **Calibrador** na barra de força (um ponteiro: clique põe, X sobe/Z desce 0,1%; no modo sozinho o 2º espaço usa a força dele) e **sempre PANGYA** (tecla P, só sozinho) para testar a física.                                                                                                                                                                                                                |
| Força do personagem     | Escolhida no menu e na sala antes da partida (mostra quanto o 1W alcança); o servidor usa a força de cada jogador.                                                                                                                                                                                                                                                                                           |
| Regras                  | Buraco completo (par, penalidades, chip-in), placar entre buracos.                                                                                                                                                                                                                                                                                                                                           |
| Multiplayer             | Servidor no PC do anfitrião; sala com chat, escolha de personagem, curso e buracos; turnos (honra no tee, depois o mais longe do pin); placar; o servidor simula as tacadas.                                                                                                                                                                                                                                 |
| Personagens             | 15 personagens montados com skinning; animações reais do jogo (preparação, backswing, swing, andar de lado, comemorações); taco na mão (Bone01); rosto pelo bloco FANM; posicionado com a cabeça do taco na bola.                                                                                                                                                                                            |
| Menus                   | Título no estilo do jogo → personagem (lista + **prévia 3D** girável + força) → curso (nome do jogo, 1/3/9/18 buracos, buraco inicial, recorde). Teclado (setas/Enter/Esc) e mouse; "voltar" do navegador funciona.                                                                                                                                                                                          |
| Rodada                  | Sozinho segue o plano de buracos escolhido; fim de cada buraco e da rodada com **cartão de placar** (par, birdie/bogey marcados, ida/volta, total); recorde por curso salvo no navegador. A sala usa o mesmo cartão e os nomes dos cursos.                                                                                                                                                                   |
| Mapeador de personagens | Estilo Mixamo (girar, zoom, linha do tempo quadro a quadro); animações **traduzidas e separadas por categoria**; peças por categoria com **base × acessório**; anotações salvas; "usar como roupa padrão"; "copiar lista".                                                                                                                                                                                   |
| Sons                    | Linha do tempo da tacada (batida, quiques, rolagem, colisão, cova) com os sons de piso do jogo ou sintetizados.                                                                                                                                                                                                                                                                                              |
| Atualização             | Scripts avisam se o `git pull` falhar; o navegador sempre confere se os arquivos mudaram (sem precisar limpar cache).                                                                                                                                                                                                                                                                                        |

## Em andamento agora

Última entrega (03/10/2026), ajustes do Daniel (vídeo): **câmera sem trancos** (molas que
aceleram e freiam aos poucos, contando pelo tempo); a **linha até o X não some mais** com o
zoom (recortada no plano da câmera); **marcador do pin como no original** no topo da **luz da
cova verde-água** (desnível em m e distância); vista aérea geral sem névoa e com a linha e o
pin enquadrados.

Antes (versão `9a2a031`): o **mouse nunca move a câmera**; **mira precisa** (toque = 0,1°,
segurando acelera); **vista aérea como no original** (linha vermelha até o X do 100% com a
distância; ↑/↓ andam pela linha, Shift+↑/↓ zoom; espaço volta à câmera normal); **calibrador
com um ponteiro só** (clique põe, X sobe e Z desce 0,1%; no modo sozinho o 2º espaço usa a
força dele).

Antes (versão `70ea45c`): roda sempre troca o taco; 2º espaço com a força da marca da régua.

Antes (versão `d6cc4ee`): **sempre PANGYA** com a tecla **P** (só no modo sozinho).

Antes (versão `8ccbfd9`): **menus novos** (spec 15) — título, escolha de personagem com
prévia 3D, escolha de curso e de quantos buracos (1/3/9/18, começando em qualquer buraco),
rodada seguindo esse plano e **resultado final com cartão de placar** e recorde. Atalhos:
setas escolhem, Enter confirma/próximo buraco, Esc volta.

Antes ainda (versão `4191877`): HUD do original embaixo (taco na roda do mouse, power shot no
Alt, spin/curva na bola do mostrador, barra sempre visível com escala e pin), força do
personagem escolhida antes da partida, cova de verdade (a bola cai dentro), luz da cova no
lugar da bandeira, vista aérea com zoom (M/0, Delete+0), câmera livre e mira A/D.
**Esperando o Daniel testar no PC** e responder as perguntas abaixo.

### Perguntas em aberto para o Daniel

- **Força**: qual valor de força dá as distâncias do jogo original (ex.: 3W chegando a 280y
  na referência)? Hoje o padrão é 15 (1W = 230y na barra). O X da vista aérea mostra onde a
  nossa física faz a bola cair a 100% (no Blue Lagoon 1, 1W ≈ 196y de voo): comparar com o X
  do original no mesmo buraco/taco é o jeito mais direto de calibrar.
- **Luz da cova**: altura em que ela ainda puxa a bola (hoje 0,5 m, `CUP_BEAM.height`) e o
  raio (`CUP_BEAM.radius`).
- **Taco no chão**: se com os personagens reais o taco ainda flutua ou atravessa o chão
  (ajuste em `fitClub`, limites `CLUB_FIT`).
- **Mapeador**: a lista "Copiar lista" com as anotações das animações (quadro do impacto do
  swing de cada taco) e das peças.
- **Sons**: a parte "== SONS" do diagnóstico (`?diagnostico`).
- **Nomes dos cursos no menu**: só Blue Lagoon (`blue`) e Pink Wind (`pink`) têm o nome do
  jogo; os outros aparecem pelo nome da pasta (ex.: "Spring Wind"). Quais estão errados? (a
  pasta aparece embaixo do nome na tela do curso; tabela em `apps/client/src/menu/courses.ts`).

### Personagens corretos, com a ajuda do Daniel no mapeador

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

### Próximos ajustes pedidos pelo Daniel (03/10/2026, para fazer depois)

- [ ] **Linha da vista aérea pulando em lotes** (vídeo de 03/10): ao girar a mira, a linha
      vermelha sai do centro e volta aos pulos, em vez de acompanhar o movimento da câmera.
      Suspeita: a linha e o X usam a mira exata e o recálculo da física a cada 0,12 s
      (`LANDING_REFRESH`), enquanto a câmera gira com a mola (`aerialCam.yaw`). Desenhar a
      linha e o X com o mesmo giro suavizado da câmera, e conferir os recálculos.
- [ ] **Tirar a distância e a altura da barra de força**: o texto do pin em cima da barra
      ("224y ↓3.7m", `setPin` em `power-bar.ts`), que agora aparece no marcador do pin, e
      **também a linha vermelha do pin** na barra (confirmado pelo Daniel: sai tudo).
- [ ] **Delete+0 com força maior que a distância do buraco** (a debater): se o X (100%)
      passa do buraco, abrir a câmera do Delete+0 na **linha do buraco** em vez de no X.
      "Na linha do buraco" ainda a definir com o Daniel (ex.: o ponto da linha da mira na
      distância do pin).

### Antes disso

1. **Personagens**: aplicar as anotações do mapeador (impacto do swing, nomes, roupas),
   conferir a frente do modelo e a posição na bola com os personagens reais.
2. **Habilidades do power shot** (tomahawk, spike, cobra): comandos ainda a definir pelo
   Daniel (a física já suporta `shot`; o HUD só manda tacada normal).
3. **Sons**: mapear os efeitos e as vozes ("Pangya!", birdie…) — falta a parte "== SONS" do
   diagnóstico (`?diagnostico`) para saber os nomes dos arquivos; música do curso; volume.
4. **Interface e menus** (spec 15): feito o menu, o fluxo de buracos e o resultado final.
   Falta: telas/sprites originais do cliente (achar os arquivos de UI na extração),
   equipamento (tacos/bolas do `.iff`) mudando a física, configurações (gráficos, volume).
5. **Problema conhecido**: tela inteira azul depois de várias tacadas no Pink Wind 1 (spec 10)
   — ainda não reproduzido.
6. **Calibração final do quique e da rolagem** (spec 08), combinada para o fim: gravar
   tacadas reais e ajustar as constantes até ficar igual ao original.
7. Depois: itens/cartas/caddies, mais modos de jogo, polimento visual.

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

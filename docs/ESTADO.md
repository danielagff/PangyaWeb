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

| Área                    | Situação                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extração dos arquivos   | `.pak` (chave JP), `.iff`, `.pet/.bpet/.apet/.mpet`, `.gbin`, `property.xml`, `.dds`, `.pycb`; índice de nomes e catálogo de personagens.                                                                                                                                                                                                                                                                                               |
| Cursos                  | Buracos reais com texturas, céu, névoa, iluminação assada, objetos; cova e bandeira em escala; grade do green.                                                                                                                                                                                                                                                                                                                          |
| Física                  | Voo portado do SuperSS-Dev, com a **barra sendo a distância real** (no plano e sem vento, x% da barra para perto de x% do alcance: voa 219/230 e rola o resto, como no vídeo do tutorial); quique, rolagem e putt no terreno real; colisão com árvores/objetos pelas caixas `.pycb`; água, O.B., bunker. Na tela a tacada é tocada a 80% da velocidade.                                                                                 |
| Tacada                  | HUD embaixo no visual do original (mostrador com %, "PangYa ×N", aba Start/Power/Impact, barra azul com Max e Click, calibrador verde, contadores do voo e "Distance" ao parar): taco na roda do mouse, power shot no Alt (2× = 2 PS), spin/curva clicando na bola do mostrador, força do personagem; barra sempre visível (3 toques, escala do taco, faixa PANGYA; deixar passar cancela; sem o pin); mira A/D precisa (toque = 0,1°). |
| Câmera e cova           | O mouse nunca move a câmera; no voo A/D giram e S mostra de cima até a bola quase cair. Vista aérea (M ou 0) como no original: **linha vermelha até o X** (100% do taco) com a distância, pin com desnível (m) e distância; ↑/↓ andam pela linha, Shift+↑/↓ zoom suave, roda troca o taco, espaço volta à câmera normal; Delete+0 abre no X. Cova de verdade (a bola cai dentro), com a luz que puxa a bola.                            |
| Ferramentas de teste    | **Calculadora** (tecla G: mira e força para cair na cova, com vento e desnível), **calibrador** na barra de força (um ponteiro: clique põe, X sobe/Z desce 0,1%; no modo sozinho o 2º espaço usa a força dele) e **sempre PANGYA** (tecla P). Tudo só no modo sozinho.                                                                                                                                                                  |
| Força do personagem     | Escolhida no menu e na sala antes da partida (mostra quanto o 1W alcança); o servidor usa a força de cada jogador.                                                                                                                                                                                                                                                                                                                      |
| Regras                  | Buraco completo (par, penalidades, chip-in), placar entre buracos.                                                                                                                                                                                                                                                                                                                                                                      |
| Multiplayer             | Servidor no PC do anfitrião; sala com chat, escolha de personagem, curso e buracos; turnos (honra no tee, depois o mais longe do pin); placar; o servidor simula as tacadas.                                                                                                                                                                                                                                                            |
| Personagens             | 15 personagens montados com skinning; animações reais do jogo (preparação, backswing, swing, andar de lado, comemorações); taco na mão (Bone01); rosto pelo bloco FANM; posicionado com a cabeça do taco na bola.                                                                                                                                                                                                                       |
| Menus                   | Título no estilo do jogo → personagem (lista + **prévia 3D** girável + força) → curso (nome do jogo, 1/3/9/18 buracos, buraco inicial, recorde). Teclado (setas/Enter/Esc) e mouse; "voltar" do navegador funciona.                                                                                                                                                                                                                     |
| Rodada                  | Sozinho segue o plano de buracos escolhido; fim de cada buraco e da rodada com **cartão de placar** (par, birdie/bogey marcados, ida/volta, total); recorde por curso salvo no navegador. A sala usa o mesmo cartão e os nomes dos cursos.                                                                                                                                                                                              |
| Mapeador de personagens | **Catálogo de animações** estilo Mixamo (todas se mexendo em cartões, busca, categorias, anotação) e estúdio (girar, zoom, linha do tempo quadro a quadro); animações **traduzidas**; peças por categoria com **base × acessório**; anotações salvas; "usar como roupa padrão"; "copiar lista".                                                                                                                                         |
| Sons                    | Batida (normal/PANGYA/power shot), quiques e rolagem por piso, árvore, água, O.B., cova e aplausos; som e voz do resultado (birdie, par…); vozes do personagem ("Pangya!", power shot); música do menu e de cada curso; sons do menu; volumes (geral, música, efeitos, vozes). Tela **Sons** no mapeador para ouvir e escolher cada arquivo.                                                                                            |
| Atualização             | Scripts avisam se o `git pull` falhar; o navegador sempre confere se os arquivos mudaram (sem precisar limpar cache).                                                                                                                                                                                                                                                                                                                   |

## Em andamento agora

Em andamento: **câmera da tacada do jogo original** — `dump-jogo.cmd` (usa o
`ProjectG.exe` que já estiver aberto — pedindo administrador se o jogo roda assim — ou abre
um, copia o código já descriptografado da memória com o PE-sieve e manda para o
repositório privado `pangyaweb-dump`). Falta o Daniel rodar; depois analisar a cópia e achar
as funções da câmera. Riscos: o jogo fechar rápido demais, GameGuard, código virtualizado.

Última entrega (04/10/2026): **transições, música sempre tocando e ajustes do vídeo do
Daniel** — menu → buraco e buraco → buraco sem recarregar a página, com a cortina de
carregamento (nome do curso e progresso; do buraco anterior, a imagem dele se dissolvendo) e
a tela só aparece com tudo pronto, música incluída (a anterior toca até a nova carregar);
água e fora do mapa = O.B. voltando ao último ponto válido; espaço na tacada acelera 2× (não
pula); cova sem pressa (bola em ritmo constante, moedas caindo devagar, comemoração inteira
antes do placar). Antes: **personagens piscando e com expressões, sombra e cenário vivo**
— o rosto troca pelo evento `*ptex` das animações do jogo (todos os personagens piscam na
preparação e fazem as caras das poses); sombra do personagem e do taco no chão; o navio e
as lâmpadas animados; gaivotas, borboletas, toupeiras, golfinhos e caranguejos de cada
buraco (movimento aproximado por tipo). Antes: **câmera de mira e personagem como no original** — câmera mais
perto e baixa (personagem grande à esquerda, bola embaixo no centro) e a cabeça do taco
exatamente na bola (antes ficava ~0,5 jarda além ou flutuando). Testado na nuvem com o Max e o
Blue Lagoon reais, baixados dos repositórios privados. Antes: **rosa dos ventos embaixo à direita, ao lado da barra**, no
visual do original (aro prateado com parafusos, miolo verde translúcido, selo "7m"). Antes:
**HUD = a PowerBar do Daniel, idêntica** — os componentes
dele (`docs/referencias/powerbar/`) portados como estão, conferidos lado a lado com o
`rosa.html`; a bola de vidro do mostrador virou **a bola escolhida pelo jogador**; o cursor
da barra volta para a zona de impacto do desenho (faixa branca à esquerda do 0).
Antes: **HUD da tacada no visual do original** (pelo vídeo do
tutorial e a imagem da barra 3W): caixa de design 1620×380 escalada para a tela; mostrador
com a bola, a % de força, "PangYa ×N" (PANGYAs seguidos), o taco no círculo de cima, arco com
ícones e a força embaixo; aba do passo "Start/Power/Impact"; barra com moldura branca,
preenchimento azul com divisões, zona PANGYA rosa, faixa vermelha, polegar cinza, jardas do
meio/máximo embaixo e "Max"; "Click" laranja na volta; calibrador como triângulo verde com
as jardas e "Callipers Z X"; contadores do voo (percorrida em branco, até o pin em vermelho)
e, quando a bola para, o piso, "Distance" e o pin. E a **física pelo vídeo**: o 100% da
barra agora é voo + rolagem (1W: 219y de voo + 14,6y rolando = 233,6y; antes voava 230 e
rolava 40). Ícones do arco ainda são emojis; falta conferir cores/tamanhos com o Daniel.
Antes: **ajustes do Daniel** — moedas só quando a bola cai na cova
(mais moedas quanto melhor: hole in one 40 … bogey 6; double bogey nenhuma); o personagem
lê os **eventos dos quadros (FRAM)** das animações: sons e passos dos movimentos, efeitos
nos ossos, taco escondido, e o quadro exato do impacto; espera com variação (준비 → 디폴트);
sons da barra como no jogo (2º toque good/best timing, 3º toque no toque), swing de madeira
drive_s/tee_s pelo PANGYA, troca de taco (`클럽교체`), bola voando (`공날아가기`); bola caindo
na cova sem tranco (curva com a velocidade que ela trazia, sem câmera lenta dentro da cova,
quique no fundo). Antes: **tacos do jogo** — na tela do personagem, os 121 conjuntos da
tabela ClubSet.iff com o ícone da loja do jogo (leitor de `.tga` novo em `@pangya/formats`) e
os atributos; a força total é a do personagem (Character.iff) + a dos tacos, como no jogo, e
o campo de força é preenchido sozinho. Na partida o personagem segura o taco do conjunto
escolhido (madeira, ferro, wedge, putter) e já aparece com ele na mão. Tudo liberado e
guardado no navegador (`pangyaweb.tacos`); loja com pangs fica para depois. No online os
outros ainda veem o taco do próprio conjunto (só força e bola vão na sala). Controle,
precisão, spin e curva ainda não mudam a física. Antes: **efeitos do jogo** — leitor e motor de partículas dos
`.seq`/`.spr` originais (brilho do PANGYA e da batida boa, efeito da bola na cova, tremida e
clarão) e o letreiro "PangYa"/"Bad" da folha de imagens do jogo. Antes: **entrada do personagem** no começo do buraco e **2º power
shot** com as câmeras animadas do jogo. Antes: **bolas do jogo** — escolha na tela do personagem (lista da
tabela Ball.iff com nomes traduzidos e prévia 3D girando), a bola do jogo desenhada na
partida (`data/ball/<modelo>.pet`) e no online cada um vê a bola dos outros. Ainda só muda
o desenho. Antes: **sons originais da tacada** (pasta `data/sound/new`: swing
por situação e força, timing PANGYA/bom/ruim, moedas saindo e caindo, água, O.B., menus) e
**moedas 3D do jogo** (`coin.pet` com o movimento do `coin_pang.spr`). Antes:
**câmeras originais das comemorações** — lidas dos arquivos
do jogo que o Daniel subiu (`data/camera_path/<personagem>_cam.apet`): cada pose (hole in
one, eagle, birdie, par, bogey, double bogey) toca com a câmera animada do jogo, uma das 4
versões sorteada, sem o taco na mão; **câmera lenta perto da cova** com os números do
próprio jogo (`improve_ingame_play.lua`); música "Breeze" = `samba3.mp3` (`bgmlist.lua`).
Testado na nuvem com os personagens reais (Azer, Kaz), sem texturas.

Antes: **`enviar-arquivos.cmd`**: manda `assets/original` para
repositórios **privados** do GitHub, um por tipo (dados, sons, modelos, imagens; os que
passam de 900 MB viram parte A, B…), para o Claude ler os arquivos do jogo na nuvem. Testado
com repositórios locais. Também: a **câmera do jogo é animada** (`.apet` com um osso
`Camera01`, que o nosso leitor já abre): `data/camera_path/<letra>_def_cam.apet` por
personagem, `camera_list_f/m.txt`, `grandprix_cam.apet` (7 câmeras), `memorial_cam.apet`;
`improve_ingame_play.lua` tem `slow_camerawork_index`. Próximo: ler essas câmeras e tocá-las
no jogo.

Antes (04/10/2026): **câmeras da tacada sorteadas, como no vídeo do Daniel**
(perseguindo colada na bola, do chão olhando o céu, do alto vendo o curso, parada de lado),
**corte para uma câmera parada na queda**, sem o zoom no fim (a câmera fica parada quando a
bola para) e **comemoração pelo resultado** (do hole in one ao double bogey: corta para o
personagem perto da cova fazendo a pose do jogo). Antes, na mesma noite: **pangs** (moedas
saindo da bola no PANGYA/power shot e da cova) com o som das moedas (`아이템획득(팡).wav`) e
**música de cada curso pela trilha oficial** (pangya.wiki: Blue Lagoon =
`daydream.mp3`/`frog.mp3`, Pink Wind = `spring.mp3`, Wiz City = `secretwish`/
`adayinthewizcity`…).

Antes: **sons com os nomes reais** (2º diagnóstico, depois da
reextração): cova `공_홀인`, **público** (aplausos, "uau" no birdie, "oh…" quando para
pertinho, decepção na água/O.B.), "Nice shot!", música do menu (`coffee_time.mp3`), **som do
mar e gaivotas** no Blue Lagoon (pelas caixas de som do curso), vozes do taco de voz normal,
música do curso pelas palavras da pasta (`spring wind` → `spring.mp3`). Achado para o mapa
100%: os buracos têm **bichos** (gaivotas, borboletas, toupeira, golfinho, caranguejo) que
ainda não aparecem.

Antes: **nomes coreanos dos arquivos corrigidos e vozes de verdade**
(com o diagnóstico do Daniel). A extração lia os nomes coreanos como japonês ("ﾆﾎｾﾟ.wav"
em vez de "팡야.wav"), então o jogo não achava sons dos pisos nem texturas com nome coreano;
o **`servidor.cmd` extrai de novo sozinho, uma vez** (alguns minutos) e apaga os arquivos
com nome corrompido. As **vozes** vêm dos pacotes de voz por número do personagem
(`v2_club_7_py1.wav` = "Pangya!" do Kaz): o automático usa o mais completo; tocam também na
água, no bunker e na escolha do personagem. Músicas de fim de buraco e de fim de rodada
(`bgm_under_par`, `bgm_over_par`, `bgm_scoreboard`).

Antes: **sons** — todos os momentos do jogo ligados (batida normal,
PANGYA e power shot, barra, quiques, árvore, água, O.B., cova e aplausos, resultado do
buraco, menus) com **vozes dos personagens** ("Pangya!", power shot, birdie, par…),
**música do menu e de cada curso** e **volumes** (painel "🔊 Som" no menu). Os arquivos são
achados sozinhos pelo nome (em coreano: o curso usa `공_그린.wav`, `충돌_rough2.wav`…) e o
Daniel confere e troca na nova tela **🔊 Sons do mapeador** (`mapeador.cmd` → 🔊 Sons, ou
"Sons do jogo" no menu): ouvir cada arquivo e usar com um clique; grava no servidor e vale
para todos. Ainda não conferido com os arquivos reais (na nuvem só com bipes de teste).

Antes: **catálogo de animações no mapeador**, no estilo do Mixamo —
abre direto no `mapeador.cmd` (tecla C alterna com o estúdio): um cartão por animação,
**todas se mexendo ao mesmo tempo**, com tradução, nome coreano, duração e anotação; busca,
filtro por categoria e tamanho dos cartões; clicar no boneco abre no estúdio (quadro a
quadro). Junto: a **tacada ficou mais lenta na tela** (voo e rolagem a 80%; drive de 5,1 s
para 6,4 s no ar — onde a bola cai não muda) e uma **pesquisa na internet** sobre as
animações (resumo na spec 12: não existe catálogo nem lista pronta; há os arquivos
originais da Arin com nomes e durações e o bloco FRAM com troca de rosto e taco por quadro).

Plano combinado com o Daniel: deixar **1 personagem 100% e 1 mapa 100%** antes de abrir
para o resto. A calculadora no green saiu da lista (não interessa); o ajuste da curva fica
para depois.

Antes: **voo da bola suave** — a bola é desenhada entre os pontos da
física (50 por segundo) pelo tempo exato de cada quadro da tela; antes andava aos trancos e a
câmera tremia junto.

Antes: **mostrador da mira** embaixo da rosa dos ventos — graus em
relação ao pin, o lado e as jardas de lado na distância do pin; depois do G, o alvo da
calculadora e quanto falta (✓ quando bate).

Antes: **calculadora (tecla G, só no modo sozinho)** — mira e força
para a bola cair direto na cova, com vento, desnível e terreno; já deixa mira, taco e
calibrador prontos (com o P, são só os 2 toques). No Blue Lagoon, toda tacada que ela achou
entrou (320 de 320 casos; o resto era obstáculo no caminho ou fora de alcance). Para dar
para calcular, a **força do piso agora é sorteada quando a bola para** e aparece no HUD
("rough 88%"); a tacada seguinte usa ela.

Antes (versão `905ab09`): **a barra de força é a distância de verdade** (decisão do
Daniel). No plano, sem vento e com a bola no centro, x% da barra cai a x% do alcance do taco
— pin a 115y com o 1W de 230y → 50% cai no pin. Vento, desnível, spin e curva mudam a partir
daí. Conferido: nos buracos 2 e 6 do Blue Lagoon (par 3), a força certa contando o desnível
dá Hole in One sem vento.

Antes (versão `5d32c3d`), os 3 ajustes pedidos pelo Daniel: a **linha e o X da vista
aérea giram junto com a câmera** (presos ao centro, sem pular a cada toque de mira); a
**barra de força ficou sem a distância, o desnível e a linha do pin** (estão no marcador do
pin); no **Delete+0, se o X passa do buraco**, a câmera abre e segue na linha da mira na
distância do buraco.

Antes (versão `c11d1e8`), ajustes do Daniel (vídeo): **câmera sem trancos** (molas que
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

- **1 personagem e 1 mapa 100%**: qual personagem e qual mapa (Blue Lagoon?), e o que falta
  neles do jeito que você vê no jogo.
- **Luz da cova**: altura em que ela ainda puxa a bola (hoje 0,5 m, `CUP_BEAM.height`) e o
  raio (`CUP_BEAM.radius`).
- **Taco no chão**: se com os personagens reais o taco ainda flutua ou atravessa o chão
  (ajuste em `fitClub`, limites `CLUB_FIT`).
- **Mapeador**: a lista "Copiar lista" com as anotações das animações (quadro do impacto do
  swing de cada taco) e das peças.
- **Sons**: abrir o `mapeador.cmd` → 🔊 Sons, ouvir e conferir o que foi achado sozinho (e
  trocar o que estiver errado). A música de cada curso agora vem da trilha oficial.
- **Câmera do jogo original**: rodar o diagnóstico (`jogar.cmd` → página de diagnóstico,
  `?diagnostico`) e mandar a parte "== CÂMERA" (o `.exe` é protegido; procuramos a câmera
  nos arquivos de dados).
- **Câmeras da tacada, comemoração e pangs**: se as câmeras sorteadas e a da queda estão
  parecidas com as do jogo (tempos e distâncias em `SHOT_CAMERA`, `CELEBRATION`,
  `hole-view.ts`), se a comemoração é perto da cova mesmo e quando os pangs devem sair (hoje:
  PANGYA, power shot e bola na cova; sem valor em pangs, porque não sabemos as regras).
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

1. **1 personagem 100%** (qual: o Daniel escolhe): o Daniel anota no catálogo o que é cada
   animação; com isso, usar todas as que o jogo usa (entrada, tacadas de cada taco, power
   shot, erros, putts, comemorações e decepções de cada resultado, chat), o **quadro exato do
   impacto** (já vem do FRAM), a roupa padrão, a frente do modelo e a posição na bola. Do
   FRAM falta usar a troca de rosto (`*ptex`) e `*hidebone`.
2. **1 mapa 100%** (qual e o que falta: o Daniel diz). Já se sabe: faltam os **bichos do
   cenário** (gaivotas, borboletas, toupeira, golfinho, caranguejo — `HoleData.npcs`, spec 06).
3. **Habilidades do power shot** (tomahawk, spike, cobra): comandos ainda a definir pelo
   Daniel (a física já suporta `shot`; o HUD só manda tacada normal).
4. **Sons**: conferir com os arquivos reais na tela Sons (Daniel); vozes dos caddies.
5. **Interface e menus** (spec 15): feito o menu, o fluxo de buracos e o resultado final.
   Falta: telas/sprites originais do cliente (achar os arquivos de UI na extração),
   equipamento (tacos/bolas do `.iff`) mudando a física, configurações (gráficos, volume).
6. **Problema conhecido**: tela inteira azul depois de várias tacadas no Pink Wind 1 (spec 10)
   — ainda não reproduzido.
7. **Depois** (combinado): ajustar a **curva** e as especiais à barra nova (a curva máxima do
   1W a 100% cai ~12 y ao lado da mira; spec 08); calculadora com spin/curva/especiais;
   **calibração final do quique e da rolagem** (gravar tacadas reais e ajustar).
8. Depois: itens/cartas/caddies, mais modos de jogo, polimento visual.

Fora da lista (Daniel, 03/10/2026): calculadora no green (putt); modo desktop.

## Decisões tomadas

- **Reescrever para web** (abordagem B), em vez de emular o cliente original
  ([ADR 0001](./adr/0001-engine.md)).
- **Assets só no PC**, nunca no git.
- **Física própria**: o voo vem do SuperSS-Dev (MIT); quique e rolagem são modelo nosso,
  calibrado no fim. O Leonardo Barcelos (autor do GhostPro) confirmou: "isso é motor
  dinâmico do Pangya, você pode criar o seu próprio".
- **A barra de força é a distância real** (03/10/2026): não precisa ser igual ao original;
  precisa dar para calcular — no plano e sem vento, x% da barra cai a x% do alcance do taco,
  e vento, desnível, spin e curva mudam a partir daí. Ajuste de 04/10/2026, pelo vídeo do
  tutorial: o número da barra é **voo + rolagem** (1W 230y → 219y de voo + ~14,5y rolando).
- **Força do piso conhecida antes de bater** (03/10/2026): sorteada quando a bola para e
  mostrada no HUD, em vez de sorteada na hora da tacada — para dar para calcular.
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
| [Paechijanjae](https://codeberg.org/retreev/Paechijanjae) (retreev)                | —       | Arquivos originais esquecidos em patches: movimentos da Arin com nomes e duração (spec 12).        |
| [docs.pangya.golf](https://docs.pangya.golf) / PangLib (retreev)                   | —       | Documentação de formatos (`.mot`/`.talk` dos caddies, `.pet`); parte desatualizada.                |

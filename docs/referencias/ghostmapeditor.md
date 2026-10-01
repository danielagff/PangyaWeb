# Referência: GhostMapEditor e pet-source_tools

## GhostMapEditor — https://github.com/lbarceloss/GhostMapEditor (MIT)

Editor 3D (C++/raylib) que abre os buracos reais do Pangya a partir dos arquivos do
cliente e permite mover/plantar objetos. O núcleo em `src/shared/` (compartilhado com o
"Ghost Pangya SIM" do mesmo autor) tem leitores dos formatos que precisamos:

| Arquivo               | Conteúdo                                                                                                                                                                                                                                                          | Spec   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `pangya_pet.{h,cpp}`  | `.pet`: texturas, ossos (matriz 4×3), vértices com até 4 pesos, polígonos com normal/UV, animações por osso (posição/escala/quatérnio) e _motions_ (intervalos de frames nomeados)                                                                                | 05, 12 |
| `pangya_gbin.{h,cpp}` | `.gbin` (magic `WEPX`, versões 0x70–0x72): câmeras, luzes/pontos especiais (tee, pin, grade, sol — nomes em CP949), soundboxes, texturas, nós, elementos (modelo, matriz de mundo, AABB, `collFlag`, `courseType`) e `mapCheck` (par do buraco, 2 tees, 2×3 pins) | 06, 07 |
| `ground.{h,cpp}`      | Grade espacial de triângulos do terreno + `HeightAt(x, z)` (altura do chão em qualquer ponto)                                                                                                                                                                     | 08     |
| `dds_loader.cpp`      | Texturas `.dds`                                                                                                                                                                                                                                                   | 07     |
| `viewer_core.cpp`     | Montagem de malha, shader, cena, céu, câmera                                                                                                                                                                                                                      | 07     |

Estrutura de pastas do cliente (após extrair os `.pak`): `<round>\map\<curso>_NN.gbin`
(um por buraco), `.sbin` (terreno e colisão), `_property.xml` (tee, pino, classes de
booster), `.wep` (projeto do editor da Ntreev), texturas em `texture_dds`.

## pet-source_tools — https://github.com/Acrisio-Filho/pet-source_tools (sem licença)

Addon de Blender (Python) do autor do SuperSS-Dev, fork de `retreev/io_scene_mpet`.
Importa/exporta `.pet/.apet/.bpet/.mpet` (todas as versões) e `.gbin/.sgbin/.aibin/.sbin`.
É a única referência para o **`.sbin`** (terreno + colisão, `sbin.py`).

**Sem arquivo de licença**: usar só como documentação de formato e escrever o código do
zero. A documentação original de formatos está em
https://github.com/retreev/Documentation (`pc/file-formats/`).

## Impacto no roadmap

- Spec 05 (`.pet` → glTF) e spec 06 (cursos) passam a ter referência completa.
- Com o terreno real (`HeightAt` + malha de colisão do `.sbin`), a simulação de voo da
  spec 08 pode calcular o ponto de pouso exato em qualquer buraco — não só numa altura
  fixa como a calculadora do SuperSS. Quique/rolagem continuam sem referência.

## GhostPro — https://github.com/lbarceloss/GhostPro (sem licença)

Calculadora em overlay (C#/WPF) do mesmo autor. A física (`calc_s4/QuadTree.cs`) é um port
da calculadora do SuperSS-Dev — só o voo, sem quique/rolagem — e o restante lê a memória do
jogo em execução para preencher os dados automaticamente. Nada novo para o PangyaWeb.

## dx9-collision-boxes — https://github.com/lbarceloss/dx9-collision-boxes (sem licença, sem código)

DLL injetada no jogo (overlay DirectX 9) que desenha as caixas de colisão dos objetos. O
repositório só tem binários e um `collboxes.zip` com 270 arquivos `.pycb` (magic `PYCB`), um
por buraco, de 15 cursos: para cada objeto, o nome do `.pet` e caixas orientadas de 8 cantos.
Mostra que a colisão com objetos (árvores, postes…) usa caixas definidas nos próprios `.pet`
(o pet-source_tools também lê essas "collision box"). Não cobre terreno, tipo de piso nem
quique/rolagem. Pode servir para validar nossa leitura de caixas de colisão dos `.pet`.

## PangYa-Map-Toolkit — https://github.com/lbarceloss/PangYa-Map-Toolkit (GPL-3.0)

Ferramentas para editar mapas e recolocá-los no jogo. Por ser **GPL-3.0**, usar como
referência (copiar código obrigaria o PangyaWeb a ser GPL). Pontos úteis:

- **Estrutura de um buraco** (dentro do `.pak` do curso, ex. `round10_spring wind/`):
  `map/pink_NN.pet` = **malha do terreno** (um `.pet` por buraco); `map/pink_NN.gbin` = cena
  (objetos e posições); `ase/*.pet` = objetos (árvores, casas…); `texture_dds/` = texturas.
- `tools/pak_check.py` abre os `.pak` originais (`ProjectG_Jp_Pink.pak`) com a **chave JP
  padrão** — confirma que só o cliente do Reborn tem chave própria.
- O renderizador do jogo depende da **ordem dos vértices** de cada triângulo (decals de
  fairway/green sobrepostos ficam transparentes se a ordem mudar) — manter a ordem
  original ao converter `.pet` → glTF.
- O cliente valida cada arquivo contra um `updatelist` cifrado (XTEA + CRC32 próprio,
  polinômio não refletido `0x04C11DB7`) — irrelevante para o PangyaWeb, que só lê.

## pangya-pet_tools + guia técnico — https://github.com/lbarceloss/pangya-pet_tools

Fork do pet-source_tools com `tools/gbin_dump.py`, `tools/sbin_dump.py` e o
**`docs/Guia_PangYa_Mapas_e_Personagens.pdf`**, verificado contra arquivos reais e o
`ProjectG.exe` no IDA. Também traz um `Blue Lagoon.zip` (curso extraído) e o repositório
`exemplo-pink-wind-v1` traz os 18 `.gbin` do Pink Wind — usados para validar os nossos
leitores (18 buracos do Blue Lagoon batem com a tabela do guia; par total 72; 44/44 `.pet`
de objetos lidos).

Descobertas principais:

- **Tipo de piso = textura.** `<curso>_property.xml` (EUC-KR, lido com TinyXML pelo jogo)
  lista classes (tee, fairway, rough, green, bunker, água, estrada, pedra, madeira, folhas…)
  com **`bound` (quique), `roll` (rolagem)** e `min/max` (% de força), e as texturas de cada
  uma. O terreno é o `.pet` do buraco; cada triângulo pertence à classe da sua textura.
- **`.sbin` é só a sombra assada** do buraco (atlas DXT1), não colisão.
- O **O.B.** não vem da tabela de classes (não confirmado de onde vem).
- Tee/pin: luzes tipo 0 com nomes coreanos (`시작점`, `시작점2`, `끝점1_1..3`, `끝점2_1..3`,
  `그리드`); duplicados no `MapCheck` (par + XZ) e no `.wep`.
- Névoa em `<curso>_fog.txt` (cor RGB + início/fim); skybox fica no `ProjectG_Jp_ZSky.pak`.
- Terreno é _fullbright_ (a luz global não afeta o chão, só objetos).
- Ordem de prioridade entre `.pak`: caminho interno, depois ordem alfabética (o último
  vence), e só os que estão no `updatelist`.
- Soundboxes tipo 1 têm script que cria NPCs (gaivotas, borboletas…); o `script` dos
  elementos é usado em portais que desviam a bola.

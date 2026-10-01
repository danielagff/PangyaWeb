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

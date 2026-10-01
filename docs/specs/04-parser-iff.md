# 04 — Parser de tabelas `.iff`

- **Status:** em andamento
- **Fase:** 1 Formatos
- **Depende de:** 03
- **Estimativa:** M

## Objetivo

Converter as tabelas de dados do jogo (personagens, tacos, bolas, itens, cursos, buracos,
cartas…) para JSON tipado, consumido pelo cliente e pelo servidor.

## Contexto

O arquivo `pangya_<região>.iff` costuma ser um zip contendo arquivos como `Character.iff`,
`Club.iff`, `ClubSet.iff`, `Ball.iff`, `Part.iff`, `Item.iff`, `Course.iff`, `Card.iff`,
`Caddie.iff`, `Mascot.iff` (verificar nomes). Cada `.iff` é um array de registros de tamanho
fixo com cabeçalho (quantidade de registros, versão). O layout dos registros muda entre
versões/regiões.

Dados mais importantes para a jogabilidade:

- **Personagem:** atributos base (power, control, accuracy/impact, spin, curve).
- **Taco/ClubSet:** distância de cada taco (1W…PT), atributos, slots de melhoria.
- **Bola:** bônus de atributos/efeitos.
- **Curso:** lista de buracos, par, modelos.

**Referência:** `pangya_jp.iff` reais e layouts em `Server Lib/Projeto IOCP/TYPE/data_iff.h`
do SuperSS-Dev (MIT) — esta spec pode ser feita inteira sem o cliente.

## Escopo

**Inclui**

- Descritores de layout declarativos por tabela e por versão:
  ```ts
  const ClubSet_v1 = struct({ active: u32, id: u32, name: cstr(64), …, stats: array(u16, 5) })
  ```
- `asset-pipeline iff` gera `assets/converted/data/*.json` + tipos TS.
- Validação: IDs únicos, campos dentro de faixas plausíveis.

**Não inclui**

- Edição/escrita de `.iff`.

## Contratos / interfaces

```ts
interface CharacterData { id: number; name: string; stats: Stats }
interface ClubSetData   { id: number; name: string; clubs: ClubData[]; stats: Stats }
interface ClubData      { kind: '1W'|'2W'|'3W'|'2I'|…|'PW'|'SW'|'PT'; maxDistanceYd: number }
interface CourseData    { id: number; name: string; holes: HoleRef[] }
interface Stats         { power: number; control: number; accuracy: number; spin: number; curve: number }
```

## Critérios de aceite

- [ ] JSON gerado para personagens, clubsets, bolas e cursos da versão de referência.
- [ ] Nomes legíveis (encoding correto — testar Shift-JIS/CP949/Latin-1 conforme região).
- [ ] JSON gerado em `assets/converted/data/` (local) e usado pelo cliente e pelo servidor.
- [ ] Testes unitários com registros sintéticos no CI.

## Andamento

- [x] Codec declarativo (`packages/formats/src/codec.ts`) e leitor de tabela com validação de tamanho.
- [x] Layouts de Character, Club, ClubSet, Ball e Course (versão 13, JP) + `readGameData`.
- [x] `pnpm assets:iff <arquivo.iff>` gera `assets/converted/data/*.json`.
- [x] Testes unitários com dados sintéticos.
- [ ] Demais tabelas (Part, Caddie, Mascot, Card, Item…) conforme forem necessárias.
- [ ] Teste de integração com o `.iff` do cliente, após a spec 03.

## Riscos e perguntas em aberto

- Campos desconhecidos: manter como `unknownN` no descritor e documentar hipóteses.

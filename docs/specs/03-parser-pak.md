# 03 — Parser de pacotes `.pak`

- **Status:** em andamento
- **Fase:** 1 Formatos
- **Depende de:** 01, 02
- **Estimativa:** M

## Objetivo

Biblioteca em `packages/formats` que lista e extrai arquivos dos `projectg*.pak`, e um
comando `asset-pipeline extract` que gera uma árvore de diretórios virtual unificada.

## Contexto

Estrutura geral conhecida pela comunidade (verificar):

- Rodapé no fim do arquivo com offset e número de entradas da tabela de arquivos.
- Tabela de arquivos com nome (ofuscado com XOR/chave dependente da região), offset,
  tamanho comprimido/descomprimido e tipo (arquivo, diretório, comprimido).
- Compressão do tipo LZ77 própria.
- Vários `.pak` se sobrepõem: o pak com número maior sobrescreve arquivos de mesmo caminho
  (sistema de patches).

**Referência:** `Tools/lzpak.cpp` do SuperSS-Dev (MIT) documenta cabeçalho, entradas e
LZ77 dos `.pak`.

## Escopo

**Inclui**

- `readPakIndex(buf): PakEntry[]` e `readPakFile(buf, entry): Uint8Array`.
- Descompressão LZ implementada e testada.
- Tabela de chaves por região configurável (`PAK_REGION=us|jp|br|…`).
- VFS que monta todos os `.pak` na ordem correta e resolve sobrescritas.
- CLI: `extract --out assets/original/` e `ls <glob>`.

**Não inclui**

- Escrita/re-empacotamento de `.pak`.

## Contratos / interfaces

```ts
interface PakEntry {
  path: string
  offset: number
  size: number
  rawSize: number
  compressed: boolean
}
interface Vfs {
  list(glob: string): string[]
  read(path: string): Promise<Uint8Array>
}
```

## Critérios de aceite

- [ ] Extrai 100% das entradas dos paks de referência sem erro.
- [ ] Arquivos extraídos com formato conhecido (`.jpg`, `.ogg`, `.zip`) abrem em ferramentas
      comuns — prova de que a descompressão está correta.
- [ ] Testes unitários com um `.pak` sintético (CI) + teste de integração com os `.pak`
      reais (local).

## Andamento

- [x] Índice do `.pak` (rodapé de 9 bytes), entradas v1/v2 (XOR 0x71) e v3 (XTEA por região),
      detecção automática da região.
- [x] Descompressão LZ77 e LZ77-2 (ofuscada).
- [x] `PakVfs`: base em ordem alfabética, depois patches `projectgNNN.pak` em ordem crescente
      (o último sobrescreve) — **(verificar)** contra a ordem real do cliente.
- [x] `pnpm assets:pak` (lista pacotes/região/extensões) e `pnpm assets:build` (extrai para
      `assets/original/` e converte o `.iff` encontrado).
- [x] Testes com `.pak` sintéticos.
- [ ] Rodar contra o cliente JP real (local) e registrar o resultado.

## Riscos e perguntas em aberto

- Chave XOR desconhecida para a sua região → descobrir por análise do índice (nomes de
  arquivo têm padrões previsíveis, ex.: extensões).

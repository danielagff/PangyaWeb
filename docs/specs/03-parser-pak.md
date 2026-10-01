# 03 — Parser de pacotes `.pak`

- **Status:** rascunho
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
interface PakEntry { path: string; offset: number; size: number; rawSize: number; compressed: boolean }
interface Vfs { list(glob: string): string[]; read(path: string): Promise<Uint8Array> }
```

## Critérios de aceite
- [ ] Extrai 100% das entradas dos paks de referência sem erro.
- [ ] Arquivos extraídos com formato conhecido (`.jpg`, `.ogg`, `.zip`) abrem em ferramentas
      comuns — prova de que a descompressão está correta.
- [ ] Testes unitários com um `.pak` sintético gerado no próprio teste (sem asset original).

## Riscos e perguntas em aberto
- Chave XOR desconhecida para a sua região → descobrir por análise do índice (nomes de
  arquivo têm padrões previsíveis, ex.: extensões).

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
- [x] Versões de entrada como no `lzpak.cpp`: 0/1 = XOR, **2 = XTEA**, 0xF = sem cifra
      (confirmado com o índice real do `ProjectG_Jp_Tuto.pak` do Reborn: 28 entradas fecham
      exatamente no rodapé).
- [x] Chave customizada via `PAK_KEY` e busca da chave nos `.exe/.dll/.dat` do cliente
      (`pnpm assets:pak-key`). Os patches do **Reborn** não abrem com nenhuma chave padrão.
- [x] **Nomes coreanos** (03/10/2026): os nomes das entradas eram lidos só como Shift-JIS e
      os nomes coreanos (CP949) viravam katakana de meia largura, perdendo letras
      ("ﾆﾎｾﾟ.wav" em vez de "팡야.wav") — o jogo não achava sons do property.xml nem texturas
      com nome coreano. `decodePakName`: tenta Shift-JIS; se sair katakana de meia largura
      ou "�", lê em CP949. A extração tem versão (`EXTRACTION_VERSION` 2, marca em
      `assets/original/_extracao.json`): o `servidor.cmd` (`pnpm assets:atualizar`) extrai de
      novo sozinho uma vez e apaga os arquivos com nome corrompido da extração antiga.
- [x] Rodado contra o cliente JP real no PC do Daniel: 56.910 arquivos no índice.

## Riscos e perguntas em aberto

- Chave XOR desconhecida para a sua região → descobrir por análise do índice (nomes de
  arquivo têm padrões previsíveis, ex.: extensões).

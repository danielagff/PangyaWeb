# 02 — Inventário de assets do cliente original

- **Status:** rascunho
- **Fase:** 0 Fundação
- **Depende de:** 01
- **Estimativa:** P

## Objetivo
Documento + script que listam todos os arquivos da instalação do cliente, agrupados por
tipo, com a função de cada um e o estado de entendimento do formato.

## Contexto
Antes de escrever parsers é preciso saber o que existe. Uma instalação típica contém
(verificar na sua versão/região):
- `projectg*.pak` — pacotes com quase todo o conteúdo (modelos, texturas, cursos, sons, UI).
- `pangya_*.iff` / `pangya_*.iff` dentro dos `.pak` — tabelas de dados (itens, personagens,
  tacos, cursos), normalmente um arquivo zip contendo vários `.iff`.
- `.pet` / `.apet` / `.bpet` / `.mpet` — modelos 3D, ossos, animações.
- `.jpg`, `.dds`, `.tga` — texturas.
- `.ogg` / `.wav` — áudio.
- `.dat`, `.sqd`, `.xml`, `.gbin` — configuração, UI, scripts (verificar).
- Executável `ProjectG.exe` + DLLs (D3D9, GameGuard) — **não** fazem parte do pipeline B.

A versão/região do cliente importa (US, JP, BR, KR, TH, EU): chaves de criptografia dos
`.pak` e layout dos `.iff` mudam entre versões.

## Escopo
**Inclui**
- `tools/asset-pipeline inventory` que percorre `PANGYA_DIR` (e o conteúdo dos `.pak` após
  a spec 03) e gera `docs/inventario.md` e `docs/inventario.json` com: caminho, extensão, tamanho, magic bytes, hash.
- Documento `docs/formatos.md` (commitado) descrevendo cada formato em alto nível e
  linkando referências da comunidade.
- Registrar versão e região do cliente usado como referência.

**Não inclui**
- Parsing dos formatos (specs 03–06).

## Critérios de aceite
- [ ] Script roda em < 1 min numa instalação completa.
- [ ] Toda extensão encontrada aparece em `docs/formatos.md` com status
      `desconhecido | parcial | entendido`.

## Riscos e perguntas em aberto
- Qual versão do cliente será a referência? Recomendo fixar **uma** (a mais completa que
  você tiver) e só depois pensar em outras.
- Referências da comunidade a pesquisar: projetos de servidor emulador e ferramentas de
  arquivos de Pangya no GitHub (ex.: organização *pangbox*, ferramentas de pak/iff/pet).
  Ler documentação de formato é ok; não copiar código com licença incompatível.

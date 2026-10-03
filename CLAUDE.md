# PangyaWeb — instruções para o Claude

Leia primeiro [`docs/ESTADO.md`](./docs/ESTADO.md): o que estamos fazendo, onde estamos, o
que falta, decisões e projetos de referência. Mantenha esse arquivo atualizado a cada entrega.

- Converse em **português**. O usuário (Daniel) usa Windows e não gosta de passos manuais:
  entregue tudo por `servidor.cmd` / `mapeador.cmd` / `jogar.cmd` (scripts em `scripts/`).
- **Arquivos extraídos do jogo na nuvem**: o Daniel envia `assets/original` para repositórios
  **privados** separados, um por tipo (`pangyaweb-dados`, `-sons`, `-modelos`, `-imagens`;
  os grandes viram `-a`, `-b`…), com `enviar-arquivos.cmd`. Para ler, ligue o repositório à
  sessão (`add_repo`) e clone fora do projeto. Nada disso entra neste repositório.
- **Nunca** coloque arquivos do jogo no git: `assets/` é local (gitignored). Testes usam dados
  sintéticos. Na nuvem (sem os arquivos do jogo), prepare o ambiente com
  `pnpm assets:exemplo` (curso Blue Lagoon) e `pnpm assets:teste` (personagem de teste com
  rosto, acessório, taco e animações com nomes reais, e bipes com nomes de som no padrão do
  jogo); depois `pnpm build` e
  `pnpm --filter @pangya/server start` (porta 7777; mapeador em `/mapeador.html`).
- O branch de trabalho é o padrão do repositório (`claude/pensive-dirac-7v6qp7`).
- Checagens antes de cada commit: `pnpm typecheck`, `pnpm lint`, `pnpm test`.
- Specs por área em `docs/specs/` (atualize o "Progresso" da spec que mudar).

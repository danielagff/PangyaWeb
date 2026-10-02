# PangyaWeb — instruções para o Claude

Leia primeiro [`docs/ESTADO.md`](./docs/ESTADO.md): o que estamos fazendo, onde estamos, o
que falta, decisões e projetos de referência. Mantenha esse arquivo atualizado a cada entrega.

- Converse em **português**. O usuário (Daniel) usa Windows e não gosta de passos manuais:
  entregue tudo por `servidor.cmd` / `mapeador.cmd` / `jogar.cmd` (scripts em `scripts/`).
- **Nunca** coloque arquivos do jogo no git: `assets/` é local (gitignored). Testes usam dados
  sintéticos; na nuvem existe um personagem de teste em `assets/original/data/avatar/teste`.
- Checagens antes de cada commit: `pnpm typecheck`, `pnpm lint`, `pnpm test`.
- Specs por área em `docs/specs/` (atualize o "Progresso" da spec que mudar).

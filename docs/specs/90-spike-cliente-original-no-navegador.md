# 90 — Spike: rodar o cliente original no navegador

- **Status:** rascunho
- **Fase:** Spike (pode rodar em paralelo à fase 0)
- **Depende de:** —
- **Estimativa:** P (timebox de 2–3 dias)

## Objetivo
Responder com evidência: **dá para rodar o `ProjectG.exe` original no navegador de forma
jogável?** Entregar um relatório go/no-go, não um produto.

## Contexto
O cliente é um executável Windows 32-bit que usa Direct3D 9, conecta via TCP em servidores
de login/game que não existem mais e normalmente inclui proteções (ex.: GameGuard). Para
rodar no navegador seria preciso, ao mesmo tempo:
1. emular/traduzir x86 + API Windows em WebAssembly;
2. traduzir Direct3D 9 para WebGL;
3. transformar as conexões TCP em WebSocket (proxy no servidor);
4. ter um servidor emulador compatível com a versão do cliente.

## Opções a testar
| Opção | O que é | Expectativa |
|---|---|---|
| Boxedwine | Wine compilado para WASM, roda apps Win32 no navegador | Melhor candidata para "realmente no navegador"; 3D D3D9 provavelmente lento ou instável |
| v86 / emulador de PC completo | Windows inteiro emulado em WASM | Sem aceleração 3D: inviável para o jogo |
| Streaming | Cliente roda nativo (Windows ou Linux+Wine) num PC/servidor e é transmitido para o navegador via WebRTC (ex.: Sunshine+Moonlight Web, Neko) | Funciona bem, mas o jogo não roda "no" navegador — é acesso remoto |

## Passos
1. Confirmar que o cliente roda **nativamente** contra um servidor emulador local
   (pré-requisito para qualquer opção).
2. Boxedwine: carregar o cliente, medir até onde chega (tela de login? lobby? partida?)
   e o fps.
3. Streaming: montar a opção mais simples e medir latência de entrada.
4. Escrever `docs/adr/0002-abordagem.md` com resultado, medições e decisão.

## Critérios de aceite
- [ ] Relatório com até onde cada opção chegou, fps, problemas encontrados e recomendação.
- [ ] Prazo respeitado: ao fim do timebox, parar e registrar mesmo sem sucesso.

## Riscos e perguntas em aberto
- Proteções do cliente e checagens de integridade podem impedir a execução em emuladores.
- Mesmo funcionando, a opção A não permite evoluir o jogo (novas features, celular,
  correções) — por isso a recomendação padrão continua sendo a reescrita (abordagem B).

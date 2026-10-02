# Abre o mapeador de personagens (animações e peças traduzidas, por categoria), separado
# do jogo, na porta 7778. Uso: clique duas vezes em mapeador.cmd.
Set-Location (Split-Path $PSScriptRoot -Parent)
. "$PSScriptRoot/comum.ps1"

Atualizar

Passo 'Compilando'
pnpm build
if ($LASTEXITCODE -ne 0) { throw 'A compilação falhou (veja o erro acima).' }
if (-not (Test-Path 'apps/client/dist/mapeador.html')) { throw 'mapeador.html não foi gerado.' }

$porta = 7778
LiberarPorta $porta
Passo 'Ligando o mapeador (feche esta janela para parar)'
AbrirQuandoPronto "http://localhost:$porta/"
$env:PORT = $porta
$env:PANGYA_PAGINA = 'mapeador.html'
Write-Host "`n   Se o navegador não abrir sozinho, abra: http://localhost:$porta/" -ForegroundColor Green
pnpm --filter @pangya/server start

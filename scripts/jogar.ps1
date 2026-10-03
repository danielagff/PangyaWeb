# Atualiza o PangyaWeb e abre o jogo sozinho no navegador, sem passos manuais.
# Uso: clique duas vezes em jogar.cmd (na raiz do repositório).
#   Opcional: jogar.cmd "round10_spring wind" pink 1   (curso, prefixo, buraco)
param(
  [string]$Curso = 'round02_blue',
  [string]$Prefixo = 'blue',
  [int]$Buraco = 1
)
Set-Location (Split-Path $PSScriptRoot -Parent)
. "$PSScriptRoot/comum.ps1"

Atualizar
LiberarPorta 5173

# O servidor (porta 7777) guarda as escolhas do mapeador (sons, roupas): sem ele o jogo
# funciona, mas sem essas escolhas. Liga escondido; um antigo nessa porta é fechado antes.
LiberarPorta 7777
try {
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'pnpm --filter @pangya/server start' `
    -WindowStyle Hidden | Out-Null
} catch {
  Write-Host '   Não consegui ligar o servidor (escolhas de sons e roupas ficam de fora).' -ForegroundColor Yellow
}
$url = "http://localhost:5173/?curso=$([uri]::EscapeDataString($Curso))&prefixo=$Prefixo&buraco=$Buraco"
Passo "Abrindo $url (feche esta janela para parar)"
AbrirQuandoPronto $url
pnpm dev

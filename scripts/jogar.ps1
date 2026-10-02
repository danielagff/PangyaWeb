# Atualiza o PangyaWeb e abre o jogo no navegador, sem passos manuais.
# Uso: clique duas vezes em jogar.cmd (na raiz do repositório).
#   Opcional: jogar.cmd "round10_spring wind" pink 1   (curso, prefixo, buraco)
param(
  [string]$Curso = 'round02_blue',
  [string]$Prefixo = 'blue',
  [int]$Buraco = 1
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Passo($texto) { Write-Host "`n==> $texto" -ForegroundColor Cyan }

Passo 'Baixando a versão mais nova do GitHub'
git pull --ff-only

Passo 'Instalando dependências'
pnpm install

# Assets: na primeira vez extrai o cliente (ou o curso de exemplo); depois só refaz o índice.
$original = 'assets/original'
$temTexturas = (Test-Path $original) -and
  (Get-ChildItem $original -Recurse -Filter *.dds -ErrorAction SilentlyContinue | Select-Object -First 1)
$temCliente = (Test-Path .env) -and (Select-String -Path .env -Pattern '^\s*PANGYA_DIR\s*=\s*\S' -Quiet)
if (-not $temTexturas -and $temCliente) {
  Passo 'Primeira vez: extraindo o cliente do Pangya (demora alguns minutos)'
  pnpm assets:build
} elseif (-not (Test-Path "$original/_index.json")) {
  Passo 'Sem cliente configurado: instalando o curso de exemplo (Blue Lagoon)'
  pnpm assets:exemplo
} else {
  Passo 'Atualizando o índice de assets'
  pnpm assets:index
}

$url = "http://localhost:5173/?curso=$([uri]::EscapeDataString($Curso))&prefixo=$Prefixo&buraco=$Buraco"
Passo "Abrindo $url (feche esta janela para parar o servidor)"
# Abre o navegador assim que o servidor responder.
Start-Job -ScriptBlock {
  param($u)
  for ($i = 0; $i -lt 60; $i++) {
    try { Invoke-WebRequest 'http://localhost:5173' -UseBasicParsing -TimeoutSec 1 | Out-Null; break }
    catch { Start-Sleep -Milliseconds 500 }
  }
  Start-Process $u
} -ArgumentList $url | Out-Null
pnpm dev

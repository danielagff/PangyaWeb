# Passos em comum dos scripts de um clique (jogar.ps1 e servidor.ps1).
$ErrorActionPreference = 'Stop'

function Passo($texto) { Write-Host "`n==> $texto" -ForegroundColor Cyan }

# Baixa a versão nova, instala dependências e prepara os assets do jogo.
function Atualizar {
  Passo 'Baixando a versão mais nova do GitHub'
  git pull --ff-only
  if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host '   ATENÇÃO: não consegui baixar a versão nova (veja a mensagem do git acima).' -ForegroundColor Red
    Write-Host '   O jogo vai abrir na versão antiga. Mande um print desta janela no chat.' -ForegroundColor Red
    Write-Host ''
  }
  Write-Host ('   Versão: ' + (git log -1 --format='%h %cd' --date=format:'%d/%m %H:%M'))

  Passo 'Instalando dependências'
  pnpm install

  # Na primeira vez extrai o cliente (ou o curso de exemplo); depois só refaz o índice.
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
}

# Fecha um servidor antigo que ainda esteja ligado nessa porta (senão o navegador abre ele,
# com a versão velha, e o novo não consegue ligar).
function LiberarPorta($porta) {
  $antigos = Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($id in $antigos) {
    Write-Host "   Fechando servidor antigo na porta $porta (processo $id)" -ForegroundColor Yellow
    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
  }
}

# Abre o navegador assim que `$url` responder (em segundo plano).
function AbrirQuandoPronto($url) {
  Start-Job -ScriptBlock {
    param($u)
    for ($i = 0; $i -lt 120; $i++) {
      try { Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 1 | Out-Null; break }
      catch { Start-Sleep -Milliseconds 500 }
    }
    Start-Process $u
  } -ArgumentList $url | Out-Null
}

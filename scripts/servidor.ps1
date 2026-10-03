# Liga o servidor da partida para jogar com amigos: o seu PC é o servidor e eles só
# precisam do navegador. Uso: clique duas vezes em servidor.cmd.
#
# - Mesma rede (Wi-Fi/cabo): os amigos abrem http://<seu IP>:7777 (aparece na tela).
# - Pela internet: se o cloudflared estiver instalado (winget install Cloudflare.cloudflared),
#   o script cria um link público temporário (https://….trycloudflare.com) para mandar a eles.
Set-Location (Split-Path $PSScriptRoot -Parent)
. "$PSScriptRoot/comum.ps1"

Atualizar

Passo 'Compilando o jogo'
pnpm build

$porta = 7777
LiberarPorta $porta
if (Get-Command cloudflared -ErrorAction SilentlyContinue) {
  Passo 'Criando o link para amigos pela internet (cloudflared)'
  $log = Join-Path $env:TEMP 'pangyaweb-tunel.log'
  Remove-Item $log -ErrorAction SilentlyContinue
  $tunel = Start-Process cloudflared -ArgumentList @('tunnel', '--url', "http://localhost:$porta") `
    -RedirectStandardError $log -WindowStyle Hidden -PassThru
  $link = $null
  for ($i = 0; $i -lt 40 -and -not $link; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Path $log) {
      $achado = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
      if ($achado) { $link = $achado.Matches[0].Value }
    }
  }
  if ($link) {
    Write-Host "`n   Link para os amigos: $link/?online" -ForegroundColor Green
    Set-Clipboard "$link/?online"
    Write-Host '   (já copiado — é só colar no WhatsApp/Discord)' -ForegroundColor Green
  } else {
    Write-Host '   Não consegui criar o link (veja o log em ' $log ')' -ForegroundColor Yellow
  }
  Register-EngineEvent PowerShell.Exiting -Action { Stop-Process -Id $tunel.Id -ErrorAction SilentlyContinue } | Out-Null
} else {
  Write-Host "`n   Para amigos fora da sua rede, instale o cloudflared e rode de novo:" -ForegroundColor Yellow
  Write-Host '   winget install Cloudflare.cloudflared' -ForegroundColor Yellow
}

Write-Host "`n   Mapeador de personagens (com o servidor ligado): http://localhost:$porta/mapeador.html" -ForegroundColor Green
Passo 'Ligando o servidor (feche esta janela para parar)'
AbrirQuandoPronto "http://localhost:$porta/"
$env:PORT = $porta
pnpm --filter @pangya/server start

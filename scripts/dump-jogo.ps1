# Tira uma cópia do ProjectG.exe JÁ DESCRIPTOGRAFADO da memória (o arquivo é protegido e
# só se abre quando roda) e manda para o repositório PRIVADO pangyaweb-dump, para o Claude
# procurar a câmera da tacada no código. Uso: clique duas vezes em dump-jogo.cmd.
#
# Como: se o ProjectG já estiver aberto (por exemplo, jogando num servidor), liga-se a ele
# e não fecha no fim. Senão, abre o ProjectG.exe da pasta do cliente (sem servidor ele pode
# mostrar um erro ou a tela de login — tanto faz, o código já está aberto na memória) e
# fecha depois. Nos dois casos usa o PE-sieve
# (github.com/hasherezade/pe-sieve, livre) para salvar o módulo da memória. Nada disso
# entra no repositório do PangyaWeb (fica em assets/dump, que o git ignora).
Set-Location (Split-Path $PSScriptRoot -Parent)
. "$PSScriptRoot/comum.ps1"
$ErrorActionPreference = 'Continue'

# Pasta do cliente: PANGYA_DIR do .env (como a extração) ou ../cliente-jp.
$cliente = $null
if (Test-Path '.env') {
  $linha = Get-Content '.env' | Where-Object { $_ -match '^\s*PANGYA_DIR\s*=' } | Select-Object -First 1
  if ($linha) { $cliente = ($linha -split '=', 2)[1].Trim().Trim('"') }
}
if (-not $cliente) { $cliente = Join-Path (Split-Path (Get-Location) -Parent) 'cliente-jp' }

# Jogo já aberto? (Win32_Process dá o caminho mesmo de um processo 32 bits.)
$jaAberto = Get-CimInstance Win32_Process -Filter "Name LIKE 'ProjectG%.exe'" -ErrorAction SilentlyContinue |
  Select-Object -First 1
# Sem caminho = o jogo roda como administrador; a cópia também precisa ser (o Windows pede).
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole('Administrators')
if ($jaAberto -and -not $jaAberto.ExecutablePath -and -not $admin) {
  Passo 'O jogo aberto roda como administrador: abrindo outra janela como administrador'
  Start-Process cmd -Verb RunAs -Wait -ArgumentList "/c `"powershell -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" & pause`""
  exit 0
}

$guardado = 'assets/dump/caminho.txt'
$exe = $null
if ($jaAberto -and $jaAberto.ExecutablePath) { $exe = $jaAberto.ExecutablePath }
if (-not $exe -and (Test-Path $guardado)) { $exe = (Get-Content $guardado -Raw).Trim() }
if (-not $exe -and $jaAberto) { $exe = $jaAberto.Name }
if (-not $exe -or ((-not $jaAberto) -and -not (Test-Path $exe))) {
  $exe = Get-ChildItem -LiteralPath $cliente -Filter 'ProjectG*.exe' -Recurse -Depth 2 -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $exe) {
  Passo 'Escolha o ProjectG.exe'
  Add-Type -AssemblyName System.Windows.Forms
  $dialogo = New-Object System.Windows.Forms.OpenFileDialog
  $dialogo.Title = 'Onde está o ProjectG.exe?'
  $dialogo.Filter = 'ProjectG|ProjectG*.exe|Programas|*.exe'
  if ($dialogo.ShowDialog() -ne 'OK') { Write-Host 'Nada escolhido.'; exit 0 }
  $exe = $dialogo.FileName
}
New-Item -ItemType Directory -Force -Path 'assets/dump' | Out-Null
Set-Content -Path $guardado -Value $exe -Encoding UTF8
Write-Host "   Jogo: $exe"
$pasta = Split-Path $exe -Parent
if ($pasta -and (Test-Path (Join-Path $pasta 'GameGuard'))) {
  Write-Host '   Este cliente tem GameGuard: ele pode bloquear a cópia. Tentando mesmo assim.' -ForegroundColor Yellow
}

# PE-sieve de 32 bits (o ProjectG é 32 bits).
$ferramentas = 'assets/dump/ferramentas'
New-Item -ItemType Directory -Force -Path $ferramentas | Out-Null
$pesieve = Join-Path $ferramentas 'pe-sieve32.exe'
if (-not (Test-Path $pesieve)) {
  Passo 'Baixando o PE-sieve'
  Invoke-WebRequest 'https://github.com/hasherezade/pe-sieve/releases/latest/download/pe-sieve32.exe' `
    -OutFile $pesieve -UseBasicParsing
  Unblock-File $pesieve -ErrorAction SilentlyContinue
}
if (-not (Test-Path $pesieve)) {
  throw 'Não consegui baixar o PE-sieve (o antivírus pode ter apagado). Mande um print no chat.'
}
$pesieve = (Resolve-Path $pesieve).Path

$saida = (Resolve-Path 'assets/dump').Path
$copias = Join-Path $saida 'copias'
Remove-Item -Recurse -Force $copias -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $copias | Out-Null

$nome = [System.IO.Path]::GetFileNameWithoutExtension($exe)
$ids = @()
if ($jaAberto) {
  $nome = [System.IO.Path]::GetFileNameWithoutExtension($jaAberto.Name)
  Passo "Usando o jogo que já está aberto (processo $($jaAberto.ProcessId)); não feche até terminar"
  # Já está rodando há tempo: uma cópia basta.
  $esperas = @(0)
} else {
  Passo 'Abrindo o jogo (não feche; se aparecer um erro ou o login, deixe na tela)'
  Start-Process -FilePath $exe -WorkingDirectory $pasta | Out-Null
  # Copia algumas vezes (o código abre aos poucos): 3 s, 8 s e 15 s depois de abrir.
  $esperas = 3, 8, 15
}
foreach ($espera in $esperas) {
  if ($jaAberto) { $alvo = Get-Process -Id $jaAberto.ProcessId -ErrorAction SilentlyContinue }
  else { $alvo = Get-Process -Name $nome -ErrorAction SilentlyContinue | Select-Object -First 1 }
  for ($i = 0; -not $alvo -and $i -lt 10; $i++) {
    Start-Sleep -Milliseconds 500
    $alvo = Get-Process -Name $nome -ErrorAction SilentlyContinue | Select-Object -First 1
  }
  if (-not $alvo) { break }
  $ids += $alvo.Id
  if (-not $jaAberto) {
    $desde = ((Get-Date) - $alvo.StartTime).TotalSeconds
    if ($espera -gt $desde) { Start-Sleep -Seconds ($espera - $desde) }
  }
  if ($alvo.HasExited) { break }
  if ($jaAberto) {
    Write-Host '   Copiando da memória…'
    $dir = Join-Path $copias 'aberto'
  } else {
    Write-Host "   Copiando da memória (aos $espera s)…"
    $dir = Join-Path $copias "aos-${espera}s"
  }
  # Duas formas: como está na memória (V) e realinhada com as importações refeitas (R).
  & $pesieve /pid $alvo.Id /dmode V /data 3 /dir (Join-Path $dir 'memoria') /quiet | Out-Null
  & $pesieve /pid $alvo.Id /dmode R /imp A /data 3 /dir (Join-Path $dir 'realinhado') /quiet | Out-Null
}
$aberto = $null
if (-not $jaAberto) { $aberto = Get-Process -Name $nome -ErrorAction SilentlyContinue }
if ($aberto) {
  Write-Host '   Fechando o jogo.'
  $aberto | Stop-Process -Force -ErrorAction SilentlyContinue
}

$achados = Get-ChildItem -LiteralPath $copias -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Extension -in '.exe', '.dll' -and $_.Name -match [regex]::Escape($nome) }
if (-not $achados) {
  Write-Host ''
  Write-Host '   Não saiu a cópia do jogo (ele fechou rápido ou algo bloqueou).' -ForegroundColor Yellow
  Write-Host '   Vou mandar os relatórios mesmo assim para o Claude ver o que houve.' -ForegroundColor Yellow
} else {
  foreach ($a in $achados) {
    Write-Host ("   Cópia: {0} ({1:N0} MB)" -f $a.FullName.Substring($saida.Length + 1), ($a.Length / 1MB)) -ForegroundColor Green
  }
}
# Arquivos grandes demais para o GitHub ficam de fora.
Get-ChildItem -LiteralPath $copias -Recurse -File | Where-Object { $_.Length -gt 95MB } | ForEach-Object {
  Write-Host "   Fica de fora (maior que 95 MB): $($_.Name)" -ForegroundColor Yellow
  Remove-Item -LiteralPath $_.FullName -Force
}
@(
  "jogo: $exe"
  "processos: $($ids -join ', ')"
  "ja estava aberto: $([bool]$jaAberto)"
  "data: $(Get-Date -Format 's')"
  "windows: $([System.Environment]::OSVersion.VersionString)"
) | Set-Content -Path (Join-Path $copias 'info.txt') -Encoding UTF8

# Envio: repositório privado pangyaweb-dump (git separado olhando para assets/dump/copias).
$remoto = git remote get-url origin
if ($remoto -notmatch 'github\.com[:/]([^/]+)/') { throw "Não entendi o endereço do repositório: $remoto" }
$dono = $Matches[1]
$repo = 'pangyaweb-dump'
$url = "https://github.com/$dono/$repo.git"
Passo "Enviando para $dono/$repo (privado)"
git ls-remote $url 2>$null | Out-Null
while ($LASTEXITCODE -ne 0) {
  Write-Host "   O repositório $dono/$repo ainda não existe." -ForegroundColor Yellow
  Write-Host '   Abrindo o GitHub: deixe PRIVATE marcado e clique em "Create repository".' -ForegroundColor Yellow
  Start-Process "https://github.com/new?name=$repo&visibility=private"
  Read-Host '   Depois de criar, aperte Enter aqui'
  git ls-remote $url 2>$null | Out-Null
}
$gitDir = Join-Path $saida '.git-envio'
$git = @('--git-dir', $gitDir, '--work-tree', $copias, '-c', 'core.autocrlf=false',
  '-c', 'user.name=PangyaWeb', '-c', 'user.email=pangyaweb@users.noreply.github.com')
if (-not (Test-Path $gitDir)) {
  git init --bare --quiet $gitDir
  git --git-dir $gitDir config core.bare false
  git --git-dir $gitDir remote add origin $url
}
git @git add -A .
git @git commit --quiet -m "Cópia da memória do jogo ($(Get-Date -Format 'dd/MM HH:mm'))"
git @git branch -M main
git @git -c http.postBuffer=524288000 push --progress --force -u origin HEAD:refs/heads/main
if ($LASTEXITCODE -ne 0) { throw 'O envio falhou (veja a mensagem acima). Rode de novo.' }

Passo 'Pronto! Diga ao Claude no chat que o dump subiu.'

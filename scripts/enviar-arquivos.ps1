# Envia os arquivos extraídos do jogo (assets/original) para repositórios PRIVADOS do
# GitHub, um por tipo (dados, sons, modelos, imagens), para o Claude poder ler na nuvem.
# Grupo que passar do limite vira parte A, B, C… (pangyaweb-imagens-a, -b, …).
# Uso: clique duas vezes em enviar-arquivos.cmd. Na próxima vez, só manda o que mudou.
#
# Sem cópia: cada repositório é um git separado (em assets/.envio/<nome>.git) olhando para
# a própria pasta assets/original. Nada disso entra no repositório do PangyaWeb.
Set-Location (Split-Path $PSScriptRoot -Parent)
. "$PSScriptRoot/comum.ps1"
# git escreve avisos no stderr; os erros de verdade são conferidos pelo código de saída.
$ErrorActionPreference = 'Continue'

$origem = (Resolve-Path 'assets/original' -ErrorAction SilentlyContinue).Path
if (-not $origem) { throw 'Não achei assets/original. Rode o servidor.cmd uma vez antes (ele extrai o jogo).' }

# Dono dos repositórios: o mesmo do PangyaWeb (github.com/<dono>/PangyaWeb).
$remoto = git remote get-url origin
if ($remoto -notmatch 'github\.com[:/]([^/]+)/') { throw "Não entendi o endereço do repositório: $remoto" }
$dono = $Matches[1]
# Testes: PANGYA_ENVIO_BASE troca o endereço (ex.: file:///tmp/remotos) e
# PANGYA_ENVIO_LIMITE_MB o tamanho das partes.
$base = if ($env:PANGYA_ENVIO_BASE) { $env:PANGYA_ENVIO_BASE } else { "https://github.com/$dono" }

# Tipos de arquivo de cada grupo (o que não estiver em nenhum vai para "dados").
$grupos = [ordered]@{
  'dados'   = @()  # scripts, tabelas, animações, câmeras, efeitos, dados dos cursos…
  'sons'    = @('wav', 'mp3', 'ogg')
  'modelos' = @('pet', 'mpet', 'bpet')
  'imagens' = @('jpg', 'jpeg', 'tga', 'dds', 'png', 'bmp', 'psd', 'gif')
}
# Tamanho máximo de cada repositório (parte) e de cada arquivo (o GitHub recusa > 100 MB).
$limiteParte = if ($env:PANGYA_ENVIO_LIMITE_MB) { [double]$env:PANGYA_ENVIO_LIMITE_MB * 1MB } else { 900MB }
$limiteArquivo = 95MB

function GrupoDe($arquivo) {
  $ext = $arquivo.Extension.TrimStart('.').ToLower()
  foreach ($g in $grupos.Keys) { if ($grupos[$g] -contains $ext) { return $g } }
  return 'dados'
}

Passo 'Medindo os arquivos'
$todos = Get-ChildItem -LiteralPath $origem -Recurse -File |
  Where-Object { $_.Name -notlike '.*' } |
  Sort-Object FullName
$grandes = $todos | Where-Object { $_.Length -gt $limiteArquivo }
foreach ($f in $grandes) {
  Write-Host ("   Fica de fora (maior que 95 MB): {0} ({1:N0} MB)" -f $f.FullName.Substring($origem.Length + 1), ($f.Length / 1MB)) -ForegroundColor Yellow
}

# Divide cada grupo em partes de até $limiteParte, na ordem das pastas.
$repos = [System.Collections.Generic.List[object]]::new()
foreach ($g in $grupos.Keys) {
  $arquivos = @($todos | Where-Object { $_.Length -le $limiteArquivo -and (GrupoDe $_) -eq $g })
  if ($arquivos.Count -eq 0) { continue }
  $partes = [System.Collections.Generic.List[object]]::new()
  $atual = [System.Collections.Generic.List[object]]::new()
  $tamanho = 0
  foreach ($f in $arquivos) {
    if ($atual.Count -gt 0 -and $tamanho + $f.Length -gt $limiteParte) {
      $partes.Add([pscustomobject]@{ Arquivos = $atual; Tamanho = $tamanho })
      $atual = [System.Collections.Generic.List[object]]::new()
      $tamanho = 0
    }
    $atual.Add($f)
    $tamanho += $f.Length
  }
  $partes.Add([pscustomobject]@{ Arquivos = $atual; Tamanho = $tamanho })
  for ($i = 0; $i -lt $partes.Count; $i++) {
    $nome = if ($partes.Count -eq 1) { "pangyaweb-$g" } else { "pangyaweb-$g-$([char](97 + $i))" }
    $repos.Add([pscustomobject]@{ Nome = $nome; Arquivos = $partes[$i].Arquivos; Tamanho = $partes[$i].Tamanho })
  }
}

Write-Host ''
foreach ($r in $repos) {
  Write-Host ("   {0,-24} {1,7:N0} arquivos  {2,7:N0} MB" -f $r.Nome, $r.Arquivos.Count, ($r.Tamanho / 1MB))
}
Write-Host ''
$resposta = Read-Host 'Enviar para o GitHub (repositórios PRIVADOS)? [S/N]'
if ($resposta -notmatch '^[sS]') { Write-Host 'Nada enviado.'; exit 0 }

$envio = Join-Path (Split-Path $origem -Parent) '.envio'
New-Item -ItemType Directory -Force -Path $envio | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding $false

foreach ($r in $repos) {
  $url = "$base/$($r.Nome).git"
  Passo "$($r.Nome): $($r.Arquivos.Count) arquivos, $([math]::Round($r.Tamanho / 1MB)) MB"

  # O repositório existe? Se não, abre a página do GitHub já preenchida para criar.
  git ls-remote $url 2>$null | Out-Null
  while ($LASTEXITCODE -ne 0) {
    Write-Host "   O repositório $dono/$($r.Nome) ainda não existe." -ForegroundColor Yellow
    Write-Host '   Abrindo o GitHub: deixe PRIVATE marcado e clique em "Create repository".' -ForegroundColor Yellow
    Start-Process "https://github.com/new?name=$($r.Nome)&visibility=private"
    Read-Host '   Depois de criar, aperte Enter aqui'
    git ls-remote $url 2>$null | Out-Null
  }

  $gitDir = Join-Path $envio "$($r.Nome).git"
  $git = @('--git-dir', $gitDir, '--work-tree', $origem, '--literal-pathspecs',
    '-c', 'core.quotepath=false', '-c', 'core.autocrlf=false', '-c', 'core.longpaths=true',
    '-c', 'user.name=PangyaWeb', '-c', 'user.email=pangyaweb@users.noreply.github.com')
  if (-not (Test-Path $gitDir)) {
    git init --bare --quiet $gitDir
    git --git-dir $gitDir config core.bare false
    git --git-dir $gitDir remote add origin $url
  }
  # Só os arquivos desta parte (lista em UTF-8: nomes em coreano).
  $lista = Join-Path $envio "$($r.Nome).txt"
  $relativos = $r.Arquivos | ForEach-Object { $_.FullName.Substring($origem.Length + 1).Replace('\', '/') }
  [System.IO.File]::WriteAllLines($lista, [string[]]$relativos, $utf8)
  Write-Host '   Preparando os arquivos (pode levar alguns minutos sem mostrar nada)…'
  git @git add --pathspec-from-file=$lista
  if ($LASTEXITCODE -ne 0) { throw "git add falhou em $($r.Nome)" }
  git @git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    git @git commit --quiet -m "Arquivos do jogo ($($r.Nome))"
    git @git branch -M main
  }
  # Já está no GitHub? (um envio interrompido deixa o pacote pronto aqui, sem ter subido)
  $local = git @git rev-parse --verify --quiet HEAD
  if (-not $local) { Write-Host '   Nenhum arquivo.'; continue }
  $remota = (git ls-remote $url refs/heads/main) -split '\s+' | Select-Object -First 1
  if ($remota -eq $local) { Write-Host '   Já está no GitHub (nada mudou).'; continue }
  Write-Host '   Enviando (a porcentagem aparece abaixo; na primeira vez o Windows pode pedir para entrar no GitHub)…'
  git @git -c http.postBuffer=524288000 push --progress -u origin main
  if ($LASTEXITCODE -ne 0) { throw "O envio de $($r.Nome) falhou (veja a mensagem acima). Rode de novo: ele continua de onde parou." }
}

Passo 'Pronto! Diga ao Claude no chat que os arquivos subiram.'

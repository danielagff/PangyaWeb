@echo off
rem Clique duas vezes: abre o ProjectG.exe, copia o codigo dele ja descriptografado da
rem memoria e manda para o repositorio PRIVADO pangyaweb-dump (detalhes em
rem scripts\dump-jogo.ps1). Serve para o Claude achar a camera da tacada.
cd /d "%~dp0"
git pull --ff-only
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dump-jogo.ps1" %*
echo.
pause

@echo off
rem Clique duas vezes para enviar os arquivos extraidos do jogo para os repositorios PRIVADOS
rem pangyaweb-* do GitHub (detalhes em scripts\enviar-arquivos.ps1).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\enviar-arquivos.ps1" %*
echo.
pause

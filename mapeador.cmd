@echo off
rem Clique duas vezes para abrir o mapeador de personagens (detalhes em scripts\mapeador.ps1).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\mapeador.ps1" %*
echo.
echo O mapeador parou. Se apareceu algum erro acima, mande um print desta janela.
pause

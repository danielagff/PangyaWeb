@echo off
rem Clique duas vezes para abrir o mapeador de personagens (detalhes em scripts\mapeador.ps1).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\mapeador.ps1" %*
if errorlevel 1 pause

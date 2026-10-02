@echo off
rem Clique duas vezes para ligar o servidor e jogar com amigos (detalhes em scripts\servidor.ps1).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\servidor.ps1" %*
if errorlevel 1 pause

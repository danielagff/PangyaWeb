@echo off
rem Clique duas vezes para atualizar e abrir o PangyaWeb (detalhes em scripts\jogar.ps1).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\jogar.ps1" %*
if errorlevel 1 pause

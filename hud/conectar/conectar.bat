@echo off
rem CMLeague Conectar: doble clic para instalar (el botón Conectar de la web abre el juego y entra a la partida).
rem conectar.bat -Desinstalar lo saca.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0conectar.ps1" %*

@echo off
rem Agente de cámara del HUD: doble clic, o camara.bat <link de tu /control>.
rem Sin link usa el relay local (http://127.0.0.1:8090/control).
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0camara.ps1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0camara.ps1" -Url "%~1"
)

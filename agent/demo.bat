@echo off
rem Demo contra la API local (puerto 8799). Usa la version de pruebas: no se distribuye.
if not exist "%~dp0build\CMLeagueAC_test.exe" ( echo Primero corre build.bat & exit /b 1 )
start "" "%~dp0build\CMLeagueAC_test.exe" --portable --api http://localhost:8799 --data-dir "%TEMP%\CMLeagueAC-demo"

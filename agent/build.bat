@echo off
rem Compila CMLeagueAC.exe (64 bits, sin DLL externas) en agent\build. Necesita Build Tools con C++ y el SDK de Windows.
setlocal
for /f "tokens=*" %%i in ('call "%%ProgramFiles(x86)%%\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath') do set "VS=%%i"
if not defined VS ( echo No se encontro Visual Studio con C++ & exit /b 1 )
call "%VS%\VC\Auxiliary\Build\vcvars64.bat" >nul || exit /b 1
cd /d "%~dp0"
if not exist build mkdir build
cl /nologo /std:c++20 /EHsc /O2 /W4 /WX /utf-8 /MT /DUNICODE /D_UNICODE /Fobuild\ /Febuild\CMLeagueAC.exe src\main.cpp src\ui.cpp src\net.cpp src\store.cpp src\evidence.cpp /link /SUBSYSTEM:WINDOWS || exit /b 1
rem Versión de pruebas: solo ella acepta otra API o capturar sin el juego al frente. No se distribuye.
cl /nologo /std:c++20 /EHsc /O2 /W4 /WX /utf-8 /MT /DUNICODE /D_UNICODE /DAC_TEST /Fobuild\ /Febuild\CMLeagueAC_test.exe src\main.cpp src\ui.cpp src\net.cpp src\store.cpp src\evidence.cpp /link /SUBSYSTEM:WINDOWS

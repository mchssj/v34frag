# Crea (o reemplaza) la tarea programada que graba los clips: procesar.py cada 10 minutos.
# Docs: docs/bitacora/2026-10-23-clips-render-automatico/GUIA_IMPLEMENTACION.md
#
# Uso, en una PowerShell abierta como administrador, desde la carpeta render/:
#   .\instalar_tarea.ps1                  crea la tarea
#   .\instalar_tarea.ps1 -Minutos 15      cada 15 minutos
#   .\instalar_tarea.ps1 -Desinstalar     la borra
#
# La tarea corre con "privilegios más altos" (el launcher de ClientMod es de administrador; así no hay aviso de UAC)
# y "solo cuando el usuario haya iniciado sesión": el juego necesita el escritorio. Si la corrida anterior sigue, no
# arranca otra.
param(
  [int]$Minutos = 10,
  [string]$Python = '',
  [switch]$Desinstalar
)
$ErrorActionPreference = 'Stop'
$nombre = 'CMLeague clips'

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw 'Abre PowerShell como administrador (la tarea corre con privilegios más altos).' }

if ($Desinstalar) {
  Unregister-ScheduledTask -TaskName $nombre -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Tarea '$nombre' borrada."
  return
}

$render = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $render 'procesar.py'
if (-not (Test-Path (Join-Path $render 'config.json'))) { throw "Falta $render\config.json (copia config.example.json y ajusta las rutas)." }

# pythonw: el mismo Python sin ventana de consola (si no, se abre una cada 10 minutos).
if (-not $Python) { $Python = (Get-Command python -ErrorAction Stop).Source }
$pythonw = Join-Path (Split-Path -Parent $Python) 'pythonw.exe'
if (-not (Test-Path $pythonw)) { throw "No encontré pythonw.exe junto a $Python. Pasa la ruta con -Python." }
if ($pythonw -like '*WindowsApps*') { throw 'Ese es el alias de la Microsoft Store: instala Python desde python.org o pasa la ruta con -Python.' }

$accion = New-ScheduledTaskAction -Execute $pythonw -Argument "-I `"$script`"" -WorkingDirectory $render
$disparador = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $Minutos)
$usuario = "$env:USERDOMAIN\$env:USERNAME"
$principal = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Highest
$ajustes = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 3) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName $nombre -Action $accion -Trigger $disparador -Principal $principal -Settings $ajustes `
  -Description 'Graba los videos de los clips de CMLeague (render/procesar.py).' -Force | Out-Null

Write-Host "Tarea '$nombre' creada: cada $Minutos minutos, con $pythonw, como $usuario."
Write-Host "Registro de cada corrida: work_dir\procesar.log (ver config.json)."
Write-Host ''
Write-Host 'Para que grabe siempre, la máquina tiene que quedar con la sesión iniciada y sin suspenderse:'
Write-Host '  - Configuración > Sistema > Energía: "Suspender" en Nunca (con cargador).'
Write-Host '  - Bloquear la pantalla está bien; cerrar la sesión, no (la tarea solo corre con la sesión iniciada).'
$susp = powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE | Select-String 'Current AC Power Setting Index|Índice de configuración de corriente alterna actual'
if ($susp) {
  $seg = [Convert]::ToInt32(($susp.Line -split ':')[-1].Trim(), 16)
  if ($seg -gt 0) { Write-Warning "Con cargador, la máquina se suspende a los $([math]::Round($seg / 60)) minutos sin uso." }
}

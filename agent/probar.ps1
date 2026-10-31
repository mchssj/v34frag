# Demo local del anticheat con un solo clic. No toca produccion: la base, la API y la web son locales.
# Se detiene si la base no es local. Al terminar, Enter cierra la sesion y deja los servidores abiertos.
param([string]$Email = '', [switch]$SinPausa)
$ErrorActionPreference = 'Stop'

$agent = $PSScriptRoot
$backend = (Resolve-Path "$agent\..\web\backend").Path
$frontend = (Resolve-Path "$agent\..\..\anticheat-web\web\frontend").Path
$db = 'supabase_db_v34frag-api'
$bash = 'C:\Program Files\Git\bin\bash.exe'
$exe = "$agent\build\CMLeagueAC_test.exe"

function Paso($t) { Write-Host "`n>> $t" -ForegroundColor Cyan }
function Puerto($p) { [bool](Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue) }
function Sql($q) { (docker exec $db psql -U postgres -d postgres -Atc $q 2>$null | Select-Object -First 1) }
function DockerArriba { & cmd /c "docker info >nul 2>nul"; $LASTEXITCODE -eq 0 }

if (-not $Email) { $Email = Read-Host 'Email de tu cuenta en la web local' }

Paso 'Docker'
if (-not (DockerArriba)) {
    Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
    $fin = (Get-Date).AddMinutes(3)
    while (-not (DockerArriba)) {
        if ((Get-Date) -gt $fin) { throw 'Docker no arranco en 3 minutos.' }
        Start-Sleep 3
    }
}

Paso 'Base local'
Push-Location $backend
& $bash -lc "cd '$($backend -replace '\\','/')' && pnpm db:start" 2>&1 | Select-Object -Last 1
Pop-Location
if (-not (Test-Path "$backend\.dev.vars")) { throw 'Falta web\backend\.dev.vars: ver docs/GUIA_ANTICHEAT.md, paso 2.' }

# Las pruebas automaticas borran el secreto al terminar: se vuelve a cargar siempre.
$secreto = ((Select-String -Path "$backend\.dev.vars" -Pattern '^AC_API_SECRET=(.+)$').Matches[0].Groups[1].Value).Trim()
Sql "update ac_config set api_secret_hash = encode(sha256(convert_to('$secreto', 'UTF8')), 'hex'), capture_min_s = 30, capture_max_s = 30 where id = 1 returning 'secreto cargado, capturas cada 30 s'"

Paso 'API y web'
if (-not (Puerto 8799)) { Start-Process powershell -WindowStyle Minimized -ArgumentList '-NoExit', '-Command', "`$host.UI.RawUI.WindowTitle='Anticheat API'; Set-Location '$backend'; `$env:PORT='8799'; pnpm dev:node" }
if (-not (Puerto 5199)) { Start-Process powershell -WindowStyle Minimized -ArgumentList '-NoExit', '-Command', "`$host.UI.RawUI.WindowTitle='Anticheat web'; Set-Location '$frontend'; pnpm dev --port 5199 --strictPort" }
$fin = (Get-Date).AddMinutes(2)
while (-not ((Puerto 8799) -and (Puerto 5199))) {
    if ((Get-Date) -gt $fin) { throw 'La API o la web no arrancaron en 2 minutos.' }
    Start-Sleep 2
}

Paso 'Cuenta'
Set-Location $backend
pnpm ac:demo preparar $Email 2>&1 | Select-Object -Last 1

Paso 'Aplicacion y panel'
if (-not (Test-Path $exe)) { & cmd /c "`"$agent\build.bat`"" }
if (-not (Get-Process CMLeagueAC_test -ErrorAction SilentlyContinue)) {
    Start-Process $exe -ArgumentList '--portable', '--api', 'http://localhost:8799', '--data-dir', "$env:TEMP\CMLeagueAC-demo"
}
Start-Process 'http://localhost:5199/admin/anticheat'

Paso 'Esperando la vinculacion: acepta en la aplicacion y aprueba el codigo en la web'
$correo = $Email -replace "'", "''"
$fin = (Get-Date).AddMinutes(15)
do {
    if ((Get-Date) -gt $fin) { throw 'No se vinculo en 15 minutos.' }
    Start-Sleep 3
    $n = Sql "select count(*) from ac_devices d join auth.users u on u.id = d.user_id where u.email = '$correo' and d.revoked_at is null and d.last_seen_at > now() - interval '60 seconds'"
} while ($n -eq '0' -or -not $n)

Paso 'Abriendo la sesion'
pnpm ac:demo abrir $Email 2>&1 | Select-String 'linked|reason'
Write-Host "`nListo. Deja el juego al frente: captura cada 30 segundos." -ForegroundColor Green
Write-Host 'Panel: http://localhost:5199/admin/anticheat'

if (-not $SinPausa) {
    Read-Host "`nEnter para cerrar la sesion"
    pnpm ac:demo cerrar $Email 2>&1 | Select-Object -Last 1
    Read-Host 'Sesion cerrada. Enter para salir'
}

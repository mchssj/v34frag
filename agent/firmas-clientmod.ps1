<#
  Firmas buenas de ClientMod (plan docs/bitacora/2026-11-27-anticheat-sin-eac, sección 7).

  Calcula el SHA-256 de cada .dll y .exe de una instalación de ClientMod y escribe un .sql que los carga en ac_signatures
  como 'good' (kinds module y game_file). Sin esto, cada sesión llena el panel de marcas module_unsigned: las DLL del v34 y de
  ClientMod no tienen firma digital. Va por hash y no por nombre: un cheat puede llamarse client.dll.

  Se corre con una instalación limpia, recién bajada de ClientMod, y se repite con cada versión nueva (los hashes cambian).
  Mira solo lo que trae ClientMod: la raíz, bin, bin_clientmod y EasyAntiCheat. Lo de cstrike* es contenido del jugador.

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File agent\firmas-clientmod.ps1 -Carpeta C:\CSSv34_ClientMod -Salida firmas.sql
  Y el .sql se aplica en la base (en producción, por el túnel). Volver a aplicarlo no duplica nada.
#>
param(
    [Parameter(Mandatory = $true)][string]$Carpeta,
    [Parameter(Mandatory = $true)][string]$Salida
)
$ErrorActionPreference = 'Stop'

$raiz = (Resolve-Path $Carpeta).Path.TrimEnd('\')
$launcher = Join-Path $raiz 'CMLauncher.exe'
if (-not (Test-Path $launcher)) { throw "No es una carpeta de ClientMod: falta CMLauncher.exe en $raiz" }
$version = (Get-Item $launcher).VersionInfo.ProductVersion
if (-not $version) { $version = 'sin version' }

$archivos = @()
$archivos += Get-ChildItem -LiteralPath $raiz -File | Where-Object { $_.Extension -in '.dll', '.exe' }
foreach ($sub in 'bin', 'bin_clientmod', 'EasyAntiCheat') {
    $dir = Join-Path $raiz $sub
    if (Test-Path $dir) { $archivos += Get-ChildItem -LiteralPath $dir -File -Recurse | Where-Object { $_.Extension -in '.dll', '.exe' } }
}

function Sql([string]$s) { "'" + $s.Replace("'", "''") + "'" }

$filas = @()
$vistos = @{}
foreach ($a in $archivos | Sort-Object FullName) {
    $sha = (Get-FileHash -LiteralPath $a.FullName -Algorithm SHA256).Hash.ToLower()
    $rel = $a.FullName.Substring($raiz.Length + 1)
    $clave = "$sha|$($a.Name.ToLower())"
    if ($vistos.ContainsKey($clave)) { continue }
    $vistos[$clave] = $true
    $label = "ClientMod $version ($rel)"
    if ($label.Length -gt 120) { $label = $label.Substring(0, 117) + '...' }
    $filas += "  ($(Sql $sha), $(Sql $a.Name.ToLower()), $(Sql $label))"
}

$sql = @"
-- Firmas buenas de ClientMod ${version}: $($filas.Count) archivos de $raiz.
-- Generado por agent/firmas-clientmod.ps1 el $(Get-Date -Format 'yyyy-MM-dd HH:mm'). Volver a aplicarlo no duplica nada.
begin;
insert into public.ac_signatures (sha256, name, kinds, verdict, label)
select v.sha256, v.name, array['module', 'game_file'], 'good', v.label
  from (values
$($filas -join ",`n")
  ) as v(sha256, name, label)
 where not exists (select 1 from public.ac_signatures s where s.sha256 = v.sha256 and s.name = v.name and s.verdict = 'good');
commit;
"@

$utf8 = New-Object System.Text.UTF8Encoding($false)
$destino = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Salida)
[System.IO.File]::WriteAllText($destino, $sql, $utf8)
Write-Host "ClientMod $version`: $($filas.Count) archivos en $Salida"

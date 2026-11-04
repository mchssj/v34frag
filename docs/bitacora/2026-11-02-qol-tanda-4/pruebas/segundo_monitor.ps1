# Mueve la ventana del srcds de prueba al monitor que no es el principal (si hay uno), para que no tape el trabajo.
# Uso: powershell -NoProfile -File segundo_monitor.ps1 [-Proceso srcds] [-Espera 30]
param(
    [string]$Proceso = "srcds",
    [int]$Espera = 30
)

Add-Type -AssemblyName System.Windows.Forms
# Add-Type compila en la carpeta temporal. Si el TEMP heredado es C:\Windows\TEMP (lo pasa bash), a veces no se puede
# escribir ahí: se usa la del usuario.
$env:TMP = Join-Path $env:LOCALAPPDATA "Temp"
$env:TEMP = $env:TMP
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class Ventana {
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int w, int h, uint flags);
}
"@

$otro = [System.Windows.Forms.Screen]::AllScreens | Where-Object { -not $_.Primary } | Select-Object -First 1
if (-not $otro) { exit 0 }   # un solo monitor: se deja donde está

$hasta = (Get-Date).AddSeconds($Espera)
while ((Get-Date) -lt $hasta) {
    $p = Get-Process -Name $Proceso -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
    if ($p) {
        $a = $otro.WorkingArea
        # SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE: se mueve sin cambiar el tamaño ni robar el foco.
        [void][Ventana]::SetWindowPos($p.MainWindowHandle, [IntPtr]::Zero, $a.X + 20, $a.Y + 20, 0, 0, 0x0001 -bor 0x0004 -bor 0x0010)
        exit 0
    }
    Start-Sleep -Milliseconds 300
}

# CMLeague Conectar: entrar a la partida del matchmaking con un clic.
#
# El botón "Conectar" de la web usa un link cmleague://connect/<ip:puerto>/<contraseña>. Los links steam:// abren el
# CS:S de Steam, no el v34 de ClientMod. Este programa se instala una vez y registra cmleague:// para el usuario de
# Windows (sin administrador). Al tocar el botón:
#   - con el juego abierto, escribe "password …; connect …" en su consola;
#   - con el juego cerrado, abre el launcher de ClientMod y, cuando aparece la ventana del juego, hace lo mismo.
# Siempre deja el comando copiado, por si algo falla: se pega en la consola del juego.
#
# Uso: conectar.bat (doble clic) instala; conectar.bat -Desinstalar lo saca.
#      powershell -ExecutionPolicy Bypass -File conectar.ps1 [-Link cmleague://…] [-Juego <carpeta>] [-Desinstalar]
#
# El link puede venir de cualquier página: solo se acepta una IP con puerto y una contraseña de letras, números, "-" y
# "_", así nadie puede escribir otros comandos en la consola del juego.
#
# Igual que hud/camara/camara.ps1: el launcher de ClientMod corre como administrador y Windows no deja que un programa
# sin esos permisos le mande teclas, así que para escribir en el juego se vuelve a abrir como administrador.

param(
    [string]$Link = "",
    [string]$Juego = "",
    [string]$Ventana = "CS:S v34 ClientMod",
    [switch]$Desinstalar,
    [switch]$Prueba   # solo valida el link y escribe el comando (no pide administrador ni toca el juego)
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
$env:TMP = Join-Path $env:LOCALAPPDATA "Temp"   # Add-Type compila ahí
$env:TEMP = $env:TMP

$Carpeta = Join-Path $env:LOCALAPPDATA "CMLeague"
$Instalado = Join-Path $Carpeta "conectar.ps1"
$Config = Join-Path $Carpeta "juego.txt"
$Clave = "HKCU:\Software\Classes\cmleague"

function Aviso([string]$msg, [string]$icono = "Information") {
    if ($Prueba) { Write-Output "AVISO: $($msg -replace "`n", ' ')"; return }   # en las pruebas, sin carteles
    [void][System.Windows.Forms.MessageBox]::Show($msg, "CMLeague Conectar", "OK", $icono)
}

# ---- Instalar y desinstalar ----

function Buscar-Juego {
    if ($Juego -and (Test-Path (Join-Path $Juego "CMLauncher.exe"))) { return $Juego }
    foreach ($d in [System.IO.DriveInfo]::GetDrives()) {
        if ($d.DriveType -ne "Fixed") { continue }
        foreach ($n in "CSSv34_ClientMod", "Games\CSSv34_ClientMod", "Juegos\CSSv34_ClientMod") {
            $c = Join-Path $d.RootDirectory.FullName $n
            if (Test-Path (Join-Path $c "CMLauncher.exe")) { return $c }
        }
    }
    $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
    $dlg.Description = "Elegí la carpeta del CS:S v34 de ClientMod (la que tiene CMLauncher.exe)"
    if ($dlg.ShowDialog() -eq "OK" -and (Test-Path (Join-Path $dlg.SelectedPath "CMLauncher.exe"))) { return $dlg.SelectedPath }
    return $null
}

function Instalar {
    $game = Buscar-Juego
    if (-not $game) {
        Aviso "No encontré la carpeta del juego (la que tiene CMLauncher.exe). Volvé a abrir el instalador y elegila." "Warning"
        exit 1
    }
    New-Item -ItemType Directory -Force $Carpeta | Out-Null
    Copy-Item -Force $PSCommandPath $Instalado
    Set-Content -Path $Config -Value $game -Encoding UTF8
    New-Item -Force $Clave | Out-Null
    Set-ItemProperty $Clave "(default)" "URL:CMLeague Conectar"
    Set-ItemProperty $Clave "URL Protocol" ""
    New-Item -Force "$Clave\shell\open\command" | Out-Null
    $cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Instalado`" -Link `"%1`""
    Set-ItemProperty "$Clave\shell\open\command" "(default)" $cmd
    Aviso "Listo. Desde ahora el botón Conectar de la web abre el juego y entra a la partida.`n`nJuego: $game"
}

function Desinstalar {
    if (Test-Path $Clave) { Remove-Item -Recurse -Force $Clave }
    if (Test-Path $Carpeta) { Remove-Item -Recurse -Force $Carpeta }
    Aviso "CMLeague Conectar quedó desinstalado."
}

if ($Desinstalar) { Desinstalar; exit 0 }
if (-not $Link) { Instalar; exit 0 }

# ---- El link ----

$texto = [Uri]::UnescapeDataString($Link.Trim().Trim('"'))
$m = [regex]::Match($texto, '^cmleague://connect/((?:\d{1,3}\.){3}\d{1,3}):(\d{1,5})(?:/([A-Za-z0-9_-]{1,32}))?/?$')
if (-not $m.Success -or [int]$m.Groups[2].Value -gt 65535) {
    Aviso "Ese link no es de una partida de CMLeague." "Warning"
    exit 1
}
$address = "$($m.Groups[1].Value):$($m.Groups[2].Value)"
$comando = if ($m.Groups[3].Success) { "password $($m.Groups[3].Value); connect $address" } else { "connect $address" }
if ($Prueba) { Write-Output $comando; exit 0 }
try { Set-Clipboard -Value $comando } catch { }

# ---- Administrador (para escribir en el juego) ----

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
    try {
        # El link ya validado (sin comillas ni espacios), no el que llegó.
        Start-Process powershell -Verb RunAs -WindowStyle Hidden -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Link `"$texto`" -Ventana `"$Ventana`"" | Out-Null
    } catch {
        Aviso "Sin el permiso de administrador no puedo escribir en el juego.`n`nTe dejé copiado: $comando`nPegalo en la consola del juego." "Warning"
    }
    exit 0
}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public static class ConectarJuego {
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern IntPtr FindWindowW(string cls, string title);
    [DllImport("user32.dll")]
    static extern bool PostMessageW(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")]
    static extern uint MapVirtualKeyW(uint code, uint mapType);

    const uint WM_KEYDOWN = 0x100, WM_KEYUP = 0x101, WM_CHAR = 0x102;
    const uint SCAN_CONSOLE = 0x29;  // la tecla a la izquierda del 1

    public static IntPtr Find(string title) {
        return FindWindowW(null, title);
    }

    static void Key(IntPtr hwnd, uint scan, uint vk) {
        if (vk == 0) vk = MapVirtualKeyW(scan, 1);
        PostMessageW(hwnd, WM_KEYDOWN, new IntPtr(vk), new IntPtr(unchecked((int)(1 | (scan << 16)))));
        Thread.Sleep(50);
        PostMessageW(hwnd, WM_KEYUP, new IntPtr(vk), new IntPtr(unchecked((int)(1 | (scan << 16) | (0xC0u << 24)))));
        Thread.Sleep(50);
    }

    // Igual que en hud/camara: la tecla de la consola puede dejar su carácter en la línea, así que se borra y el texto
    // empieza con ";".
    public static void Console(IntPtr hwnd, string text) {
        Key(hwnd, SCAN_CONSOLE, 0);
        Thread.Sleep(300);
        for (int i = 0; i < 4; i++) Key(hwnd, 0x0E, 0x08);
        foreach (char ch in "; " + text) {
            PostMessageW(hwnd, WM_CHAR, new IntPtr(ch), new IntPtr(1));
            Thread.Sleep(5);
        }
        Key(hwnd, 0x1C, 0x0D);
    }
}
"@

# ---- Al juego ----

$hwnd = [ConectarJuego]::Find($Ventana)
if ($hwnd -eq [IntPtr]::Zero) {
    $game = if (Test-Path $Config) { (Get-Content $Config -Raw).Trim() } else { "" }
    $launcher = Join-Path $game "CMLauncher.exe"
    if (-not $game -or -not (Test-Path $launcher)) {
        Aviso "No encuentro el juego. Abrilo y pegá en la consola lo que te dejé copiado:`n$comando" "Warning"
        exit 1
    }
    Start-Process -FilePath $launcher -WorkingDirectory $game | Out-Null
    # El launcher espera que el jugador apriete Jugar: hasta 3 minutos para que aparezca la ventana del juego.
    $hasta = (Get-Date).AddMinutes(3)
    while ($hwnd -eq [IntPtr]::Zero -and (Get-Date) -lt $hasta) {
        Start-Sleep -Seconds 1
        $hwnd = [ConectarJuego]::Find($Ventana)
    }
    if ($hwnd -eq [IntPtr]::Zero) {
        Aviso "No se abrió el juego. Cuando lo abras, pegá en la consola lo que te dejé copiado:`n$comando" "Warning"
        exit 1
    }
    Start-Sleep -Seconds 12   # que termine de cargar el menú y la consola
}
[ConectarJuego]::Console($hwnd, "$comando; hideconsole")

# Agente de cámara del HUD (docs/bitacora/2026-11-02-hud-camara-automatica).
#
# Escucha el /events del relay (el mismo que usa el HUD de OBS) y, cuando el streamer elige otro jugador en /control,
# escribe spec_player "<nombre>" en la consola de su CS:S conectado a la SourceTV. Así la cámara y la tarjeta grande
# del HUD cambian juntas.
#
# Uso: camara.bat [link de /control o de /hud]      (por defecto el relay local: http://127.0.0.1:8090/control)
#      powershell -ExecutionPolicy Bypass -File camara.ps1 -Url <link> [-Ventana <título>] [-Prueba]
#
# Maneja el juego igual que render/render_clip.py: abre la consola con su tecla, borra la línea, escribe el texto con
# WM_CHAR y aprieta Enter, todo con mensajes a la ventana. El launcher de ClientMod corre como administrador y Windows
# no deja que un programa sin esos permisos le mande teclas: por eso el agente se vuelve a abrir como administrador.
#
# Solo usa lo que ya ve el HUD (con el retraso de tv_delay): nunca el estado en vivo.

param(
    [string]$Url = "http://127.0.0.1:8090/control",
    [string]$Ventana = "CS:S v34 ClientMod",
    [switch]$Prueba  # escribe los comandos acá en lugar de mandarlos al juego (y no pide administrador)
)

$ErrorActionPreference = "Stop"

function Log([string]$msg) {
    Write-Host ("{0} {1}" -f (Get-Date -Format "HH:mm:ss"), $msg)
}

# ---- Administrador ----

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin -and -not $Prueba) {
    $relaunch = "-NoExit -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Url `"$Url`" -Ventana `"$Ventana`""
    try {
        Start-Process powershell -Verb RunAs -ArgumentList $relaunch | Out-Null
    } catch {
        Write-Host "Hace falta aceptar el aviso de Windows (administrador): sin eso no se le pueden mandar teclas al juego."
        Read-Host "Enter para cerrar"
    }
    exit
}

# ---- La dirección de /events ----

# El streamer pega el link de /control o de /hud (local o del VPS, con /s/<token>/): se cambia la última parte por
# events. page=control: el relay cuenta las conexiones "hud" como alguien que transmite, y el agente no lo es.
$base = ($Url -split "[?#]")[0] -replace "/(control|hud)/?$", "" -replace "/+$", ""
if ($base -notmatch "^https?://") {
    Write-Host "El link tiene que empezar con http:// o https:// (el de /control, por ejemplo http://127.0.0.1:8090/control)."
    exit 1
}
$eventsUrl = "$base/events?page=control"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# ---- Ventana del juego y consola ----

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public static class CamaraJuego {
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

    // Igual que render_clip.console_command: la tecla de la consola puede dejar su carácter en la línea ("|" en el
    // teclado latinoamericano), así que se borra con Backspace y el texto empieza con ";". El texto tiene que cerrar
    // la consola (hideconsole).
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

# Si el nombre se puede escribir en la consola: solo caracteres latinos imprimibles, sin comillas ni ";".
function Escribible([string]$name) {
    if (-not $name) { return $false }
    foreach ($c in $name.ToCharArray()) {
        $n = [int]$c
        if ($n -lt 32 -or $n -ge 127 -or $c -eq '"' -or $c -eq ';') { return $false }
    }
    return $true
}

# ---- Seguir al enfocado ----

$script:players = @{}     # uid -> jugador del último state (ya con el retraso de tv_delay)
$script:focus = $null     # el último focus que llegó
$script:pending = $null   # un focus que llegó antes que su jugador en el state
$script:aviso = $null     # para no repetir el mismo aviso

function Avisar([string]$msg) {
    if ($script:aviso -ne $msg) { Log $msg }
    $script:aviso = $msg
}

function Mover($uid) {
    $p = $script:players[[int]$uid]
    if (-not $p) {
        $script:pending = $uid
        return
    }
    $script:pending = $null
    $name = [string]$p.name
    if (-not $p.alive) {
        Log "$name está muerto: la cámara no lo puede seguir."
        return
    }
    if (-not (Escribible $name)) {
        Log "El nombre de $name no se puede escribir en la consola: mové la cámara a mano."
        return
    }
    $cmd = "spec_player `"$name`"; hideconsole; gameui_hide"
    if ($Prueba) {
        Log "[prueba] $cmd"
        return
    }
    $hwnd = [CamaraJuego]::Find($Ventana)
    if ($hwnd -eq [IntPtr]::Zero) {
        Log "No encontré la ventana `"$Ventana`": ¿está abierto el juego?"
        return
    }
    [CamaraJuego]::Console($hwnd, $cmd)
    Log "Cámara en $name."
}

function OnEvent([string]$event, [string]$data) {
    if ($event -eq "state") {
        $s = $data | ConvertFrom-Json
        $map = @{}
        foreach ($p in $s.players) { $map[[int]$p.uid] = $p }
        $script:players = $map
        if ($null -ne $script:pending) { Mover $script:pending }
    } elseif ($event -eq "control") {
        $c = $data | ConvertFrom-Json
        # Solo cuando cambia el enfocado: el control también llega cuando cambian los nombres de los equipos o lo que
        # se ve, y cada comando abre la consola. Para volver a centrar la cámara: Esc y otra vez el jugador.
        if ($c.focus -ne $script:focus) {
            $script:focus = $c.focus
            $script:pending = $null
            if ($null -ne $c.focus) { Mover $c.focus }
        }
    }
}

# ---- Server-Sent Events, con reconexión ----

Log "Agente de cámara. Escuchando $base"
if ($Prueba) { Log "Modo prueba: los comandos se muestran acá y no se mandan al juego." }
else { Log "Ventana del juego: `"$Ventana`". Elegí los jugadores en /control como siempre." }

while ($true) {
    $reader = $null
    try {
        $req = [Net.HttpWebRequest]::Create($eventsUrl)
        $req.Accept = "text/event-stream"
        $req.Timeout = 15000
        $req.ReadWriteTimeout = 60000  # el relay manda un ping cada 15 s
        $res = $req.GetResponse()
        $reader = New-Object IO.StreamReader($res.GetResponseStream(), [Text.Encoding]::UTF8)
        Avisar "Conectado al relay."
        $event = "message"
        $data = New-Object Text.StringBuilder
        while ($null -ne ($line = $reader.ReadLine())) {
            if ($line -eq "") {
                if ($data.Length) { OnEvent $event $data.ToString() }
                $event = "message"
                [void]$data.Clear()
            } elseif ($line.StartsWith(":")) {
                continue
            } elseif ($line.StartsWith("event:")) {
                $event = $line.Substring(6).Trim()
            } elseif ($line.StartsWith("data:")) {
                if ($data.Length) { [void]$data.Append("`n") }
                [void]$data.Append($line.Substring(5).TrimStart())
            }
        }
        Avisar "El relay cortó la conexión; reintento."
    } catch [Net.WebException] {
        $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
        if ($status -eq 404) { Avisar "El relay responde 404: revisá el link (en el VPS, el de tu /control con /s/<token>/)." }
        else { Avisar "No me pude conectar al relay ($($_.Exception.Message)); reintento cada 3 s." }
    } catch {
        # ReadLine llega envuelto: un relay que se cierra es un IOException adentro.
        if ($_.Exception.InnerException -is [IO.IOException]) { Avisar "Se cortó la conexión con el relay; reintento cada 3 s." }
        else { Avisar "Error: $($_.Exception.Message); reintento cada 3 s." }
    } finally {
        if ($reader) { $reader.Dispose() }
    }
    Start-Sleep -Seconds 3
}

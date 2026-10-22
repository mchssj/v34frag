# Plugins y extensiones externos

Todo lo que corre en el servidor real además de `csstv_reporter`. El inventario sirve para saber qué hay instalado cuando el servidor falla, y para reinstalarlo si hace falta.

- **En el repo:** solo los binarios que instalamos nosotros, con la misma estructura de carpetas que el servidor (`server/addons/sourcemod/...`).
- **Lo demás:** lo instalaron el hosting (ExtremeHost) o los admins (kyan, mecha). Acá está anotado con su tamaño y md5 para poder detectar cambios.

Inventario tomado por SFTP el **2026-10-14**. Fechas en hora de Argentina (UTC−3).

## Base

| Qué | Versión / archivo | Notas |
|---|---|---|
| Motor | CS:S v34 (`Steam_PatchVersion 1.0.0.34`), Linux, panel Pterodactyl de ExtremeHost | `srcds_run` con reinicio automático a los 10 s después de un crash |
| Metamod:Source | `addons/metamod.vdf`, `addons/metamod/` | `metaplugins.ini`: `stripper_mm` |
| BufferFix | `addons/bufferfix.vdf` → `addons/bufferfix/bin/bufferfix.so` | Plugin de Metamod contra exploits de buffer de srcds viejos. Imprime "BufferFix loaded!" al arrancar |
| Stripper:Source | `addons/stripper/` | Cambia entidades de los mapas |
| SourceMod | 1.10.0.6490 | El servidor local de pruebas tiene la misma |

## Extensiones de SourceMod (no estándar)

| Archivo | Quién | En el repo | Notas |
|---|---|---|---|
| `accelerator.ext.so` + `accelerator.autoload` + `gamedata/accelerator.games.txt` | Nosotros (2026-10-14) | **Sí**: `server/addons/sourcemod/extensions/` y `gamedata/` (también la `.dll` para el servidor local) | Accelerator 2.5.0 (build 138, `cd575aa`, de builds.limetech.io). Guarda un volcado en cada crash y lo sube a nuestro Worker. Ver [bitácora](bitacora/2026-10-14-crash-servidor-accelerator/) |
| `system2.ext.so` / `.dll` | Nosotros | No (la bajamos de su página) | HTTP para `csstv_reporter` |
| `socket.ext.so` | Hosting (2022) | No | |
| `cssdm.ext.*` (varias plataformas, carpeta `x64/`) | Un admin (2026-10-13 22:50) | No | CSS:DM. No hay ningún plugin de CSS:DM cargado. Esa noche el servidor se cayó en bucle varias veces seguidas |

Las demás (`bintools`, `sdktools`, `sdkhooks`, `game.cstrike`, `clientprefs`, `dbi.*`, `geoip`, `regex`, `topmenus`, `updater`, `webternet`) son las de SourceMod 1.10.

## Plugins de SourceMod (no estándar)

| Plugin | Tamaño | md5 | Instalado | Qué hace |
|---|---|---|---|---|
| `csstv_reporter.smx` | 83946 | | 2026-10-13 22:25 | El nuestro (1.7.0). Código en `server/addons/sourcemod/scripting/` |
| `clientmod.smx` | 24515 | `8f12d362d58d1dacc998667b0bbe4c1d` | 2026-10-13 11:43 | API de ClientMod 1.7.1 (clientmod.ru): detecta el cliente, tags, fixes |
| `clientmod_deathnotice.smx` | 12008 | `41e8b0969786b410b2d13326fa6e3657` | 2026-10-13 11:43 | Íconos extra en el killfeed (ClientMod). Modifica el evento `player_death` |
| `CM_PickupWeapon.smx` | 13004 | `53bb511c937ddfbd222783ea84511ddf` | 2026-10-13 12:04 | Levantar armas con `+use` (ClientMod). Usa SDKCall a `BumpWeapon` |
| `IGN.smx` | 15390 | `d3fc3ff85df5565e8e92af034713ceff` | 2026-10-13 11:54 | 1.0.3, mensajes al conectarse |
| `grenadedrop.smx` | 3622 | `29ea9575221afa2ccd7c8aa353396ebd` | 2026-10-13 13:41 | Tirar granadas (alliedmods t=172315) |
| `spectatorswitch.smx` | 5342 | `c1eee67df1fafb70a0c9c963473718f0` | 2026-10-13 15:52 | 1.1.1 (hsfighter), cambiar de espectador |
| `kigen-ac_redux_legacy.smx` | 58708 | `a3cca8652b395b286ba7f240285184c0` | 2026-10-12 | Anticheat KACR. Log en `logs/KACR.log` (baneos por spam de conexión, cvars corruptas) |
| `SendFileExploitFixV3.3.smx` | 5614 | `874a71caffc7e4db2bf67d6bc5c8e532` | 2026-10-14 16:52 | "Antiflood" de mecha: bloquea el exploit de `SendFile`/`ReceiveFile`. Compilado para CS:GO (2021); carga sin errores en v34 |
| `extremehost.smx` | 4057 | `3fee63e72f6fea47cd639be2d63b585e` | Hosting (2023) | Cambia la descripción del juego con un timer: imprime "Timer Executed" en la consola |
| `extreme_host.smx` | 3687 | `db86bca074beeb2ff3416bc90b9d57a0` | Hosting (2023) | Del hosting: en cada mapa, con un timer, ejecuta `sm_rcon fps_max 150` (visto el 2026-10-18 con `csstv_perf`) |

Agregados después del inventario (vistos el 2026-10-22 por SFTP, sin md5):

| Plugin | Tamaño | Instalado | Qué hace |
|---|---|---|---|
| `Anti_Wallhack_Lite.smx` 1.3.0 (BrokenT) | 14857 | 2026-10-20 01:45 | Anti-wallhack: oculta jugadores, armas y sonidos. Movido a `plugins/disabled/` el 2026-10-22, devuelto a `plugins/` ese mismo día como prueba A/B y **también subido a RBK** (md5 `373446f5…`) ([bitácora](bitacora/2026-10-22-anti-wallhack-y-humo/)) |
| `soft_detector.smx` | 3089 | 2026-10-20 01:46 | Detecta software de trampas (`logs/softdetector.log`) |
| `clientmod_emulator.smx` (+ `.sp`) | 7183 | 2026-10-20 14:27 | Bloquea el emulador de ClientMod (`plugin.clientmod_emulator.cfg`) |
| `convar_detector.smx` (+ `.sp`) | 5198 | 2026-10-20 14:27 | Revisa cvars de los clientes |

KACR: `kacr_eyes_antiwall` (por defecto "1") está en "0" en los dos servidores desde el 2026-10-22. En el servidor real se volvió a prender un rato ese día como prueba A/B y después se apagó otra vez.

Los demás plugins de la carpeta son los de SourceMod 1.10 (`admin-flatfile`, `adminmenu`, `basecommands`, `antiflood` de chat, etc.). En `plugins/disabled/` están SMAC, `mapchooser`, `rockthevote`, `nominations` y las versiones anteriores de `csstv_reporter`.

## Errores conocidos en cada arranque

- `basecommands.smx`: `configs/adminmenu_cfgs.txt` tiene una sección sin cerrar (línea 33).
- `CM_PickupWeapon.smx`: no puede generar su cfg por falta de permiso de escritura.

Ninguno de los dos tumba el servidor.

## Servidor local de pruebas

`E:\CSS DEDICATED SERVER\server`: SourceMod 1.10.0.6490 con las extensiones estándar, System2 y Accelerator (`accelerator.ext.dll`, mismo `core.cfg` apuntando al Worker). No tiene los plugins de ClientMod, KACR ni los del hosting.

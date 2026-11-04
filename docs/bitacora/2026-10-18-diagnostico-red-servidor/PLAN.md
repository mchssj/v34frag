# Plan: diagnóstico de tirones y sonido en el servidor real (#1)

> Planeación original. Estado: **aprobado** por Daniel el 2026-10-18 ("hazlo, solo en el servidor real").

## El problema

En el servidor real (no en RBK) los jugadores se quejan de dos cosas:
- Les cuesta escuchar pasos, puertas y otros sonidos.
- Los jugadores "aparecen y desaparecen", como si el servidor tuviera latencia.

## Lo que se encontró (2026-10-18, solo lectura)

| Hallazgo | Detalle |
|---|---|
| `fps_max` igual al tickrate | El panel arranca con `-tickrate 101 +fps_max 101` (variable `TICK_FPS`). El `fps_max` del servidor tiene que quedar bastante por encima del tickrate; si es igual, los ticks no salen parejos (picos de "var") |
| Tasas cruzadas en `server.cfg` | `sv_minupdaterate 101` con `sv_maxupdaterate 100`, y `sv_mincmdrate 101` con `sv_maxcmdrate 100` |
| Un solo núcleo | El panel fija el servidor a un núcleo (`threads: 2`); en ese momento usaba un 18 % |
| Plugins y sonido | Ningún plugin intercepta sonidos (`AddNormalSoundHook`) ni toca `sv_footsteps`. Corren seguido KACR (`OnGameFrame`) y `clientmod.smx` (`OnPlayerRunCmd`) |
| Logs | Solo los errores conocidos (`adminmenu_cfgs.txt`, `CM_PickupWeapon`) |

Hipótesis: los dos problemas tienen la misma causa. Los ticks irregulares del servidor, o la pérdida y el choke de la red, se ven como tirones, y además se pierden los sonidos que viajan en esos paquetes.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Medir antes de cambiar | Plugin de diagnóstico `csstv_perf` en el servidor real | Para saber si el problema es del servidor (ticks tarde) o de la conexión de cada jugador, y para comparar antes y después de cada cambio |
| Solo el servidor real | No se sube a RBK | Decisión de Daniel: es una herramienta de medición de un problema de ese servidor, no el plugin del juego. Excepción anotada a la regla de despliegue |
| Cambios, de a uno | 1.º `fps_max 600` en `server.cfg` (pisa al del arranque sin tocar el panel); 2.º tasas coherentes (`sv_min*` 66 y `sv_max*` 101) | Para saber qué cambio sirvió. Cada uno se aplica en un cambio de mapa, sin mix en curso, después de juntar datos del anterior |

## 1. Plugin `csstv_perf`

- **En cada tick** (`OnGameFrame`) mide el tiempo desde el tick anterior con `GetEngineTime()`. Cuenta los ticks que tardan más de 1,5 veces, 2 veces y 5 veces el intervalo, y guarda el peor.
- **Cada 30 segundos** (cvar `csstv_perf_interval`) escribe en `addons/sourcemod/logs/csstv_perf_AAAAMMDD.log`:
  - Una línea del servidor: ticks medidos y esperados, ticks tarde por umbral, peor tick en ms y jugadores.
  - Si hay jugadores, una línea por jugador humano: ping, pérdida y choke (de SourceMod, `GetClientAvg*`), y su `rate`, `cl_updaterate` y `cl_cmdrate`.
- **Al cambiar de mapa** escribe el tickrate real y las cvars de red (`fps_max`, `sv_min*`/`sv_max*` de rate, updaterate y cmdrate).
- **`sm_perf`** (admin): muestra en la consola la ventana actual.
- Liviano: una resta y unas comparaciones por tick; sin mensajes a los jugadores.

## 2. Despliegue

- Compilar con el `spcomp` 1.8, como los demás.
- Probar en el servidor local, con bots y la Supabase local.
- Subir `csstv_perf.smx` al servidor real por `SFTP_CSS_*`. Se carga en el próximo cambio de mapa.

## 3. Cómo se lee

- **Ticks tarde y peor tick altos en el momento de una queja:** el problema es del servidor (CPU, `fps_max`, plugins).
- **Servidor limpio y un jugador con pérdida o choke:** es la conexión de ese jugador o su ruta (VPN).
- **A los que se quejan:** pedirles captura de `net_graph 3` en el momento.

# Diagnóstico de tirones y sonido en el servidor real: guía de implementación

## Estado

`csstv_perf` 1.0.0 subido al servidor real el 2026-10-18. Se carga en el próximo cambio de mapa. Los cambios de configuración (`fps_max` y las tasas) siguen **pendientes**: se hacen después de juntar datos de al menos un mix con la configuración actual.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv_perf.sp` | Nuevo |
| `server/addons/sourcemod/plugins/csstv_perf.smx` | Nuevo: compilado con el `spcomp` 1.8 del servidor local. 1.0.0 (subida): 7177 bytes, md5 `22cf5df3…`. 1.1.0 (subida el 2026-10-18): 8352 bytes, md5 `6fadc64f03f728f97520486ed7d185c2` |

## Despliegue (hecho el 2026-10-18)

- Subido **solo al servidor real** por `SFTP_CSS_*` a `cstrike/addons/sourcemod/plugins/csstv_perf.smx`. Antes se comprobó que no existía, y después se verificó el md5 de lo subido.
- **No se sube a RBK**, por decisión de Daniel: es una herramienta para medir un problema del servidor real, no el plugin del juego. Es una excepción a la regla de desplegar en todos los servidores.
- No se recargó nada.
- **Verificar después del cambio de mapa:**
  - `sm plugins list` muestra "CSSTV Perf (1.0.0)".
  - Aparece `addons/sourcemod/logs/csstv_perf_AAAAMMDD.log` con la línea del mapa y las cvars de red.

## Resultado del primer mix (2026-10-18, 23:01 a 23:39, de_inferno, 16-10, 10 jugadores)

Log `csstv_perf_20261018.log` bajado del servidor real (solo lectura). 77 ventanas con 10 jugadores.

| Qué | Dato | Lectura |
|---|---|---|
| `fps_max` real | **150**, no 101 | Lo pone `extreme_host.smx` (plugin del hosting) en cada cambio de mapa, con un timer: `sm_rcon fps_max 150` |
| Ticks | 234 041 de 234 116 (99,97 %) | El servidor no pierde ticks: el CPU alcanza |
| Ticks que llegan tarde (más de 1,5 intervalos, ~15 ms) | **30,4 %** | Los ticks salen a destiempo: uno tarde y el siguiente pegado. Es el efecto de un `fps_max` que no es mucho mayor que el tickrate |
| Más de 2 intervalos (~20 ms) | 0,76 % | — |
| Peor tick | Mediana 23,4 ms, máximo 54,6 ms (una sola vez) | Sin trabas grandes |
| Con 1 a 4 jugadores | El mismo 30,4 % | No depende de la carga: es la configuración |
| Pérdida de los jugadores | 0 % saliente en todos; entrante casi 0 | La red no pierde paquetes |
| Choke saliente | Mediana 0 %, máximo 4,4 % | El servidor les manda todo |
| Choke entrante | Mediana ~1 %; picos sueltos de 80 % de **un** jugador a la vez | Del lado del cliente (FPS del jugador o alt-tab), no del servidor |
| Ping | 27 a 50 ms; daniloev 120 ms | — |

**Conclusión:** la red y el CPU están bien. Lo que se ve raro son los ticks irregulares por `fps_max 150` (forzado por el hosting), que hacen que los jugadores "salten" y que el sonido llegue a destiempo. Subir `fps_max` en `server.cfg` no alcanza: el plugin del hosting lo vuelve a poner en 150 en cada mapa.


1. **Juntar datos de al menos un mix** con la configuración actual, y anotar la hora de las quejas. Pedir capturas de `net_graph 3` a quien se queje.
2. **`fps_max 600` con `csstv_perf` 1.1.0** (hecha y probada en local el 2026-10-18; **subida al servidor real el 2026-10-18**: 8352 bytes, md5 `6fadc64f…` verificado, con la 1.0.0 en `plugins/disabled/csstv_perf_1.0.0.smx`): Daniel no quiere tocar `extreme_host.smx`, así que en lugar de `server.cfg` el plugin vigila `fps_max` y lo vuelve a 600 cada vez que alguien lo cambia (cvar `csstv_perf_fps_max`, 0 = no tocarlo). Se sube al servidor real y carga en el próximo cambio de mapa. Después, medir otro mix y comparar con el primero (30,4 % de ticks a destiempo). Vigilar el uso de CPU: con más FPS el servidor trabaja más. Se aplica en el próximo cambio de mapa, sin mix en curso. Después, juntar datos otra vez y comparar.
3. **Tasas coherentes** en `cfg/server.cfg`: `sv_minupdaterate 66`, `sv_maxupdaterate 101`, `sv_mincmdrate 66`, `sv_maxcmdrate 101`. Hoy los mínimos (101) están por encima de los máximos (100).

Cada paso, con el visto bueno de Daniel y respaldo del `server.cfg`.

## Pruebas

- **Servidor local, 66 de tickrate, con bots:**
  - Carga.
  - Al empezar el mapa escribe el tickrate y las cvars de red.
  - Escribe una línea por ventana: 990 ticks de 990 esperados, peor 16,7 ms.
  - `sm_perf` responde.
- **No se probó la línea por jugador.** Los bots no tienen conexión de red, así que esas líneas se van a ver recién con jugadores reales en el servidor real.
- Durante la prueba, `csstv_reporter` se apartó del servidor local para que nada se conectara a producción. Después se devolvió (md5 `5ca8c752…`, la 1.7.0), y `csstv_perf` se sacó del servidor local.

## En qué se apartó del plan

- El paso de `fps_max 600` no va en `server.cfg`: lo hace `csstv_perf` 1.1.0, porque `extreme_host.smx` lo vuelve a 150 en cada mapa y Daniel prefirió no desactivarlo.

### Prueba de la 1.1.0 (servidor local, 101 de tickrate, `csstv_reporter` apartado)

| Caso | `fps_max` |
|---|---|
| Al cargar (arranque con `+fps_max 101`) | 600 |
| `fps_max 150` por consola | Vuelve a 600 |
| `sm_rcon fps_max 150` (lo que hace el plugin del hosting) | Vuelve a 600 |
| Con `csstv_perf_fps_max 0` | Queda en 150 |
| `csstv_perf_fps_max 600` otra vez | 600 |
| Después de `changelevel` | 600 |

Cada corrección queda en el log: `fps_max 150 → 600 (150)`. La mejora en los ticks **no se puede ver en local**: en Windows salen a destiempo igual con 150 que con 600 (es la resolución del reloj de Windows). Se mide en el servidor real, que es Linux.

## Cómo revertir

Borrar o mover a `plugins/disabled/` el `csstv_perf.smx` del servidor real. Se descarga en el próximo cambio de mapa, o al instante con `sm plugins unload csstv_perf`, que no afecta a los mixes porque no toca el juego.

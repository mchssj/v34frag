# Plugin 2v2 (Wingman): guía de implementación

## Estado

Probado con bots en `C:\Users\Agus\Downloads\cssds` y subido a RBK el 2026-10-30, por pedido de Kyan, antes de terminar las pruebas con jugadores. Se carga en el próximo cambio de mapa y queda inactivo. **RBK no tiene `de_dust2_ob`**, así que todavía no se puede jugar ahí. La compra fuera de la zona no se pudo confirmar.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/v34_wingman.sp` | Nuevo |
| `server/addons/sourcemod/scripting/wingman/map.inc` | Nuevo: sitio, spawns y zonas |
| `server/addons/sourcemod/scripting/wingman/pause.inc` | Nuevo: pausas |
| `server/addons/sourcemod/scripting/wingman/menu.inc` | Nuevo: categoría de `!admin` |
| `server/addons/sourcemod/scripting/wingman/rank.inc` | Nuevo: copia adaptada de `retake/rank.inc` |
| `server/addons/sourcemod/configs/2v2/de_dust2_ob.cfg` | Nuevo: sitio, spawns y zonas reales cargados por Kyan |
| `docs/PENDIENTES.md`, `docs/bitacora/README.md` | Estado |

## Despliegue (hecho el 2026-10-30, solo RBK)

Por la API del panel (`SERVER1_*`), comprobando que los archivos quedaron idénticos. No se recargó nada. RBK tiene SDK Hooks, `dbi.sqlite` y `adminmenu`.

| Archivo | Destino | md5 |
|---|---|---|
| `v34_wingman.smx` (sin depuración) | `cstrike/addons/sourcemod/plugins/` | `42649d0c34bbedf37444fde17990395d` |
| `configs/2v2/de_dust2_ob.cfg` | `cstrike/addons/sourcemod/configs/2v2/` | `e6ddbe8e25e45dd4f03c9cf1c6cf485c` |

**Pendiente en RBK:** ese servidor no tiene `de_dust2_ob.bsp`. Hay que subir el mapa o cargar los puntos de otro mapa. `sm_2v2_autostart` queda en 0.

También subido a `aurav34` (`SFTP_CSS_*`) el mismo día, con una versión posterior: los dos modos no se prenden a la vez y `!rank` y `!top` responden solo en el modo prendido. Esa versión también cambió `v34_retake`, que se resubió, y RBK sigue con la anterior.

Es una excepción a dos reglas de `CLAUDE.md`, por decisión de Kyan: no se desplegó a los demás servidores en la misma tanda, y RBK lleva un `.smx` sin build licenciado, porque este plugin no tiene licencia.

## Pruebas

### Con bots, en `cssds`

Los puntos son de prueba: en `de_dust2_ob`, salen de los puntos del sitio A que Kyan cargó para el retake; en `de_inferno`, generados al azar cerca del sitio A. Están solo en `cssds`, no en el repo.

| Qué | Resultado |
|---|---|
| Prender el modo: cvars y calentamiento | Bien |
| Cuchillo y `!switch` | Bien. Sin elección también avanza |
| Cambio de lado en la ronda 8 | Cambian los equipos y la plata vuelve a 800 |
| Empate en la ronda 16 | 8-8 |
| Ganar | 9-8 termina la partida y vuelve al calentamiento |
| Plantar en el sitio que no se juega | Bloqueado. En el sitio correcto se planta |
| Zona prohibida | La primera versión, con daño, funcionó con bots. La versión final bloquea el paso y **no se confirmó** |
| Pausa de admin | El freeze sigue a los 13 s con freezetime de 10, y termina al quitarla |
| Pausa de un equipo | Cuenta 1 de 2, sigue con un `!unpause` y termina con los dos |
| Pausa pedida fuera del freeze | Queda pedida |
| Bonificación y plata máxima | Probado con máximo 1000: la plata queda en 1000 |
| Apagar el modo | Restaura los cvars |
| Errores y caídas | Ninguno |

### Sin probar

- **La compra, lo más importante.** `m_bInBuyZone` queda en 1 durante el tiempo de compra y en 0 después, pero los bots no compran por comando: ni con $16000 en el calentamiento. Kyan compró en `de_dust2_ob`, pero ahí su spawn cae dentro de la zona de compra del mapa, así que no lo prueba. Hay que probarlo en `de_inferno` o lejos del spawn.
- **Bloqueo de zonas:** si frena bien o se siente trabado.
- **Cámara en primera persona y voz por equipo:** el valor `4` de `m_iObserverMode` no se midió en v34.
- `!admin`: solo se confirmó que `adminmenu` está cargado.
- `!ready` con jugadores, entrar a un equipo, equipo lleno, menú de modelos, reemplazo y abandono.
- `!rank`, `!top` y el resumen de daño en este plugin.
- Si los comandos de chat como `!ready` y `!pause` pasan bien por los listeners.
- Cálculo exacto de la bonificación: la prueba solo vio el tope.
- El balance y la economía en partidas reales.
- Linux. Todo se probó en Windows.

## En qué se apartó del plan

- **Ronda de cuchillo:** el plan arrancaba directo, y Kyan la pidió.
- **Pausas y menú de `!admin`:** se agregaron después del plan, por pedido de Kyan.
- **Compra:** no estaba en el plan. Hace falta porque los spawns quedan fuera de la zona de compra, y agrega la dependencia de SDK Hooks.
- **Zonas:** cajas que bloquean el movimiento, en lugar de la opción A del plan con aviso y daño. Kyan lo pidió porque el daño no se sentía: las zonas marcadas como líneas finas casi no se pisan. Se ven siempre.
- **Cámara y voz por equipo:** se agregaron por pedido de Kyan.

## Incidentes durante las pruebas

- **Compra:** marcar `m_bInBuyZone` en `OnPlayerRunCmd` y en `OnGameFrame` no funcionó, porque el juego lo recalcula. Se pasó a `SDKHook_PostThinkPost`.

## Cómo revertir

En RBK: quitar `plugins/v34_wingman.smx` y cambiar de mapa. Al estar apagado, no cambia nada del servidor. Los datos están en `configs/2v2/`, `data/sqlite/v34_wingman.sq3` y `cfg/sourcemod/v34_wingman.cfg`.

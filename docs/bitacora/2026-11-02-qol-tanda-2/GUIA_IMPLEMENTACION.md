# QOL, segunda tanda: guía de implementación

## Estado

Hecho y probado con bots en local el 2026-11-02. **Subido el 2026-11-02 a flow, MVZG y `aurav34`**: entra en el próximo cambio de mapa, sin recargar nada. Falta la prueba con jugadores.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv_qol.sp` | Plugin nuevo 1.0.0 |
| `server/addons/sourcemod/scripting/csstv_coach.sp` | Plugin nuevo 1.0.0 |
| `server/addons/sourcemod/scripting/csstv/knife.inc` | Elige el capitán, con menú |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | `g_iCaptain` y versión 2.8.5 |

## Versiones del reporter

| Línea | Versión | Cómo se arma |
|---|---|---|
| Producción (flow y MVZG) | 2.7.5 | `git worktree add --detach <carpeta> 6898c05` y `git apply pruebas/reporter-2.7.5.patch` (incluye la 2.7.4) |
| `aurav34` (matchmaking) | 2.8.5 | `git worktree add --detach <carpeta> 7338f86` y `git apply pruebas/reporter-2.8.5-aurav34.patch` (incluye la 2.8.4) |
| `kyan/pruebas` | 2.8.5 | En la rama. No tiene el 2.8.2 de Daniel |

Builds compilados el 2026-11-02: 2.7.5 licenciado de flow, 127864 bytes; licenciado de MVZG, 127866; genérico, 127817; 2.8.5 de `aurav34`, 137461; `csstv_qol`, 11780; `csstv_coach`, 12164.

## Despliegue (hecho el 2026-11-02)

A pedido de Kyan, en la misma tanda. Cada archivo subido se comparó con el local. Antes de reemplazar el reporter se comprobó que el que había era el esperado (2.7.4 en flow y MVZG, 2.8.4 en `aurav34`).

| Servidor | Qué recibió | Respaldo |
|---|---|---|
| flow (`#2`, `SERVER2_*`) | Reporter 2.7.5 licenciado (127864 bytes), `csstv_qol` y `csstv_coach` | `plugins/disabled/csstv_reporter_2.7.4.smx` |
| MVZG (`#1`, `SERVER3_*`) | Reporter 2.7.5 licenciado (127866 bytes), `csstv_qol` y `csstv_coach` | `plugins/disabled/csstv_reporter_2.7.4.smx` |
| `aurav34` (`#3`, `SFTP_CSS_*`) | Reporter 2.8.5 genérico (137461 bytes), `csstv_qol` y `csstv_coach` | `plugins/disabled/csstv_reporter_2.8.4.smx` |

### `csstv_qol` 1.0.1 (2026-11-02)

Kyan pidió 40 s para el fin de la partida, así la SourceTV llega a mostrar el final, y dejarlo prendido solo en MVZG, para las pruebas. La 1.0.1 tiene 40 s por defecto y no hace nada si para entonces ya empezó otra partida. Se subió a los tres servidores (11909 bytes) con su `cfg/sourcemod/csstv_qol.cfg`, que no existía todavía:

| Servidor | `csstv_qol_end_kick` |
|---|---|
| MVZG | `40` |
| flow | `0` (apagado) |
| `aurav34` | `0` (apagado) |

Prueba en `cssds` con la 2.7.5: la partida terminó a las 16:26:14, y la contraseña nueva y la expulsión fueron a las 16:26:53. El mapa cambió a las 16:26:55.

- `csstv_qol` y `csstv_coach` crean su cfg la primera vez (`cfg/sourcemod/csstv_qol.cfg` y `csstv_coach.cfg`) con los valores por defecto.
- El fin de la partida pone la contraseña con `sm_rpw` de `csstv_password`. flow y MVZG tienen `csstv_password` en `plugins/`, y `aurav34` tiene la 1.1.0, que con matchmaking deja la contraseña a la web.

## Pruebas con bots (`cssds`, 2026-11-02)

`pruebas/qol.sh` con el reporter de depuración (2.8.5 y 2.7.5), sin contacto con Supabase. `pruebas/qol_prueba.sp` hace que los bots ejecuten comandos (`sm_fakecmd`) y muestra la cámara, la C4 y la plata. El servidor local se arranca con `+tv_port 27099`, porque el juego abierto (CMLauncher) ocupa el 27020.

| Prueba | Resultado |
|---|---|
| Muere en el calentamiento | Muerto a los 0,5 s, vivo a los 3 s. Con `csstv_qol_warmup_respawn 0` queda muerto |
| Coach (un bot con `sm_coach ct`) | Queda de espectador mirando a un CT vivo. `spec_next` pasa al otro CT, `spec_mode` alterna 5 y 4, y al morir el que miraba pasa a otro. Después del cambio de lado mira a su equipo, ahora T |
| Capitán | "Elige el lado su capitán, Bert". A Bob: "El lado lo elige el capitán". A uno del otro equipo: "Solo puede elegir el Equipo Bert". Bert elige cambiar y la partida arranca. Sin el "empatada" de antes |
| C4 (`csstv_qol_c4_afk 5`, bots quietos) | `sm_live mr3`: "C4 de Albert" y, 12 s después, "C4 en el piso". Con cuchillo: en el piso a los 29 s de elegir lado (LO3 + freezetime + 5 s) |
| Mejor de la ronda | `sm_qol_status`: "más daño Albert (139) · más kills Bert (1)" y "Bert, 1 kill y 100 de daño" |
| Fin de la partida (MR1, con `csstv_password` 1.1.0) | Terminó a las 16:07:09. A las 16:07:24, "contraseña nueva, 0 expulsados y cambio a de_cache", y `csstv_password` puso la contraseña. A las 16:07:29 cambió el mapa |
| Errores | Ninguno de `csstv_reporter`, `csstv_qol` ni `csstv_coach` |

### Falta probar con jugadores

1. El menú del capitán y el del coach.
2. La voz y el chat del coach con su equipo, y que no vea al otro equipo en ningún momento.
3. La expulsión al final de la partida (a los bots no los expulsa).
4. La C4 de un jugador real quieto.

## En qué se apartó del plan

- Durante la implementación Kyan pidió que el lado lo elija **el capitán** y no una votación del equipo.
- También pidió liberar el servidor al terminar la partida (contraseña al azar, expulsar a todos y cambiar el mapa). Se sumó a `csstv_qol`.
- Para poder probarlo con bots, el capitán puede ser un bot. En una partida real no hay bots.

## Cómo revertir

- Sacar `csstv_qol.smx` y `csstv_coach.smx` de `plugins/`, o apagarlos con sus ConVars.
- Volver al reporter anterior con el respaldo de `plugins/disabled/` (2.7.4 en flow y MVZG, 2.8.4 en `aurav34`), en un cambio de mapa.

# Consejos de comandos en el chat y Discord al terminar la partida: guía de implementación

## Estado

**Hecho, probado con bots en el servidor local y desplegado en el servidor real y en RBK el 2026-10-20.** Se carga en el próximo cambio de mapa de cada uno; falta verificar. El build sin `CSSTV_DEBUG` quedó en `server/addons/sourcemod/plugins/csstv_reporter.smx` (2.4.0, md5 `0c4b2bb43df76d7574942c0a251c3525`). Compila con el `spcomp` 1.8 del servidor local, con `CSSTV_DEBUG` y sin él, sin errores ni avisos.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv/tips.inc` | Nuevo: `csstv_tips_interval`, timer y los 9 consejos |
| `server/addons/sourcemod/scripting/csstv/summary.inc` | `Summary_Discord()` al final del resumen (también si nadie completó una ronda) |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | Versión 2.4.0, `DISCORD_INVITE`, include y `Tips_Init()` |
| `server/addons/sourcemod/plugins/csstv_reporter.smx` | Compilado 2.4.0 |
| `server/cfg/sourcemod/csstv_reporter.cfg` | `csstv_tips_interval "180"` |
| `docs/bitacora/2026-10-20-consejos-y-discord/pruebas/` | `consejos.sh` y `resultado.txt` |

## Despliegue (hecho el 2026-10-20)

Lo pidió Daniel. Se hizo con un script SFTP (`paramiko`), el mismo del despliegue de `!whois` adaptado. Primero solo inspeccionó y después hizo esto en cada servidor:

1. Comprobó que el plugin instalado fuera la 2.3.1 esperada.
2. La pasó a `plugins/disabled/csstv_reporter_2.3.1.smx`.
3. Subió la 2.4.0 y la volvió a bajar para comparar el md5.
4. Agregó al final de `cfg/sourcemod/csstv_reporter.cfg` la línea `csstv_tips_interval "180"`, con su comentario. La copia del cfg anterior quedó solo en local.
5. En `plugins/disabled/` dejó como mucho 3 versiones anteriores.

| Servidor | Acceso | `.smx` | md5 | Antes | Borrado de `disabled/` |
|---|---|---|---|---|---|
| Servidor real | `SFTP_CSS_*` | genérico | `0c4b2bb43df76d7574942c0a251c3525` | 2.3.1 (`774b79c3…`) | `csstv_reporter_2.1.0.smx` |
| RBK | `SERVER1_*` | licenciado (`build_licenciado.sh be0fd76c-6bdc-477e-a843-6efc309b5ca9 rbk`) | `3bbaeaee9a049ce0c7d092ab49b42500` | 2.3.1 (`98dcb36a…`) | `csstv_reporter_2.1.0.smx` |

En los dos, `disabled/` quedó con la 2.1.1, la 2.3.0 y la 2.3.1 del reporter. No se recargó nada: la 2.4.0 se carga en el próximo cambio de mapa.

**Falta verificar** en cada servidor:
- `sm plugins list` muestra 2.4.0.
- En el calentamiento sale un consejo cada 3 minutos.
- Al final del primer mix sale la línea del Discord.
- En RBK no hay consola, así que se revisa por SFTP que `addons/sourcemod/logs/` no tenga errores del reporter.

Falta publicar el changelog.

### Pasos (para repetirlo)

1. **Servidor real** (`SFTP_CSS_*`): el `.smx` genérico de `server/addons/sourcemod/plugins/csstv_reporter.smx`.
2. **RBK** (`SERVER1_*`): el build licenciado, `server/build_licenciado.sh be0fd76c-6bdc-477e-a843-6efc309b5ca9 rbk`.
3. En cada uno, la versión anterior a `plugins/disabled/`, con como mucho 3 versiones anteriores.
4. `csstv_tips_interval "180"` en el cfg. Sin la línea también usa 180, que es el valor por defecto.
5. No recargar con una partida en curso.

## Pruebas

### Servidor local con bots (2026-10-20)

`$2000$`, 3 bots T contra 1 CT, `csstv_send 0`, compilado con `CSSTV_DEBUG=`. Los mensajes se leyeron del log de SourceMod (`[chat todos]`).

**Tiempos cortos:**
- Consejos cada 3 s en lugar de 180.
- `csstv_end_delay 2`, `csstv_pause_time 10`, `csstv_lo3 0` y `mp_freezetime 1`.
- Partida `mr2`.

Ninguna espera pasó de 10 s. El script es [`pruebas/consejos.sh`](pruebas/consejos.sh) y la salida está en [`pruebas/resultado.txt`](pruebas/resultado.txt).

| # | Caso | Resultado |
|---|---|---|
| 1 | Calentamiento, todo prendido | Rotación 1, 3, 5, 6, 7, 8, 9 y vuelve al 1: no salen `!pause` ni `!gg` ✔ |
| 2 | Calentamiento con `csstv_sell 0` y `csstv_calladmin_enabled 0` | Tampoco salen `!sell` ni `!calladmin` ✔ |
| 3 | En vivo con `csstv_sell_window 0`, `csstv_pause_mode 1` (3 de 30 s), `csstv_gg_min_diff 5` y `csstv_gg_missing 0` | Textos adaptados ("hasta el fin del freezetime", "3 por partida, de 30 s", "5 rondas", "de todo el equipo"); no salen `!rtv` ni `!ready`. En el LO3 solo salieron los de "Siempre" ✔ |
| 4 | Fin de la partida (`mr2`) | Resultado, MVP y top 3, y al final `¡Gracias por jugar! Únete a nuestro Discord: dsc.gg/v34frag` ✔ |
| 5 | En vivo con el modo de pausa 3 | La primera vez el texto de `!pause` salía cortado ("…escriben !unpause{#n"). Se agrandó el búfer y salió completo ✔ |

- En el log de errores del día no hay nada del reporter. Solo aparece el error de siempre de `extremehost.smx`.
- Los mensajes más largos ocupan unos 195 bytes con colores RGB, por debajo del límite de 255 del chat.
- **No se probó con un jugador real:** los colores ni cómo se ve el chat en el cliente. Los bots no reciben el chat.

## En qué se apartó del plan

- `DISCORD_INVITE` quedó en `csstv_reporter.sp` y no en `tips.inc`, porque `summary.inc` se incluye antes y también lo usa.
- Para saber si `csstv_sell` y `csstv_calladmin` están corriendo se usa `FindPluginByFile` y no su cvar de versión, porque la cvar sigue existiendo después de descargar el plugin.
- `!hp`, `!rtv` y `!ready` también se saltan si su función está apagada (`csstv_hp_on_death`, `csstv_rtv`, `csstv_ready_system`). Sigue la misma regla que `!pause` y `!gg`.

## Incidentes durante las pruebas

- **Texto de `!pause` cortado:** el búfer del final de la frase era de 96 bytes y, con las etiquetas de color, no alcanzaba. Se pasó a 160.
- **Cola del servidor local:** había un resultado del 2026-10-19 y las pruebas dejaron tres partidas de bots. Se sacaron de `data/csstv/queue/` antes de recargar y al terminar, y quedaron en el scratchpad de la sesión. No se envió nada. El servidor local quedó apagado, con el `.smx` genérico 2.4.0.

## Cómo revertir

- **En un servidor:** volver a poner `plugins/disabled/csstv_reporter_2.3.1.smx` como `plugins/csstv_reporter.smx`. La línea `csstv_tips_interval` del cfg no molesta a la 2.3.1, que solo avisa que no conoce la cvar.
- **Para apagar solo los consejos, sin cambiar de versión:** `csstv_tips_interval 0`.
- **En el repo:** revertir el commit.

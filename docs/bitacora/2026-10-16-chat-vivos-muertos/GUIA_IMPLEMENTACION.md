# Chat de texto para vivos y muertos (`csstv_allchat`): guía de implementación

## Estado

Hecho, probado en el servidor local y **subido a los dos servidores el 2026-10-16**. Daniel aprobó el plan ese día, con la opción B de la voz.

| Servidor | Plugin | `live.cfg` |
|---|---|---|
| **Real** (`SFTP_CSS_*`) | `csstv_allchat.smx` subido, md5 verificado. Se carga en el próximo cambio de mapa | Ya tenía `sm_deadtalk 2` |
| **RBK** (`SERVER1_*`) | `csstv_allchat.smx` subido, md5 verificado. Se carga en el próximo cambio de mapa | `sm_deadtalk 2` agregado. Copia del original en el servidor (`cstrike/cfg/csstv/live.cfg.bak_20261016`) y en el scratchpad de la sesión |

**Falta verificar** después del próximo cambio de mapa en cada servidor:
- `sm plugins list` en la consola del panel muestra "CSSTV All Chat (1.0.0)".
- El log de errores no tiene `already one in progress` ni `Could not send a usermessage`.
- Con jugadores reales: un vivo lee el chat de un muerto, y el chat de equipo no le llega al rival.
- Changelog en Discord (`CHANGELOG_DISCORD.txt`).

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv_allchat.sp` | Nuevo |
| `server/addons/sourcemod/plugins/csstv_allchat.smx` | Nuevo: compilado con el `spcomp` 1.8 del servidor local (el mismo de `csstv_reporter`), sin depuración |
| `server/cfg/csstv/live.cfg` | `sm_deadtalk 2` después de `sv_alltalk 0` |
| `docs/PENDIENTES.md` | El punto 7.1 (`sm_deadtalk 0`) queda reemplazado; verificación del despliegue |

## Antes de programar (revisado por SFTP, solo lectura)

- **Logs de errores del servidor real del 2026-10-15** (21:39 a 21:43): errores de "DeadChat" (`SayText2PostHook`, compilado con SourceMod 1.3) y un envío fallido de nuestro `csstv_reporter`. Es la causa del crash con `!pause`.
- **"DeadChat" ya no estaba** en `plugins/` del servidor real ni de RBK.
- **Voz en los cfg:** los dos servidores ya tenían `sv_alltalk 1` en el calentamiento y al terminar, y `sv_alltalk 0` en la partida. El real además tenía `sm_deadtalk 2`. `basecomm.smx` está cargado en los dos.

## Pruebas (servidor local, 2026-10-16)

**Entorno:**
- Para no tocar producción, el `csstv_reporter.cfg` del servidor local se apuntó a la **Supabase local**, con un servidor de prueba creado ahí. Las dos partidas canceladas de la prueba llegaron a la base local.
- Se hizo copia del cfg y del plugin del servidor local, y al terminar se restauraron (mismo md5). Se sacó `csstv_allchat` del servidor local, se borraron los datos de prueba de la base local y la cola de envíos quedó vacía.
- `csstv_reporter` en versión de depuración: **1.8.0** (compilada desde `f55af55`, la que corren los servidores) y **2.0.0**.
- `csstv_allchat` en versión de depuración. Bots en T, CT y espectador, vivos y muertos. El chat se generó con `csstv_allchat_say`.

| Prueba | Resultado |
|---|---|
| Chat global de un muerto (T) | Se reenvía a los vivos de los dos equipos |
| Chat de equipo de un muerto (T) | A su compañero vivo y a los espectadores; no a los CT |
| Chat de equipo de un vivo (T y CT) | A su compañero muerto y a los espectadores; no al rival |
| Chat global de un vivo | No hace falta reenviar (el juego ya lo manda a todos) |
| Chat global y de equipo de un espectador | El global, a todos; el de equipo queda entre espectadores |
| **Caso del crash con la 1.8.0:** `!pause` escrito en el chat en partida en vivo, chat de un muerto mientras arranca, chat de vivos y muertos durante la pausa, `!hp` y los dos `!unpause` | Pausa y reanudación normales, **sin errores de mensajes** |
| **Lo mismo con la 2.0.0**, más `!status` (respuesta de 6 líneas) | **Sin errores de mensajes** |
| `sm_gag` a un bot | Su chat no se reenvía |
| `csstv_allchat 0` y vuelta a `1` | Apagado no hace nada; prendido vuelve a funcionar |

El único error nuevo del log en las pruebas fue de `extremehost.smx` (plugin de terceros, también instalado en el servidor real): `invalid handle` en un timer. No tiene relación con esto.

**Sin probar:** con jugadores reales. Los bots no reciben mensajes, así que el log de depuración muestra a quién **se mandaría**. Queda para la verificación en el servidor real.

## En qué se apartó del plan

- **El juego manda un `SayText2` por cada destinatario.** La primera versión procesaba cada línea de chat una vez por destinatario: con jugadores reales habría mandado mensajes repetidos. Se vio en la prueba local, antes de subir nada. Se corrigió juntando los mensajes iguales del mismo frame en una sola entrada.
- **Compilador:** el plan decía SourceMod 1.10; se usó el `spcomp` 1.8 del servidor local, el mismo con el que se compilan los `csstv_reporter` que corren en los dos servidores (que tienen SourceMod 1.10).
- **Voz:** no hizo falta código ni cambios en el servidor real; solo `sm_deadtalk 2` en el `live.cfg` de RBK y del repo.
- **Changelog:** `v34frag 1.8.1`, entre la 1.8.0 que corre y la 2.0.0 que viene.

## Despliegue hecho

Script SFTP (`paramiko`, entorno virtual aparte):
1. Aborta si `csstv_allchat.smx` ya existe en alguno de los dos.
2. Sube el `.smx` a `cstrike/addons/sourcemod/plugins/` en los dos, lo vuelve a bajar y compara el md5 (`eb6097c6d6668e75ec3fc1001add1992`).
3. En RBK:
   - Guarda copia del `live.cfg` (local y en el servidor).
   - Agrega `sm_deadtalk 2` después de `sv_alltalk 0`.
   - Lo vuelve a bajar y verifica el contenido.

No se recargó nada: el plugin se carga en el próximo cambio de mapa de cada servidor.

## Cómo revertir

- **Al instante:** `csstv_allchat 0` en la consola del panel.
- **Del todo:** mover `csstv_allchat.smx` a `plugins/disabled/` en los dos servidores. Se descarga en el próximo cambio de mapa.
- **Voz en RBK:** restaurar `cstrike/cfg/csstv/live.cfg.bak_20261016`.

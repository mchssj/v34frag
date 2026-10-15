# Inicio por `!ready` con ronda de cuchillo: guía de implementación

## Estado

**Pendiente por desplegar.** Plugin 1.8.0 probado con bots en el servidor local (2026-10-14), sin commit. Falta subirlo al servidor real (y el build licenciado de RBK).

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | Versión 1.8.0; cvar `csstv_ready_knife`; `CheckReadyStart` pasa `knife` a `StartMatch` |
| `server/addons/sourcemod/scripting/csstv/knife.inc` | Comentario: el cuchillo ya no es solo de `!live knife` |
| `server/addons/sourcemod/plugins/csstv_reporter.smx` | Compilado 1.8.0 (sin `CSSTV_DEBUG`) |
| `server/cfg/sourcemod/csstv_reporter.cfg` | `csstv_ready_knife "1"` |
| `docs/GUIA_SERVIDOR.md` | Inicio y ronda de cuchillo |
| `docs/bitacora/2026-10-14-ready-con-cuchillo/pruebas/escenario_ready.sh` | Prueba con bots |

## Despliegue (subido a los dos servidores el 2026-10-14)

1. Respaldar `plugins/csstv_reporter.smx` del servidor real como `plugins/disabled/csstv_reporter_1.7.0.smx`.
2. Subir `server/addons/sourcemod/plugins/csstv_reporter.smx` por SFTP. **Hecho el 2026-10-14** (84034 bytes, md5 `750b78fc3ccdead24a0882a1b62a3379`; respaldo de la 1.7.0 en `plugins/disabled/`).
3. Opcional: agregar `csstv_ready_knife "1"` al `cfg/sourcemod/csstv_reporter.cfg` del servidor. Sin la línea, se usa el valor por defecto, que también es 1.
4. Se carga en el próximo cambio de mapa. `sm plugins reload csstv_reporter` cancela la partida en curso. Verificar con `sm_csstv_status` que diga `v1.8.0`.
5. RBK: compilar con `server/build_licenciado.sh be0fd76c-6bdc-477e-a843-6efc309b5ca9 rbk` y subirlo aparte. **Hecho el 2026-10-14** (84060 bytes, md5 `2830de863d1ba8ed347a4672a09df271`; la 1.7.0 quedó en `plugins/disabled/`).

## Pruebas

### Plugin con bots (servidor local, 2026-10-14)

`$2000$`, 2 bots T y 1 CT, `csstv_send 0`, `csstv_min_players 3`, `csstv_maxrounds 4`, `csstv_knife_time 10`, compilado con `CSSTV_DEBUG=`. Los bots escriben `!ready` con `csstv_debug_fakecmd`. Escenario en [`pruebas/escenario_ready.sh`](pruebas/escenario_ready.sh).

| Caso | Resultado |
|---|---|
| 2 de 3 listos | Sigue en calentamiento |
| Los 3 listos, `csstv_ready_knife 1` | "Ronda de cuchillo: Equipo Jeff (CT) vs Equipo Jon (T)" → "¡A cuchillo!" → gana CT → "Nadie eligió a tiempo: el Equipo Jeff se queda en su lado" → "La partida empieza … MR2" → "Fin de la partida: Equipo Jon 3 - 1 Equipo Jeff" |
| Los 3 listos, `csstv_ready_knife 0` | "La partida empieza" directo, estado "en vivo", sin mensajes de cuchillo |

Los dos resultados de bots que quedaron en `data/csstv/queue/` se borraron sin enviarse. El servidor local quedó apagado y con el `.smx` que tenía antes de la prueba.

No se probó con jugadores reales. El `!stay` / `!switch` después del cuchillo no cambió: ya se había probado en la 1.6.0.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

Sin recompilar: `csstv_ready_knife 0` en el cfg del servidor. Para volver a la 1.7.0, restaurar `plugins/disabled/csstv_reporter_1.7.0.smx`.

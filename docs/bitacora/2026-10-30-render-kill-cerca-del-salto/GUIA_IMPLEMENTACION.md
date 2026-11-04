# El salto no se da por pasado de largo por una kill en sus primeros segundos: guía de implementación

## Estado

Hecho y probado sin el juego (2026-10-30), sin commit. Falta llevar `render/` al portátil y, con la confirmación de Daniel, devolver los 6 clips de nuke a la cola.

## El caso

- Partida: nuke_old_blue_ep de flow, `flow-20261029T210433-5ce4` (`f511d386-46a7-4b28-803f-cfddc954d501`), 2026-10-30 00:23 UTC.
- Los 6 clips quedaron `failed` con "Sesión del juego: d8599f71 tramo 0: la demo pasó de largo el tick 70272 (3 veces)".
- El tramo 0 de `d8599f71` (Old x roman, ronda 9) salta a 70272. La primera kill desde ahí era de Taiki Inomata, en 70421 (1,49 s); la de la jugada es en 70622 (3,5 s).
- La demo se lee entera (105.799 ticks) y el desfase con el plugin es 0: no era un problema de la demo.
- Sin confirmar con el `procesar.log` del portátil: el diagnóstico sale de reconstruir los tramos con la demo.

## Archivos

| Archivo | Cambio |
|---|---|
| `render/render_clip.py` | `SEEK_SLACK_SECONDS = 2.0`; en `record_session`, `slack_ticks` y `after` desde `j0 + lead_ticks + slack_ticks` |
| `docs/bitacora/2026-10-30-render-kill-cerca-del-salto/` | Esta bitácora, con `pruebas/comparar_salto.py`, `pruebas/clips_nuke.json` y `pruebas/reprocesar_nuke.sql` |
| `docs/bitacora/README.md` y `docs/PENDIENTES.md` | Fila nueva y punto 1.34 |

## Despliegue

Pendiente:

1. Commit y `git pull` en el portátil (cuando Daniel lo pida), con la tarea "CMLeague clips" sin una corrida a mitad.
2. Con la confirmación de Daniel, `pruebas/reprocesar_nuke.sql` en producción.
3. Revisar que los 6 clips queden `done`.

## Pruebas

### Sin el juego, con la demo de nuke

```
python docs/bitacora/2026-10-30-render-kill-cerca-del-salto/pruebas/comparar_salto.py <nuke.dem> docs/bitacora/2026-10-30-render-kill-cerca-del-salto/pruebas/clips_nuke.json
```

Los mismos tramos y pasadas que arma el portátil (desfase 0, 2 pasadas, 16 tramos). Cambia la kill que se mira en 3 tramos; en los otros 13 es la misma:

| Tramo | j0 | Antes | Ahora |
|---|---|---|---|
| `d8599f71` tramo 0 (pasada 1) | 70272 | 70421, a 1,49 s: el que falló | 70622, la de la jugada |
| `46b69a1d` tramo 0 (pasada 2) | 21912 | 21974, a 0,62 s: también habría fallado | 22262 |
| `28aca510` tramo 0 (pasada 1) | 3159 | 3408, a 2,49 s (pasó en la corrida) | 3509 |

### Con el juego

Pendiente: la próxima corrida del portátil con los clips de nuke en la cola.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

Quitar `SEEK_SLACK_SECONDS` y `slack_ticks` y volver a `after = next((k for k in all_kills if k["tick"] >= j0), None)` en `record_session` (o revertir el commit), y hacer `git pull` en el portátil.

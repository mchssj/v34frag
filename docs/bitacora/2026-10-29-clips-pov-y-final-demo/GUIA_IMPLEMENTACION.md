# Clips con la cámara en otro jugador y el menú al final: guía de implementación

## Estado

Corregido y probado con la demo del mix el 2026-10-29, **sin commit**. Falta:

1. Llevar `render/` al portátil.
2. Reprocesar los dos clips y revisarlos.

No toca la base, la API ni los servidores de juego.

## Archivos

| Archivo | Cambio |
|---|---|
| `render/leer_demo.py` | Largo de `svc_UpdateStringTable` en 16 bits, tick 0 en los signon y sin `STEAM_ID_PENDING` |
| `render/render_clip.py` | `END_MARGIN_SECONDS` y `segments(..., last_tick)` |
| `render/procesar.py` | `build_job` pasa `d.header["playback_ticks"]` |
| `docs/bitacora/2026-10-29-clips-pov-y-final-demo/` | Plan, documentación, esta guía y `pruebas/` |

## Despliegue

1. **Portátil:**
   - Desactivar la tarea: `Disable-ScheduledTask "CMLeague clips"`, como administrador.
   - Traer los tres archivos de `render/` (`git pull` después del commit, o copiarlos).
   - Volver a activarla.
2. **Reproceso (SQL Editor de producción):** [`pruebas/reprocesar_cbble.sql`](pruebas/reprocesar_cbble.sql). Pasos 0 y 1, esperar a que los dos queden en `done` (paso 2), mirar los videos en Drive (" (reproceso 1)") y aprobarlos (paso 3).
   - Los dos ya habían salido en Discord. Al aprobarlos se publican otra vez, con el video nuevo.
   - Si se reprocesa antes del paso 1, se graban otra vez con el error.

## Pruebas

Con la demo `flow-20261029T201550-b630.dem` (50 MB, bajada del Worker de demos):

| Prueba | Antes | Después |
|---|---|---|
| Errores de lectura | 2 | 0 |
| Rondas y kills | 29 y 205 | 29 y 205, con los mismos ticks |
| Nombre de userid 75 | `userid 75` | `Vodka` |
| Vivos al empezar el tramo de la ronda 18 | sin Vodka | con Vodka (entidad 5) |
| Cámara de las dos jugadas | `spec_player "sunny"` + `spec_next` (cae en Vodka) | `spec_player "Vodka"` + `spec_next` (llega a New™ always) |
| Último tramo de la ronda 29 | 231534 a 232532 (200 ticks después del final) | 231534 a 232322 |

`segments` también se probó con valores sueltos: sin `last_tick` da lo mismo que antes, y con una kill en el último tick el tramo termina en el margen.

**Sin probar en el juego:** la grabación de punta a punta se hace en el portátil. Confirmarlo con el reproceso.

## Cómo revertir

`git checkout` de la versión anterior de los tres archivos de `render/`, en el repo y en el portátil.

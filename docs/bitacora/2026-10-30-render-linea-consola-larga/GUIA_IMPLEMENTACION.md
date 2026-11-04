# Los pasos que no caben en una línea de la consola van en varias: guía de implementación

## Estado

Hecho y probado sin el juego (2026-10-30), sin commit. Falta llevar `render/` al portátil y, con la confirmación de Daniel, devolver los 5 clips de dust2 a la cola.

## El caso

- Mix de dust2_ob de flow, GO TO KNOW contra New™ (`flow-20261029T234042-496d`, `26a5034f-aa3b-47e3-95ee-67998891ad90`), 2026-10-30 03:10 UTC.
- Los 5 clips fallaron dos veces: la corrida de las 03:54 UTC y, después de devolverlos a la cola, la de las 13:56 UTC. Las dos veces fue "Sesión del juego: no apareció 'CML_PASO_14' en el log en 60 s". No tenía que ver con la corrida cancelada a mano esa noche.
- Reconstruyendo los pasos con la demo: el 14 es el arranque de la grabación del primer tramo de «New™ CH1LI» (`e933f850`). La ™ no se puede escribir, así que la cámara llega desde «GO TO KNOW musul    ^'-'^» con `spec_next`.

| Paso | Largo | En la corrida |
|---|---|---|
| 13 (salto, con el mismo `spec_player`) | 239 | Pasó |
| 14 (arranque de la grabación) | 259 | Falló 3 de 3 |
| El más largo que pasó | 249 | Pasó |

## Archivos

| Archivo | Cambio |
|---|---|
| `render/render_clip.py` | `CONSOLE_MAX = 250`, `console_line` y `console_lines`; `Game.step` escribe una línea por parte, cada una con su marca |
| `docs/bitacora/2026-10-30-render-linea-consola-larga/` | Esta bitácora, con `pruebas/lineas_consola.py`, `pruebas/clips_dust2.json` y `pruebas/reprocesar_dust2.sql` |
| `docs/bitacora/README.md` y `docs/PENDIENTES.md` | Fila nueva y punto 1.35 |

## Despliegue

Pendiente:

1. Commit y `git pull` en el portátil (cuando Daniel lo pida), con la tarea "CMLeague clips" sin una corrida a mitad.
2. Con la confirmación de Daniel, `pruebas/reprocesar_dust2.sql` en producción.
3. Revisar que los 5 clips queden `done` y que el de «New™ CH1LI» siga a ese jugador.

## Pruebas

### Sin el juego

```
python docs/bitacora/2026-10-30-render-linea-consola-larga/pruebas/lineas_consola.py <demo.dem> <clips.json>
```

Arma los pasos de cada tramo como `record_session` (salto, arranque y fin de la grabación, sin reintentos) y revisa: que los pasos que cabían no cambien, que ninguna línea pase de 250, que todas tengan `hideconsole`, que los comandos sigan en el mismo orden y que los pares que van juntos no se separen.

| Demo | Resultado |
|---|---|
| dust2 (`clips_dust2.json`) | 2 pasadas, 5 pasos partidos en 2 líneas (de 258 a 269 caracteres → 204 a 215 y 84 a 85), 0 errores |
| nuke (`../2026-10-30-render-kill-cerca-del-salto/pruebas/clips_nuke.json`) | 0 pasos partidos (el más largo mide 235), 0 errores |

En los 5 pasos partidos, la primera línea lleva la cámara (`spec_player`, `spec_next`, `spec_mode 3`, los `hidepanel`…) y la segunda `hideconsole; startmovie …; demo_resume`.

### Con el juego

Pendiente: la próxima corrida del portátil con los clips de dust2 de vuelta en la cola.

## En qué se apartó del plan

- El plan solo mantenía juntos `spec_player` y sus `spec_next`. La primera prueba mostró que el corte caía entre `startmovie` y `demo_resume`, y eso grabaría cuadros quietos con la demo en pausa. Ahora también van juntos `startmovie` con `demo_resume` y `demo_pause` con `demo_gototick`.

## Cómo revertir

Revertir el commit (o volver `Game.step` a una sola línea con la marca y quitar `console_lines`) y hacer `git pull` en el portátil. Sin esto, los pasos de más de unos 255 caracteres vuelven a fallar.

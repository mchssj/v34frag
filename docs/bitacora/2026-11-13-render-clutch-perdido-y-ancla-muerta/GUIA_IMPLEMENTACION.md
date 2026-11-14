# Clips de clutch perdido y de vivos sin nombre escribible: guía de implementación

## Estado

Hecho y probado en la PC de Daniel el 2026-11-13 (sin el juego con 6 partidas, y con el juego con el clutch de tam y el 4k de lephyxzz), commiteado en `main` el 2026-11-13. Falta llevarlo al portátil y devolver los clips a la cola.

## Cómo se encontró

1. Daniel mandó a reprocesar los dos clips de "New™ tam" y la tarea del portátil "arrancaba y se cerraba".
2. En producción (`match_clips`, con la clave pública), los dos estaban `skipped` y tomados 10 y 25 s después del reproceso:
   - `beb6e58d` (3k, ronda 18, mirage_rc1): `Cámara: 'New™ tam' no está vivo en el tick 162492 y su nombre no se puede escribir en la consola`;
   - `c3ec6102` (clutch 1v1, ronda 26, dust2_ob): `Cámara: no hay ningún jugador vivo con nombre escribible para llegar a 'New™ tam'`.
3. Con las demos: el 3k también es un clutch 1v3 perdido (nachinn mata a tam en el 162288, la ronda termina en el 162842), y en el 1v1 los dos vivos tienen nombres no escribibles.
4. Tres clips de "lephyxzz漏斗" estaban `skipped` con el mismo tipo de error. El 4k de dust2_ob (`9a26c6a1`) era el caso 1. Los dos clutches de `srv3-20261112T164548-42dd` (`a59dbcee` y `b10f6b10`) eran otro problema: el lector no lo veía vivo en ninguna ronda (ver "En qué se apartó del plan").

## Archivos

| Archivo | Cambio |
|---|---|
| `render/procesar.py` | `clip_events`: el final de un clutch es la muerte del jugador si muere antes del fin de la ronda, y el inicio va solo si cae en el tramo de otro evento (`gap`, de `build_job`) |
| `render/render_clip.py` | `spec_target`: el ancla muerta, después del único vivo y antes del error. `console_lines`: `hideconsole` y `gameui_hide` en cada línea |
| `render/leer_demo.py` | `_round_at` (los que juegan la ronda y los vivos), `in_round_at` y `alive_at` sobre ella; los jugadores sin `player_team` que matan o mueren cuentan como jugadores |
| `pruebas/revisar_camara.py` | Los comandos de la cámara de cada tramo, con la versión de `render/` que se le pase |
| `pruebas/reprocesar.sql` | Devuelve los 5 clips a la cola |

## Pruebas

### Sin el juego

`pruebas/revisar_camara.py` con el código de antes (`git show HEAD:render/…` en una carpeta aparte) y con el nuevo, sobre 6 partidas: `767d15a2` y `dc140c64` (las de tam), `ab56d340` (los clutches de lephyxzz) y `6e359bf3`, `45496551` y `68a06413` (con clutches perdidos y nombres no escribibles).

```
python -I revisar_camara.py <render_dir> <match_id> <demo> [<match_id> <demo> …]
```

Diferencias entre las dos salidas (de 168 líneas):

| Clip | Antes | Ahora |
|---|---|---|
| `beb6e58d` (tam, 3k) | Último tramo `(162542, 163042)`: falla | `(161988, 162488)`, `spec_player "nachinn"` + 1 `spec_next` |
| `c3ec6102` (tam, 1v1) | Falla en el 233474 | `spec_player "BrokoLoco"` (muerto) + 1 `spec_next` |
| `9a26c6a1` (lephyxzz, 4k) | Último tramo `(234751, 235251)`: falla | `(233524, 234024)`, `spec_player "DESTROYER9999999999999999999999"` (muerto) + 1 `spec_next` |
| `b10f6b10` (lephyxzz, clutch_2) | Falla en los dos tramos | `spec_player "igna"` + 1 `spec_next` |
| `a59dbcee` (lephyxzz, clutch_3) | Falla en los dos tramos | `spec_player "tomorrowland"` y `"TEODORO PIRORO"` + 1 `spec_next` |
| `9fc21d15` (romanxzzzzzz, 3k con clutch perdido, ya grabado) | Último tramo `(134557, 136349)` | `(134557, 135611)`: termina en su muerte |

Esa fue la primera comparación, con los arreglos del plan y el del lector. Después se agregó el del inicio del clutch (ver "En qué se apartó del plan"), que además le saca el tramo suelto del principio a `c3ec6102`, `9a26c6a1` y `b10f6b10` y a 7 clips ya grabados (`ea9a1cab`, `7f396aef`, `15ad6218`, `b3a07012`, `6cdff9b8`, `1aa2c98a` y el `9a26c6a1` de antes). Los demás clips grabados dan los mismos tramos y comandos. Ninguno de las 6 partidas queda fallando. En `ab56d340`, el lector ve ahora 10 jugadores en cada ronda (antes, 3 vivos en la ronda 1).

`console_lines`, con anclas de 1 y de 60 caracteres y de 0 a 9 `spec_next`: ninguna línea queda sin `hideconsole` y `gameui_hide`. En las 6 partidas, dos pasos se parten en dos líneas: el último tramo de `9a26c6a1` y el primero de `6cd985ed` (Pegaré?, ya grabado: es de los que salieron con el menú).

### Con el juego

`python render/probar_jugada.py c3ec6102-db25-480a-9be5-38ffbdf37160 --name prueba_dust2ob_tam_r26_ancla_muerta`, con ClientMod en la PC de Daniel: 2 pasadas, 3 tramos de 300 cuadros, 196 s de sesión, 10,9 MB (`D:\CMLeague_Render\videos\prueba_dust2ob_tam_r26_ancla_muerta.mp4`). El tramo del ancla muerta se ve en primera persona con la granada en la mano, y la HE mata a lephyxzz ("New™ tam + romanxzzzzzz" en el feed): es tam.

Al verla, Daniel notó dos cosas: el primer tramo (la muerte de lucybesteN, el inicio del clutch) no muestra nada, y sale con el menú de ClientMod abierto, "como varios clips". El paso de `startmovie` de ese tramo (ancla lucybesteN con dos `spec_next`) medía más de 250 caracteres y se partía en dos líneas, y la segunda no tenía `gameui_hide`. Con los dos arreglos:

- `probar_jugada.py c3ec6102-… --name prueba_tam_r26_v2`: 2 tramos (la HE a lephyxzz y el fin de la ronda), 141 s, 8,1 MB, sin menú.
- `probar_jugada.py 9a26c6a1-… --name prueba_lephy_r26_4k_v2` (el 4k de lephyxzz, con el último paso partido en dos líneas): 4 tramos, 252 s, 17,6 MB, sin menú en ningún tramo. El último arranca en su primera persona (con la granada) y, cuando tam lo mata, la cámara pasa a tam: lo hace el motor al morir el jugador seguido. Dos avisos normales en el log: dos saltos reiniciaron la demo y un `endmovie` se reintentó.
- La ventana de `probar_jugada.py` que muestra el progreso se cayó al imprimir "漏斗" en la terminal de Windows (cp1252), pero el proceso elevado siguió y terminó bien (`render/ultimo_prueba.log`). La tarea no lo sufre (no muestra nada en pantalla).

Los videos quedaron en `D:\CMLeague_Render\videos\`.

No se probó con el v34 normal (`"client": "v34"`, el del portátil). `spec_player` y `spec_next` son del motor y no de ClientMod.

## Despliegue

1. Commit en `main` (hecho el 2026-11-13) y `git pull` en el portátil, con la tarea "CMLeague clips" sin una corrida a mitad.
2. Con la confirmación de Daniel, correr `pruebas/reprocesar.sql` en producción (`sudo sb psql` en el VPS). Los dos de tam siguen esperando revisión: salen en Discord cuando Daniel los apruebe en Administración › Clips.
3. En la próxima corrida, revisar que los 5 queden `done` y verlos.

## En qué se apartó del plan

- **El menú del juego en el video (`render_clip.console_lines`) y el inicio del clutch (`procesar.clip_events`):** el plan no los tenía. Los pidió Daniel al ver el primer video de tam ("al principio sale un tramo en el que no mata a nadie ni es relevante para el clip, además sale con el menú del juego abierto… ya han salido varios clips con el menú abierto").
- **El lector de demos (`leer_demo._round_at`):** el plan no lo tenía. Los dos clutches de lephyxzz de `ab56d340` no fallaban por la cámara sino porque el lector no lo veía jugar: la partida se cortó en la ronda 13, antes del medio tiempo, y él nunca cambió de equipo. Ahora cuenta como jugador a quien mata o muere en la demo sin tener ningún `player_team`.

## Cómo revertir

Revertir el commit y `git pull` en el portátil. Los clutches perdidos vuelven a terminar en el fin de la ronda (y a quedar `skipped` si el nombre no se puede escribir), los clips sin ningún vivo escribible vuelven a quedar `skipped`, el lector vuelve a no ver a los que nunca cambiaron de equipo, el inicio del clutch vuelve a ser un tramo aparte y los pasos partidos vuelven a dejar el menú abierto.

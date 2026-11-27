# El #3 libre: guía de implementación

## Estado

Hecho en el #3 el 2026-11-21 (≈14:40 hora del servidor), sin reiniciar. **Falta:** que Daniel desmarque los usos del #3 en la web.

## Archivos

Ninguno del repositorio cambia en el código. Solo la configuración del #3 y la documentación (`CLAUDE.md`, `docs/PENDIENTES.md`, esta carpeta).

## Despliegue (hecho el 2026-11-21)

Solo el **#3**: es un cambio propio de ese servidor, no de todos. El #1 y el #2 siguen tomando salas.

1. Comprobado antes: último evento del reporter `Resultado srv3-20261121T002952-2974 enviado` (01:28), `status` por RCON con 1 conectado (SourceTV), sin `mm.txt`.
2. La consola del panel (`POST /command`) respondió 502 "Server must be online" aunque el panel lo daba `running`. Se usó RCON (`docs/bitacora/2026-10-11-qol-servidor/pruebas/rcon.py`) con la `RCON_PASSWORD` de las variables del panel: `csstv_mm 0` y `sv_password "torneo921"`, y se leyeron de vuelta (`0` y `torneo921`).
3. `PUT /startup/variable` `SERVER_PASSWORD=torneo921` (200).
4. Copia de `csstv_reporter.cfg` con `files/copy` (204) y la línea `csstv_mm "0"` subida con `files/write` (204), comparada byte a byte con lo subido.

## Pruebas

Lectura de los cvars por RCON. Falta ver un mix real en el #3 llegar a la web.

## En qué se apartó del plan

Primero la contraseña quedó solo en la variable `SERVER_PASSWORD` del panel. No alcanzó: cuando el juego se cae, `srcds_run` lo relanza con la línea de arranque con la que arrancó el contenedor, y la variable nueva recién vale al reiniciar el contenedor. Desde las 23:3x del 2026-11-21 va también en el `server.cfg` del #3 (`sv_password "torneo921"`, con respaldo del panel), que se ejecuta en cada mapa. Con `csstv_mm 0` el plugin no la pisa.

## Incidentes durante las pruebas

- La consola del panel no aceptó comandos (502). RCON sí.
- **Caída del #3 con un mix en vivo (2026-11-21, 23:31 hora del servidor):** la partida `srv3-20261121T231932-7734` (de_season, en vivo desde las 23:21:23, 10 jugadores) se cortó: a las 23:31:30 `csstv_perf` daba el servidor normal y a las 23:31:59 el juego ya había vuelto a arrancar en `de_dust2_ob`, sin comando ni cambio de mapa antes. El reporter la guardó como cancelada (`91494145-9307-4200-b1a6-446af13ec5c4`). No hay volcado del error (sin Accelerator) y la consola del panel solo guarda lo de después. No tiene que ver con `csstv_mm 0`: es la única caída de los tres servidores en los diez días de logs que hay, y `de_season` se jugó más de 30 veces sin problemas. Al volver, el #3 quedó con la contraseña vieja (ver arriba).

## Cómo revertir

`csstv_mm "1"` en el `csstv_reporter.cfg` del #3 y `csstv_mm 1` por RCON, marcar los usos en la web y volver a poner la `SERVER_PASSWORD` anterior en el panel si se quiere. Hacerlo sin un mix en curso.

# Clips con el jugador como único vivo: guía de implementación

## Estado

Hecho y probado en la PC de Daniel el 2026-11-08, **sin commit**. Falta llevarlo al portátil y devolver los clips a la cola.

## Cómo se encontró

1. En producción, los clips de la partida `6ff0f34f` (mirage_rc1 del #1) y los de `a7493de9` (mirage_rc1 de flow) estaban `failed` con 3 intentos y el mismo error: `Sesión del juego: no hay ningún jugador vivo con nombre escribible para llegar a 'New™ …'`.
2. Con las demos y `pruebas/revisar_camara.py`, el error sale en el último tramo de un clutch: el del clip es el único vivo (ronda 26 de Lesco, ronda 16 de DnG; las dos terminan con la bomba desactivada).

## Pruebas

- `pruebas/revisar_camara.py` con las dos partidas (se corre desde `D:\CMLeague_Render\trabajo`, con las demos en `demos/`):
  ```
  python -I revisar_camara.py <match_id> <demo> [<match_id> <demo> …]
  ```
  Resultado: los 10 clips del #1 pasan; en flow pasan 4 y el de Malapraxis falla solo.
- `python render/probar_jugada.py 9ad95c0c-4a0f-4884-be6b-fd3c32f0aa8b` (el clutch de Lesco) con ClientMod en la PC: 3 pasadas, 300 cuadros por tramo, `D:\CMLeague_Render\videos\prueba_mirage_lesco_r26_specnext.mp4`. El último tramo (el de `spec_next`) se ve en primera persona desactivando la bomba: es Lesco.
- No se probó con el v34 normal (`"client": "v34"`), que es el del portátil.

## Despliegue

1. Commit (cuando Daniel lo pida) y `git pull` en el portátil, con la tarea "CMLeague clips" sin una corrida a mitad.
2. Con la confirmación de Daniel, correr `pruebas/reprocesar.sql` en producción (`sudo sb psql` en el VPS).
3. En la próxima corrida, revisar que los clips queden `done` (y el de Malapraxis `failed` con `Cámara: …`), y verlos en Drive.

## Vuelta atrás

Revertir el commit y `git pull` en el portátil. Los clips con el jugador como único vivo y nombre no escribible vuelven a cortar la sesión de toda la partida.

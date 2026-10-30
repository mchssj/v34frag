# Guía: misiones semanales (prototipo)

## Verlo

1. Levantar el frontend nuevo con la configuración `frontend-mm-ejemplo` (puerto 5173).
2. Abrir `http://localhost:5173/demo/misiones`.
3. Usar **Ganar un mix**, las acciones de "En la web", el botón de la mira (el popout), **Reclamar**, **Pasar a la semana siguiente** y **Admin → Misiones**.

Para correr los tests:

```bash
pnpm exec vitest run src/features/missions
```

## Cambios respecto del plan

- **Datos del servidor:** mientras se armaba, Kyan pidió usar los mismos datos del servidor que las medallas, sabiendo que hay cosas que se van a reversionar y pedir en el plugin. Por eso:
  - Cada métrica dice de dónde sale: plugin 1.8, plugin nuevo, web o un sistema que falta.
  - Las misiones que esperan datos no salen en la rotación.
  - Se sumaron misiones con los datos de schema 2 (clutchs, kills por arma, pistolas, ecos, bombas explotadas, rondas sobrevividas) y con plantadas y defuses, que ya existen.
  - `docs/MEDALLAS_DATOS_REPORTER.md` tiene ahora una sección que lo explica.
- **Catálogo:** quedaron 58 misiones (46 que ya pueden salir y 12 que esperan) en lugar de 45.
  - Hubo que sumar dos fáciles de web (mirar una demo y buscar con filtros), porque con la espera de 2 semanas se quedaban sin misiones que no fueran de juego.
- **Orden de elección:** de la más difícil a la más fácil. Al revés, las fáciles y medias llenaban el tope de juego y la difícil no tenía lugar.

## Cambio pedido por Kyan: las de la web, una sola vez

- **Qué pidió:** que las misiones de la web (votar un clip, entrar a la web 3 días distintos, subir un clip y ese tipo) se hagan **una sola vez desde que te registrás**, y no cada semana.
- **Primeros pasos:** las de la web pasaron a una lista aparte, `FIRST_STEPS`, con 14 misiones (11 para todos y 3 VIP). No rotan, no se reinician y se reclaman una vez. En el popout tienen su propia pestaña, y en la página su propia sección.
- **Semanales:** quedaron solo las de juego y comunidad.
  - Se sacó el tope por área, porque ahora casi todas son de juego. En su lugar va la regla de no repetir la misma stat en una semana (por ejemplo, "Ganá 1 mix" y "Ganá 3 mixes").
  - Para que alcance con la espera de 2 semanas se sumaron fáciles de juego: headshots, daño, entradas, un mix en de_nuke y 2 mapas distintos. También se sumaron VIP de juego: kills, asistencias, de_train, mixes enteros, entradas y headshots.
- **Totales:** quedaron 55 semanales (43 que ya pueden salir y 12 que esperan) y 14 de Primeros pasos.

## Notas

- No toca el plugin: no hay nada que subir al servidor real ni a RBK.
  - Cuando se pidan los datos de schema 2, ese cambio del plugin sí se despliega en los dos servidores.
- No tiene `CHANGELOG_DISCORD.txt`: se escribe cuando Esteban lo publique.
- **Revertir:** borrar `features/missions/` y `routes/demo.misiones.tsx`.

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

## Notas

- No toca el plugin: no hay nada que subir al servidor real ni a RBK.
  - Cuando se pidan los datos de schema 2, ese cambio del plugin sí se despliega en los dos servidores.
- No tiene `CHANGELOG_DISCORD.txt`: se escribe cuando Esteban lo publique.
- **Revertir:** borrar `features/missions/` y `routes/demo.misiones.tsx`.

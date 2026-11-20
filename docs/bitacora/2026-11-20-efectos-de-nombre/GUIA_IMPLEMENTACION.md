# Efectos de nombre que hagan lo que dice su nombre: guía de implementación

## Qué se hizo

1. Se cambiaron en `cosmeticos.css` las reglas de `.nombre-brillo`, `.nombre-glitch` (con `::before`, `::after` y los `@keyframes cos-glitch`, `cos-glitch-a` y `cos-glitch-b`), `.nombre-sombra` y `.nombre-fondo-mar` (con `::after` y `@keyframes cos-burbujas`).
2. `.nombre-fondo-mar` está en el bloque "generado por `generar_kits.py`". Ese script no está en `main` (solo en los worktrees de kyan y mmclaim, `docs/bitacora/2026-10-29-cosmeticos-300/pruebas/`): **si alguien vuelve a generar el bloque, pisa las Burbujas**. La regla lleva el comentario "editado a mano".

3. Al revisarlo en el ambiente local de Daniel no se veía ningún cambio: su Windows tiene apagados los "Efectos de animación", Chrome pide `prefers-reduced-motion: reduce` y el bloque del final de `cosmeticos.css` apaga todas las animaciones de `nombre-*`. Se agregó en ese bloque un cuadro fijo para Brillo (`background-position: 50% 0`) y Glitch (las dos mitades a la vista y corridas).

## Pruebas

- Página de prueba con el CSS real (fondo oscuro `#0a0a0a` y claro `#fff`, a 32 px y 15 px), con capturas de Playwright en varios momentos de la animación (animaciones pausadas con `document.getAnimations()`). Se ve:
  - Brillo: la franja naranja recorre el nombre en los dos modos.
  - Glitch: inclinación y cortes de color en la ráfaga; texto normal el resto del tiempo.
  - Burbujas: burbujas sueltas por detrás de las letras, visibles en los dos modos.
  - Sombra: la estela se ve en oscuro y en claro.
- Lo mismo con `reducedMotion: "reduce"` en Playwright, sobre el Vite local (5173) con los estilos de la app: los cuatro efectos se ven quietos.
- `pnpm exec vitest run src/features/shop`: 46 pruebas, todas pasan.
- No se probó en Safari ni Firefox, ni en el perfil real con un tema puesto (`--primary` del tema cambia el color del Brillo, a propósito).

## Despliegue

**Desplegado el 2026-11-20 (18:10-18:14 UTC)**, commit `9dc88348`: respaldo `20261120T181053Z`, replanteos `129` a `132` por el túnel, API y web `9dc88348b8b9` (desde una copia limpia del commit, sin los cambios sin commit de otros requerimientos). Con una sala del matchmaking en juego (`1fd48e0f`, partida ya empezada, por decisión de Daniel), que siguió `live`. Comprobado: 12 artículos de `tactico` y 22 con `is_new`, `GET /seasons/1/summary` 200 y 121 recaps de la Temporada 1.

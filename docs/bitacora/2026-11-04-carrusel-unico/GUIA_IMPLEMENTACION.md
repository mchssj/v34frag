# Un carrusel único para la web: guía de implementación

## Estado

Hecho en `main` y probado en local el 2026-11-04 (598 pruebas, lint, typecheck y build). **Desplegado el 2026-11-04 (23:44 UTC):** web `b3bdc2f9ffcb` desde `main` (599 pruebas). **Falta:** mirarlo en el navegador con datos reales.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/components/brand/Carousel.tsx` | Nuevo: `useCarousel`, `CarouselArrows`, `CarouselTrack` y `Carousel` |
| `web/frontend/src/components/brand/ClipCard.tsx` | Nuevo: `ClipCard`, `ClipCardPending` y `clipDuration` |
| `web/frontend/src/components/brand/Carousel.test.tsx` | Nuevo: flechas, degradado, teclado y tarjeta |
| `web/frontend/src/index.css` | `color-scheme` en `:root` y `.dark`, `scrollbar-thin` y el degradado |
| `web/frontend/src/features/matchmaking/room/Highlights.tsx` | La fila con `Carousel` y `ClipCard` |
| `web/frontend/src/features/mixes/components/MixHighlights.tsx` | Pasa la foto del mapa del catálogo (antes `poster={null}`) |
| `web/frontend/src/features/mixes/components/MixHighlights.test.tsx` | Simula el catálogo y comprueba la foto en la tarjeta |
| `web/frontend/src/features/series/pages/SeriesRoom.tsx` | `Carousel`, `ClipCard` y `ClipCardPending` en lugar de sus flechas y tarjetas; la foto del mapa de cada clip |
| `web/frontend/src/features/teams/components/TournamentHistory.tsx` | `CarouselTrack`, con las flechas en el `aside` del panel |

## Despliegue (hecho el 2026-11-04, web `b3bdc2f9ffcb`)

Solo la web, desde `main`, como el último despliegue (`fc72b2ea`). No toca la API, la base ni los servidores.

## Pruebas

### Web

- `pnpm test`: 97 archivos, 598 pruebas, todas bien.
- `pnpm lint`, `pnpm typecheck` y `pnpm build`: sin errores.
- `Carousel.test.tsx` simula los anchos (jsdom no mide): sin desborde no hay flechas; al inicio "Anteriores" está apagada y el degradado va a la derecha; al final, al revés; las flechas y ← → desplazan 680 px con una fila de 800.

### En el navegador

No se probó: hace falta la web desplegada o la API local con clips.

## En qué se apartó del plan

- La tarjeta elegida no dice "Reproduciendo" (estaba en la propuesta): cambiaba el alto de esa tarjeta. Queda marcada por el borde y el botón de play en naranja.
- La versión del changelog es la 2.9.13, porque la 2.9.12 la usa el plan de los equipos con rating, que todavía no se commiteó.

## Cómo revertir

Revert del commit y nuevo despliegue de la web.

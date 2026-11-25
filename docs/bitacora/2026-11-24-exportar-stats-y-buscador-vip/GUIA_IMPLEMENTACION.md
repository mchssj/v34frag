# Exportar tus stats y buscador avanzado para VIP: guía de implementación

## Estado

Hecho y probado en local (2026-11-24), en el worktree de `main`, **sin commit ni despliegue**.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/141_buscador_y_tarjeta.sql` y su inversa en `reversas/` | Nuevos |
| `web/backend/src/routes/vip-extras.ts` | Tarjeta y búsquedas guardadas |
| `web/backend/src/services/playerFilters.ts` (nuevo), `routes/ranking.ts`, `routes/seasons.ts`, `schemas/players.ts`, `schemas/seasons.ts` | Filtros avanzados del ranking |
| `web/backend/src/routes/matches.ts`, `schemas/matches.ts` | Filtros avanzados |
| `web/frontend/src/features/search/**`, `features/card/**` | Nuevos |
| `web/frontend/src/features/matches/**` | Panel, píldoras y búsquedas guardadas |
| `web/frontend/src/features/ranking/**` | `RankingFilters.tsx`, `lib/filters.ts` y las dos tablas |
| `web/frontend/src/routes/_app/players.index.tsx` | Era el "Próximamente": lleva a `/ranking` |
| `web/frontend/src/routes/_app/profile.card.tsx`, `features/profile/pages/ProfileLayout.tsx` | Sección **Tarjeta** |
| `web/frontend/src/features/player/pages/PlayerProfile.tsx` | Botón **Exportar stats** en el perfil propio |
| `web/frontend/src/features/shell/**` | Ruta de arriba y páginas del buscador (Ctrl + K) |
| `docs/manual/jugador/filtros-avanzados.md`, `tarjeta-de-stats.md` (nuevas), `buscador.md`, `elo-y-estadisticas.md` | Manual |

## Despliegue (pendiente)

Junto con los otros dos: ver [la guía del comparador](../2026-11-24-comparador-y-favoritas-vip/GUIA_IMPLEMENTACION.md). La `141` necesita la `140`.

## Pruebas

- **Base:** en [`vip_140_142.sql`](../2026-11-24-comparador-y-favoritas-vip/pruebas/vip_140_142.sql). Con y contra dan lo mismo que `players_together`; sin filtros, `match_search` da lo mismo que `match_list`; las páginas no repiten; el tope de 5 es por tipo; la tarjeta da las mismas partidas y victorias que el perfil. Las vistas de los filtros dan las mismas filas y puestos que el ranking; tardan 9 a 24 ms y `match_search` 7 ms en la copia.
- **API:** `test/integration/vip-extras.test.ts`.
- **Web:** `features/ranking/lib/filters.test.ts`, `PlayersRanking.test.tsx`, `features/search/lib/search.test.ts`, `features/matches/lib/search.test.ts` y `MatchesList.test.tsx`.
- **Navegador** (cuenta VIP de la copia): filtros, píldoras, guardar, abrir y borrar una búsqueda; los tres formatos de la tarjeta; el PNG y el PDF se descargan y son válidos. Sin VIP: panel apagado, píldoras tachadas, marca de agua y candado. En claro, oscuro y a 390 px, sin desborde.
- **No se probó:** el botón **Compartir** en un teléfono, ni con una foto que no cargue.

## En qué se apartó del plan

- **Sin página `/players`:** el plan ponía ahí el buscador de jugadores. Daniel lo vio en local (2026-11-24) y pidió los filtros en `/ranking`. Se quitaron `GET /players/search`, la vista `player_search` y la página, antes de commitear nada.
- **Mapa favorito:** el plan juntaba las versiones de un mapa. Quedó el mapa exacto, porque en el catálogo cada versión es un mapa aparte (`de_dust2_ob`, `de_strike_mirage`…).
- **Con, contra y diferencia** salen de una función (`match_search`) y no de la vista, para que valgan también en las series.

## Cómo revertir

Ver [la guía del comparador](../2026-11-24-comparador-y-favoritas-vip/GUIA_IMPLEMENTACION.md). La inversa de la `141` borra las búsquedas guardadas.

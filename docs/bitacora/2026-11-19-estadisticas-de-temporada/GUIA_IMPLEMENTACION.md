# Estadísticas de la temporada (recap y resumen global): guía de implementación

## Estado

Implementado y probado en la copia local de producción el 2026-11-19, en la rama `kyan/recap-main` (sale de `origin/main`). **Sin desplegar:** falta aplicar la `129` en el VPS y desplegar la API y la web.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/129_estadisticas_de_temporada.sql` | Nuevo: tablas, funciones, cambio en `season_close_run` y armado de las cerradas |
| `supabase/replanteo/README.md` | Fila de la `129` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/129_estadisticas_de_temporada.sql` | Nuevo: la inversa |
| `web/backend/src/schemas/seasons.ts` | `SeasonRecap`, `SeasonSummary`, parámetros y `has_recap` en `PlayerSeason` |
| `web/backend/src/routes/seasons.ts` | Rutas `recap` y `summary`, `has_recap` |
| `web/backend/src/routes/clips.ts` | `featuredItems` se exporta (los clips del recap usan lo mismo que los destacados) |
| `web/backend/src/db/types.ts` | `season_recaps`, `season_summaries`, `season_recap_live` y `season_summary_live`, a mano en el formato generado |
| `web/backend/test/unit/season-stats-routes.test.ts` | Nuevo: 7 pruebas |
| `web/frontend/src/api/schema.d.ts` | Regenerado con la API local |
| `web/frontend/src/features/player/recap/` | El visor del prototipo con datos de la API: `RecapViewer.tsx`, `RecapPage.tsx` (nuevo), `clips.tsx` (con el video real), `hints.tsx`, `export.ts`, `types.ts` (el adaptador `fromApi`) |
| `web/frontend/src/routes/_app/player.$nick_.recap.$season.tsx` | Nuevo |
| `web/frontend/src/routes/_app/season.$number.tsx` y `features/ranking/pages/SeasonStats.tsx` | Nuevos |
| `web/frontend/src/features/player/api/queries.ts`, `features/ranking/api/queries.ts` | `seasonRecapOptions` y `seasonSummaryOptions` |
| `web/frontend/src/features/player/components/tabs/SeasonsTab.tsx` | Botones y la tarjeta en vivo para admins |
| `web/frontend/src/features/ranking/components/SeasonBar.tsx`, `features/admin/seasons/pages/AdminSeasonsPage.tsx` | Botón de estadísticas |
| `web/frontend/src/features/player/pages/PlayerProfile.test.tsx`, `features/player/lib/labels.test.ts` | Prueba nueva de Temporadas; `has_recap` en el dato de prueba |
| `web/frontend/src/routes/demo.recap.tsx`, `routes/-demo-recap/` | Borrados (el prototipo pasó a `features/player/recap/`) |
| `docs/bitacora/2026-11-14-recap-temporada/` | El plan y el prototipo de `kyan/recap`; los avisos del prototipo quedan en `prototipo/notices.tsx` |
| `web/frontend/src/features/legal/`, `terms/privacidad.html`, `terms/terminos.html` | Párrafo nuevo en "Qué es público" y la fecha |
| `docs/manual/jugador/elo-y-estadisticas.md`, `docs/manual/admin/temporadas.md` | Recap y estadísticas |

## Despliegue (pendiente)

1. Aplicar la `129` en la base del VPS (Daniel o Kyan), por el túnel:

   ```bash
   psql "$PG_URL" -v ON_ERROR_STOP=1 -f supabase/replanteo/129_estadisticas_de_temporada.sql
   ```

   Arma las fotos de las temporadas cerradas (en la copia, la Temporada 1: 121 recaps en menos de 1 s). Si falla, no queda nada aplicado (va en una transacción).
2. Desplegar la API (`web/backend`) y la web (`web/frontend`).
3. Publicar `CHANGELOG_DISCORD.txt` (CMLeague 2.9.57).
4. Llevarlo a `feat/frontend-fase-1` si hace falta, preguntando antes (no es del matchmaking: no va a `feat/mm-claim-en-sala`).

## Pruebas

### Base (copia local de producción, `cmleague-copia-prod`)

- La `128` (hoy `129`) se aplicó, se revirtió con la inversa y se volvió a aplicar sin errores. La inversa deja `season_close_run` sin la llamada.
- Temporada 1 (cerrada): 121 recaps; en los 120 que tienen fila en `season_standings`, mixes y victorias coinciden con la foto del ranking. El otro es una ficha sin `player_elo`, que el ranking no cuenta.
- Temporada 2 (activa): `season_recap_live` y `season_summary_live` como admin devuelven los datos (1,4 s y 0,4 s); como `user`, `42501`; como `anon`, sin permiso. `season_recap_compute` sin permiso para `anon`.
- `season_close_run` de la Temporada 2 dentro de una transacción con `rollback`: armó 62 recaps (53 con la temporada anterior) y el resumen (47 mixes), en 0,9 s en total.

### API

- 684 pruebas unitarias, con las 7 nuevas (`season-stats-routes.test.ts`): cerrada sin sesión, sin recap, activa como jugador y sin sesión (404 sin llamar a la base), activa como admin (`live`, `no-store`), número inválido, y el resumen cerrado y activo. La respuesta se valida contra `SeasonRecap` y `SeasonSummary`.
- De punta a punta con la copia: PostgREST local, un proxy con sesiones firmadas para un admin y un jugador, y la API (`tsx src/node.ts`). La Temporada 1 se ve sin sesión, la 2 da 404 sin sesión y como jugador, y el admin la ve en vivo. `has_recap` llega bien.

### Web

- `tsc -b`, ESLint y 832 pruebas de Vitest (una nueva en Temporadas).
- En el navegador, contra la API local y la copia: el resumen de la Temporada 2 como admin (cartel en vivo, cifras de los mixes, matchmaking, barras por hora y por día, mapas, servidores y comunidad; los servidores suman los 47 mixes), el recap en vivo y el de la Temporada 1 (slides, vista completa con medalla, curva de ELO, marcas, clips con su video de Drive, compañeros), y como jugador el 404 de la Temporada 2 y el botón oculto en el Ranking. El resumen en 375 px no tiene desborde horizontal.
- **No se probó:** la pestaña Temporadas en el navegador (en la copia, del 2026-11-12, el perfil no carga porque le faltan replanteos posteriores de `main`, como la tienda; se cubrió con Vitest), guardar el JPEG y el PDF con datos reales (no se cambió `export.ts` salvo los campos; el prototipo ya se había probado), el modo claro (el visor es siempre oscuro; la página del resumen usa los tokens de la web) y un cierre real en producción.

## En qué se apartó del plan

- **El resumen ya no tiene rankings de jugadores** (Kyan, 2026-11-19, al probarlo: "es algo que se ve sobre la web y el matchmaking, no sobre los jugadores"). Se sacaron los líderes, el podio, las mejores actuaciones y las de más kills, y se sumaron la cola y las salas del matchmaking, los mixes por hora y por día, los servidores y la comunidad. Se cambió la `129` antes de desplegarla (no estaba aplicada en producción); en la copia se aplicó la inversa y la `129` nueva.
- El parámetro `season` de la ruta del recap queda como texto en la web y se convierte al usarlo: con el `parse` de TanStack, la ruta desanidada (`$nick_`) no tomaba el tipo.
- La ruta del recap se desanidó del perfil (`player.$nick_…`): el perfil no tiene `Outlet` y el recap no se veía.
- Los nombres de los mapas ya no recortan sufijos (`dust2` y `dust2_ob` salían los dos como "Dust2").
- El prototipo de los avisos (`notices.tsx`) se guardó en `docs/bitacora/2026-11-14-recap-temporada/prototipo/`, no en esta carpeta, porque es del plan de los avisos.

## Cómo revertir

1. En la base: `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/129_estadisticas_de_temporada.sql` (borra las fotos y las funciones y deja `season_close_run` como antes).
2. En el código: revertir el commit de este requerimiento en `kyan/recap-main`.

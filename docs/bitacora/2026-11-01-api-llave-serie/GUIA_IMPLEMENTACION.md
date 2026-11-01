# Rating de la serie y enlaces de la llave en la API (E21 y E22): guía de implementación

## Estado

Implementado y probado en local el 2026-11-01:

- **Backend:** commit en `feat/backend-api-fase-1` (sin push), llevado a `feat/frontend-fase-1` con merge (que trajo también lo de [`2026-10-30-api-pendientes-frontend`](../2026-10-30-api-pendientes-frontend/)).
- **Frontend:** commit aparte en `feat/frontend-fase-1` (sin push).

Sin desplegar.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/backend/src/schemas/events.ts` | `EventMatch` con `next_win`, `next_win_slot`, `next_lose` y `next_lose_slot`; `stage` documenta `group_upper` y `group_lower`, y el filtro los acepta |
| `web/backend/src/routes/events.ts` | El listado de partidas lee los `next_*` de `matches` para los `id` de la página |
| `web/backend/src/schemas/matches.ts` | `MatchDetail.series_players` |
| `web/backend/src/services/matches.ts` | `sumSeries` y `StatRow` |
| `web/backend/src/routes/matches.ts` | La consulta de `games` suma `status`; `series_players` con los juegos terminados; `players` y `series_players` se arman con la misma función (`lineOf`) |
| `web/backend/test/unit/tournament-services.test.ts` | Dos casos de `sumSeries` |
| `web/backend/test/integration/llave-serie.test.ts` | Nuevo: enlaces de una llave doble de 4, filtro `group_upper`/`group_lower` y `series_players` con un juego invertido y uno en vivo |
| `docs/frontend/contrato/README.md`, `torneos.md`, `partidas.md` | Novedad del 2026-11-01 y los campos nuevos |
| `web/frontend/src/api/schema.d.ts` | Regenerado (`pnpm gen:api`); trae también lo de E9 a E18 |
| `web/frontend/src/features/events/lib/bracket.ts` | `originOf` usa `next_win`/`next_lose` antes de deducir; `destinationsOf` marca "↓ L2" con `next_lose` |
| `web/frontend/src/features/events/components/bracket/MatchPopover.tsx` | Alineaciones con el rating de la serie (si no llega, los inscritos sin rating, como antes) |
| `web/frontend/src/features/events/lib/bracket.test.ts`, `e2e/events.spec.ts`, `e2e/event-fixtures.ts` | Casos de E21 y E22 |
| `web/frontend/src/features/player/lib/labels.test.ts` | El ejemplo de temporada suma `ended_at` y `players` (E20 de temporadas, del merge) |
| `contrato-backend-equipo-torneos.md`, `docs/PENDIENTES.md` | E21 y E22 resueltos |

Sin migración y sin cambios en `src/db/types.ts`.

## Merge del backend en el frontend

Daniel eligió **merge** en vez del rebase de siempre (2026-11-01): `feat/frontend-fase-1` tenía 122 commits encima del backend, entre ellos el merge del refactor de Esteban y 72 ya subidos a `origin`, y un rebase los habría reescrito todos con force push.

- Antes del merge, `feat/frontend-fase-1` tenía 55 archivos en stage de otras sesiones (plugin, HUD, bitácoras). Se guardó el índice como árbol, se dejó el índice igual a `HEAD` (la copia de trabajo no se tocó), se hizo el merge y se volvió a poner lo que estaba en stage.
- Conflictos: solo en `docs/bitacora/README.md` (filas nuevas en las dos ramas) y, al devolver lo de stage, en `docs/PENDIENTES.md`. Las secciones del backend pasaron de 1.31 y 1.32 a **1.37 y 1.38**, porque las del plugin ya usaban de la 1.31 a la 1.36.
- Al devolver lo de stage, el PDF del reglamento quedó con un blob roto en el índice; se volvió a apuntar al original y se comprobó, archivo por archivo, que todo lo de stage quedó igual que antes del merge.

## Despliegue (pendiente)

1. Redesplegar la API del VPS cuando se suba esta rama. No necesita nada en la base: los campos ya existen en producción y en staging.
2. No toca el plugin: nada que subir al servidor real ni a flow.

## Pruebas

Contra la Supabase local, el 2026-11-01. Backend:

- `pnpm typecheck`: sin errores.
- `pnpm test`: 396 unitarias (dos nuevas de `sumSeries`).
- `pnpm test:int`: 172 de integración (tres nuevas en `llave-serie.test.ts`).
  - En una llave doble de 4: cada partida de la ronda 1 del upper apunta a la ronda 2 del upper (ganador) y al lower (perdedor), con lados distintos para los dos perdedores; la gran final no apunta a nada.
  - Serie con tres juegos vinculados: uno con los bandos de la serie, otro invertido y uno en vivo. `series_players` suma los dos terminados en el lado de la serie (35 kills y rating 1,1 = (1,5 × 30 + 0,5 × 20) / 50) y deja afuera el en vivo.

Frontend:

- `pnpm typecheck` y `pnpm lint`: sin errores.
- `pnpm test`: 399 unitarias (tres nuevas: origen con los enlaces en el lower y la gran final, y "↓ L2" antes de que el equipo aparezca).
- `pnpm exec playwright test e2e/events.spec.ts`: 11 de 11 (el detalle muestra "Alineaciones · rating de la serie" con el nombre en el juego de quien no tiene ficha).

## En qué se apartó del plan

- El plan dejaba abierta una función pura para la suma: quedó como `sumSeries`, con sus pruebas unitarias.
- **Lectura defensiva en el frontend:** el detalle resumido toma `series_players ?? []`. Con la API vieja (producción hasta que se redespliegue) el campo no llega y el detalle no abría; las e2e lo mostraron.
- **Alineaciones:** con rating, se listan los que jugaron (alias o, sin ficha, el nombre en el juego), no los inscritos.

## Cómo revertir

`git revert` del commit del frontend (`feat(frontend): rating de la serie y enlaces de la llave en la Llave (E21 y E22)`) y del backend (`feat(api): rating de la serie y enlaces de la llave (E21 y E22)`). No hay nada que deshacer en la base.

# Gestión de torneos: guía de implementación

## Estado

- **Backend:** implementado y probado en local el 2026-11-01, con commit en `feat/backend-api-fase-1` (sin push).
- **Frontend:** en `feat/frontend-fase-1`, después del merge del backend (ver la sección Frontend).

Sin desplegar.

## Archivos (backend)

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/41_admin_torneos.sql` | Nuevo |
| `supabase/replanteo/README.md` | Fila de la `41` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/41_admin_torneos.sql` | Nueva: inversa (los mixes vinculados y los resultados se quedan) |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/41_admin_torneos.sql` | Nuevas: 39 pruebas SQL, con rollback |
| `web/backend/src/routes/events.ts`, `schemas/events.ts` | `POST /events/{id}/seeds/ranking`, `SeedsResult`, `viewer.can_own` |
| `web/backend/src/routes/matches.ts`, `schemas/matches.ts` | `GET /matches/{id}/games/candidates`, `PUT /matches/{id}/maps`, `GameCandidate`, `SeriesMap`, `SeriesMapsBody` |
| `web/backend/src/db/types.ts` | Regenerado |
| `web/backend/src/routes/pcw-play.ts` | `GET /servers` también para los moderadores (para asignar el servidor de una partida) |
| `web/backend/test/integration/admin-torneos.test.ts` | Nuevo: moderador (siembra por ranking, etapas, sin cancelar ni borrar, reiniciar) y mapas de una serie |
| `docs/frontend/contrato/` | `torneos.md`, `partidas.md` y la novedad en `README.md` |
| `supabase/replanteo/42_torneo_fin_real.sql` (+ inversa y 3 pruebas) | Ajuste del 2026-11-01: `event_list.finished_at` y el trigger `matches_played_at` |
| `web/backend/src/routes/events.ts`, `schemas/events.ts` | `EventSummary.finished_at`; `ends_on` descrito como tentativo |

## Despliegue (pendiente)

1. Staging: cargar la `41` después de la `40` y redesplegar la API.
2. Corte: la `41` va después de la `40`.
3. No toca el plugin.

## Pruebas (backend)

Contra la Supabase local, el 2026-11-01:

- SQL de la `41`: 39 de 39. La inversa se probó ida y vuelta.
- `pnpm typecheck`: sin errores.
- `pnpm test`: 396 unitarias.
- `pnpm test:int`: 174 de integración (2 nuevas).

## En qué se apartó del plan

- **Rutas:** `GET /matches/{id}/games/candidates` (el plan decía `/games/candidates` sin detallar) y `PUT /matches/{id}/maps`.
- **Sin puntos:** un equipo sin partidas cuenta 0 puntos (no "al final"): con eso, el ELO ordena a todos los que tienen 0, también a los que jugaron y perdieron.
- **Vincular un mix:** no exige que todos los jugadores sean del plantel (como `!match`); alcanza con que haya jugado un inscrito, porque lo decide una persona. El bando se deduce por mayoría y se puede invertir con `side1`.
- **Servidores:** `GET /servers` era solo para organizadores y admins; se sumaron los moderadores, que también asignan el servidor de una partida.
- **Cancelar:** como la API cancela con un `UPDATE` que permite la política de gestión, el bloqueo al moderador es un trigger (`events_owner_only`), no la política.

## Ajuste: fin tentativo y fin real (2026-11-01)

Daniel pidió que "Termina" sea una fecha tentativa: el torneo puede terminar antes o después.

- **Antes:** `ends_on` ya era opcional y nada dependía de ella (el torneo termina cuando se juega la final), salvo la fecha que se mostraba del campeón ("Campeón · hace X días"), que salía de `ends_on`.
- **Ahora:**
  - `event_list.finished_at` (replanteo `42`) es la fecha de la última partida terminada. La API la devuelve en `EventSummary.finished_at` y el frontend la usa para el campeón; si falta, usa `ends_on`.
  - En el formulario, el campo se llama "Termina (aproximado)".
  - El único control sigue siendo que no sea anterior a "Empieza", y solo en el formulario: la API no lo valida.
- **Partidas sin fecha:** un resultado a mano o un W.O. no ponían `played_at`, así que esos torneos no tenían fecha de fin. El trigger `matches_played_at` les pone la del momento en que se carga el resultado (solo torneo y PCW; los mixes la traen del servidor). Las partidas viejas sin fecha siguen sin ella.

## Cómo revertir

1. Base: `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/41_admin_torneos.sql`.
2. Código: `git revert` de los commits del backend y del frontend.

# Rating de la serie y enlaces de la llave en la API (E21 y E22): guía de implementación

## Estado

Implementado y probado en local el 2026-11-01, con commit en `feat/backend-api-fase-1` (sin push) y llevado a `feat/frontend-fase-1` con merge. Sin desplegar.

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

Sin migración y sin cambios en `src/db/types.ts`.

## Despliegue (pendiente)

1. Redesplegar la API del VPS cuando se suba esta rama. No necesita nada en la base: los campos ya existen en producción y en staging.
2. No toca el plugin: nada que subir al servidor real ni a flow.

## Pruebas

Contra la Supabase local, el 2026-11-01:

- `pnpm typecheck`: sin errores.
- `pnpm test`: 396 unitarias (dos nuevas de `sumSeries`).
- `pnpm test:int`: 172 de integración (tres nuevas en `llave-serie.test.ts`).
  - En una llave doble de 4: cada partida de la ronda 1 del upper apunta a la ronda 2 del upper (ganador) y al lower (perdedor), con lados distintos para los dos perdedores; la gran final no apunta a nada.
  - Serie con tres juegos vinculados: uno con los bandos de la serie, otro invertido y uno en vivo. `series_players` suma los dos terminados en el lado de la serie (35 kills y rating 1,1 = (1,5 × 30 + 0,5 × 20) / 50) y deja afuera el en vivo.

## En qué se apartó del plan

- Nada de fondo. El plan dejaba abierta una función pura para la suma: quedó como `sumSeries`, con sus pruebas unitarias.

## Cómo revertir

`git revert` del commit `feat(api): rating de la serie y enlaces de la llave (E21 y E22)`. No hay nada que deshacer en la base.

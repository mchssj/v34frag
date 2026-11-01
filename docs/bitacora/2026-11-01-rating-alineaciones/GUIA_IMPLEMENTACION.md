# Rating en las alineaciones de una serie: guía de implementación

## Estado

Implementado y probado en local el 2026-11-01. Backend con commit en `feat/backend-api-fase-1` y frontend en `feat/frontend-fase-1`. Sin desplegar.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/44_rating_reciente.sql` | Nuevo |
| `supabase/replanteo/README.md` | Fila de la `44` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/44_rating_reciente.sql` | Inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/44_rating_reciente.sql` | 5 pruebas SQL, con rollback |
| `web/backend/src/schemas/matches.ts` | `RosterPlayer.rating` |
| `web/backend/src/routes/matches.ts` | El plantel trae el rating reciente |
| `web/backend/src/db/types.ts` | Regenerado |
| `web/backend/test/integration/tournaments.test.ts` | El plantel sin partidas trae `rating: null` |
| `docs/frontend/contrato/partidas.md` y `README.md` | El campo nuevo |
| `web/frontend/src/features/events/components/bracket/MatchPopover.tsx` | Usa el rating del plantel cuando la serie no tiene stats |
| `web/frontend/src/api/schema.d.ts` | Regenerado |

## Pruebas

- SQL de la `44`: 5 de 5 (5v5 reciente sí; 2v2 y fuera de la ventana no; ventana más larga; varios jugadores; anon).
- Backend: `pnpm typecheck` sin errores, 396 unitarias y 177 de integración.
- Frontend: typecheck, lint y unitarias.

## Despliegue (pendiente)

1. Staging: cargar la `44` después de la `43` y redesplegar la API.
2. Corte: la `44` va después de la `43`.
3. No toca el plugin.

## Cómo revertir

1. Base: `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/44_rating_reciente.sql`.
2. Código: `git revert` de los commits.

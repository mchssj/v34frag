# Columnas del Histórico en el ranking de una temporada: guía de implementación

## Estado

Implementado y probado en local el 2026-10-25, sin commit ni despliegue. Sale con el corte (replanteo `30`). Falta mostrar las columnas en la tabla de la temporada del frontend.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/30_mapas_temporadas.sql` (bloque 4) | `season_player_stats`; `season_standings.rating` y `kd`, llenados en las temporadas cerradas; `season_close_run` los guarda; `season_live_standings` y `season_standings_list` recreadas |
| `supabase/replanteo/README.md` | Fila de la `30` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/30_mapas_temporadas.sql` | Inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/30_mapas_temporadas.sql` | Pruebas SQL (bloque 4) |
| `web/backend/src/lib/db.ts` | `levelBounds`: rango de ELO de un filtro de nivel |
| `web/backend/src/routes/ranking.ts` | El Histórico usa `levelBounds` |
| `web/backend/src/routes/seasons.ts` | `standings`: filtros `level` y `team`, y los campos `teams`, `rating` y `kd` |
| `web/backend/src/schemas/seasons.ts` | `Standing` suma `teams`, `rating` y `kd`; `StandingQuery` suma `level`, `team` y los órdenes; `PlayerSeason` no los trae |
| `web/backend/src/db/types.ts` | Regenerado |
| `web/backend/test/unit/seasons-routes.test.ts` | Campos nuevos y prueba de filtros y orden |
| `web/backend/test/integration/seasons.test.ts` | Rating y K/D en vivo y en la foto, filtro de nivel y orden por K/D |
| `web/frontend/src/api/schema.d.ts` | Regenerado |
| `docs/frontend/contrato/temporadas.md`, `api.md` y `README.md` | Contrato |

## Despliegue (pendiente, en el corte)

1. Aplicar `supabase/replanteo/30_mapas_temporadas.sql` después de la `29`.
2. Desplegar el backend con la web nueva.

En producción todavía no hay temporadas: la BETA se abre en el corte (`docs/PENDIENTES.md`, punto 1.5).

## Pruebas

### Base de datos

Se probó en la Supabase local con los mismos pasos de `pruebas/correr.sh`, sin el reset de la base: aplicar, prueba, segunda aplicación, inversa con comparación de la estructura y aplicar de nuevo. El script quedó en el scratchpad de la sesión. Hay 8 comprobaciones del bloque 4, todas en verde:
- solo cuentan los mixes del período con ELO aplicado, con los dos SteamID de la ficha;
- rating, K/D y equipos en la activa;
- `null` sin mixes;
- un anónimo puede leer;
- al cerrar, quedan en la foto, y la foto no cambia con un mix posterior;
- la temporada siguiente sale en vivo.

Además, una segunda aplicación aborta y la inversa deja la estructura idéntica.

### Backend

- **Unitarias:** 313 en verde.
- **Integración:** 127 en verde (todas).
- **Typecheck:** en verde.
- **Frontend:** `tsc -b` y sus 263 pruebas en verde con los tipos nuevos.

## En qué se apartó del plan

- **Nombre del archivo:** el replanteo se llama `30_mapas_temporadas.sql`. La inversa y las pruebas van con las de los replanteos anteriores, como se corrigió en el plan antes de empezar.
- **Bloque 4:** las temporadas pasaron a ser el bloque 4 del replanteo, porque el de mapas creció (plan [`2026-10-25-pool-mapas-torneos-pcw`](../2026-10-25-pool-mapas-torneos-pcw/PLAN.md)).
- **`numeric(4,2)`:** el rating quedó así, como en el plan, y alcanza hasta 99,99.

## Incidentes durante las pruebas

`test/integration/seasons.test.ts` borra todas las temporadas de la base local, incluida la BETA. Se respaldó antes y se restauró la fila después de cada corrida.

Al insertar varias filas de `match_player_stats` juntas, una fila con `k1` y otra sin él deja la segunda en null y viola el `not null`. Por eso se les pusieron los mismos campos a todas.

## Cómo revertir

- **Base:** aplicar la inversa `reversas/30_mapas_temporadas.sql`, que revierte también el bloque de mapas.
- **Código:** revertir el commit del backend.

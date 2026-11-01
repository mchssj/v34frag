# Pendientes de la API para el frontend (E9 a E20): guía de implementación

## Estado

Implementado y probado en local el 2026-10-30, commit del 2026-11-01 en `feat/backend-api-fase-1` (vuelto a probar ese día: 394 unitarias, 169 de integración y las pruebas SQL de la `39`). Falta cargar la `39` en staging, redesplegar la API y que el frontend active lo suyo.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/39_pendientes_frontend.sql` | Nuevo: columnas, funciones, triggers, índice y vistas (ver la documentación) |
| `supabase/replanteo/README.md` | Fila de la `39` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/39_pendientes_frontend.sql` | Nueva: inversa (aborta si hay equipos disueltos) |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/39_pendientes_frontend.sql` | Nuevas: 49 pruebas SQL, con rollback |
| `web/backend/src/lib/errors.ts` | `V3901` → `409 CONFLICT` (con el objeto del `detail`) y `P0002` → `404` |
| `web/backend/src/schemas/matches.ts` | `status` con lista, `mine`, `MatchListItem` (con `mvp`), `MatchCounts` y `MatchList` con `counts` |
| `web/backend/src/routes/matches.ts` | Filtros compartidos para la página y los contadores, `mine`, búsqueda por nick y MVP desde `mix_list` |
| `web/backend/src/schemas/teams.ts` | `TeamPatch` con `name` y `tag`; `TeamDetail` con `dissolved_at`, `name_changed_at` y `next_name_change_at`; `TeamRequest` con `created_at` y `reject_reason` |
| `web/backend/src/routes/teams.ts` | `POST /teams/{id}/dissolve`, `PATCH` con nombre y sigla, listado sin disueltos |
| `web/backend/src/routes/account.ts` | `DELETE /me/team-request` y los campos nuevos de la solicitud |
| `web/backend/src/schemas/admin.ts`, `src/routes/admin-teams.ts` | Rechazo con `{ reason }` opcional |
| `web/backend/src/schemas/profile.ts`, `src/routes/me.ts` | `bio` en `PATCH /me/profile` y en `player`; "Mi perfil" sin equipos disueltos |
| `web/backend/src/routes/players.ts` | `logo_url` en `/teams` y `/titles` |
| `web/backend/src/schemas/seasons.ts`, `src/routes/seasons.ts` | `ended_at` y `players` en `/players/{id}/seasons` |
| `web/backend/src/db/types.ts` | Regenerado (`pnpm db:types`) |
| `web/backend/test/unit/errors.test.ts` | Pruebas de `V3901` y `P0002` |
| `web/backend/test/integration/pendientes-frontend.test.ts` | Nueva: 6 pruebas de punta a punta |
| `web/backend/test/integration/players-teams.test.ts`, `seasons.test.ts`, `mixes-perfil-ranking.test.ts` | Respuestas con los campos nuevos |
| `docs/frontend/contrato/` | `README.md`, `api.md`, `cuenta.md`, `equipos.md`, `jugadores.md`, `partidas.md`, `admin.md` y `notificaciones.md` |
| `docs/PENDIENTES.md` | Punto 1.31 |

## Despliegue (pendiente)

1. Commit en `feat/backend-api-fase-1` cuando Daniel lo pida, y llevarlo a `feat/frontend-fase-1`.
2. Staging: aplicar `supabase/replanteo/39_pendientes_frontend.sql` (después de la `38`) y redesplegar la API del VPS. **La API nueva necesita la `39`:** lee `player_search`, `dissolved_at`, `name_changed_at`, `ended_at` y `players`.
3. Corte: la `39` va después de la `38` (`docs/PENDIENTES.md`, punto 1.5).
4. Frontend: regenerar `src/api/schema.d.ts` y activar lo que estaba deshabilitado.

No toca el plugin: nada que subir al servidor real ni a flow.

## Pruebas

### Base (Supabase local)

- `pruebas/39_pendientes_frontend.sql`: **49 OK**. Solicitud (fecha, motivo, cancelar, `P0002` y `V3901`), biografía (largo, saltos de línea, palabra bloqueada, palabras sueltas que juntas forman una bloqueada, control, sin ficha), nombre y sigla (permisos, únicos, largo, palabra bloqueada, 30 días con `next_change_at`, admin sin espera), disolver (permisos, torneo abierto, bajas, invitaciones, avisos, ranking, triggers, segunda vez, inexistente, nombre libre), `player_search` y `player_season_list`.
- **Ida y vuelta:** volcado del esquema `public`, inversa, volcado sin restos de la `39`, la `39` de nuevo y volcado: idéntico al primero.
- **Desde cero:** base recargada con `01` a `39` sin errores (ver "Incidentes").
- `EXPLAIN` de un filtro por `player_search`: las dos subconsultas usan índices (`match_player_stats_match_steam_key` y el nuevo `matches_parent_match`).

### API

- `tsc` (las dos configuraciones): sin errores.
- Unitarias: **394 OK** (28 archivos).
- Integración: **169 OK** (25 archivos), contra la base recargada desde cero. `pendientes-frontend.test.ts` pasa dos veces seguidas sobre la misma base.

## En qué se apartó del plan

- **`player_search`:** el plan lo pensaba como una sola subconsulta (`s.match_id = m.id OR s.match_id IN (…)`). Así no usa índices. Quedó en dos subconsultas, la de los mapas de la serie solo en torneo y PCW, más el índice parcial `matches_parent_match`.
- **`P0002` → `404`:** no estaba en el plan. Se sumó para "no tenés solicitud" y "no existe ese equipo", que si no daban `500`.
- **"Mi perfil":** tampoco lista los equipos disueltos, aunque el usuario siga como capitán o dueño.
- **Sin sigla:** `team_rename` deja un equipo sin sigla solo si ya no tenía (equipos viejos creados por un admin).

## Incidentes durante las pruebas

- **`pnpm db:reset` falla en este worktree en el replanteo `04`** ("no se encontró: insert into teams(name, tag, members, guests, kind)…"). No es de este cambio: el checkout tiene los `.sql` con CRLF (`core.autocrlf=true`, `git ls-files --eol` da `w/crlf`) y los reemplazos de texto de los replanteos buscan `\n`. Para probar, se copió `supabase/` y los scripts al scratchpad pasando a LF, se corrió `supabase db reset --local --no-seed` y `db-local.sh load` desde la copia. Conviene un `.gitattributes` con `*.sql text eol=lf` (o que `db-local.sh` saque los `\r`).
- `team_dissolve` usaba `events.created_at`, que no existe; quedó ordenado por nombre.
- Las pruebas de integración dejan datos en la base local: la sigla fija de la prueba de equipos chocaba con la de una corrida anterior. Ahora es al azar.

## Cómo revertir

1. Base: correr `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/39_pendientes_frontend.sql`. Aborta si hay equipos disueltos; se pierden las fechas y los motivos de las solicitudes y los avisos `team_dissolved`.
2. API: revertir el commit (o descartar los cambios de los archivos de la tabla) y regenerar `src/db/types.ts`.
3. Contrato: revertir los cambios en `docs/frontend/contrato/`.

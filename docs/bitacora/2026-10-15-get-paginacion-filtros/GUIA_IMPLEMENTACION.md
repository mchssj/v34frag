# Paginación, filtros y orden en el servidor para todos los GET: guía de implementación

## Estado

Hecho y probado en local el 2026-10-15: migración `11` y backend. **Sin commit y sin desplegar.** La `11` se aplica en el corte, después de la `10`. Daniel aprobó el plan y sus tres propuestas el 2026-10-15:
- Detalles sin listas que crecen.
- Chat por cursor.
- El mismo formato para las listas chicas.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/11_listados.sql` | Nuevo: las vistas `match_list`, `event_list`, `event_registrations_view`, `event_standings`, `team_ranking`, `team_members_view`, `pcw_post_list`, `admin_user_list` y `admin_team_requests` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/11_listados.sql` | Nuevo: inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/11_listados.sql` | Nuevo: pruebas de las vistas |
| `web/backend/src/lib/list.ts` | Nuevo: `listQuery`, `runList`, `envelope`, `Envelope`, `boolParam`, `dateParam` |
| `web/backend/src/routes/players.ts` | Listado con filtros y orden. La ficha sin listas. Nuevos `/map-stats`, `/medals` y `/teams` |
| `web/backend/src/routes/teams.ts` | Listado con orden y `has_space`. El equipo sin plantel ni partidas. Nuevo `/members`. Ranking paginado sobre `team_ranking` (`points` pasa a `points_per_win`) |
| `web/backend/src/routes/roster.ts` | Invitaciones y pedidos como listados con `kind` |
| `web/backend/src/routes/matches.ts` | Listado sobre `match_list` con filtros nuevos (`player`, `map`, `from`, `to`, `q`). Chat por cursor |
| `web/backend/src/routes/events.ts` | Listado sobre `event_list`. El detalle sin listas. Nuevos `/registrations`, `/matches` y `/standings` (con `ETag`) |
| `web/backend/src/routes/pcw-play.ts` | Anuncios paginados sobre `pcw_post_list`. `/me/pcw` pasa a `/me/pcw/post` y `/me/pcw/matches`. Mapas y servidores como listados |
| `web/backend/src/routes/admin-players.ts`, `admin-teams.ts`, `me.ts` | Listados de admin y de reclamos con filtros y orden |
| `web/backend/src/schemas/*.ts` | Esquemas de consulta y respuesta de cada listado |
| `web/backend/src/services/matches.ts` | `toSummary` lee de `match_list` (con `last_round`, sin otra consulta para el nombre de la fase) |
| `web/backend/src/db/types.ts` | Tipos regenerados con la `11` |
| `web/backend/test/unit/list.test.ts` | Nuevo: el helper |
| `web/backend/test/unit/me-routes.test.ts` | Reclamos como listado y `sort` inválido |
| `web/backend/test/integration/*.test.ts` | Respuestas en el sobre, sub-endpoints, filtros y órdenes; nuevos casos de tablas y stats por mapa |
| `docs/frontend/contract.md` | Convención, tabla de filtros y órdenes, detalles y chat |
| `supabase/replanteo/README.md`, `docs/bitacora/2026-10-14-replanteo-modelo-datos/DOCUMENTACION.md`, `docs/PENDIENTES.md` | Fila de la `11`; corte con 01 a 11 |

## Despliegue (pendiente: va en el corte)

1. **Base:** aplicar `supabase/replanteo/11_listados.sql` después de la `10`. Solo crea vistas.
2. **Backend:** sale con el primer despliegue. Sin variables nuevas.

## Pruebas

- **`correr.sh`** pasa con 01 a 11.
- **`pruebas/11_listados.sql`:**
  - Siembra de los inscritos.
  - `match_list`: partidas, orden de llave, última ronda, búsqueda y `player_ids` por un mix vinculado.
  - `event_list`.
  - Posiciones de `event_standings`.
  - Capitán y plantel en `team_members_view`.
  - Ranking empatado y después ordenado por una victoria.
  - Vistas de admin: vacías para un usuario común y completas para el admin.
  - Lectura anónima.
- **Backend:**
  - `pnpm typecheck` sin errores.
  - 191 pruebas unitarias (el helper con valores por defecto, conversión, rechazos, orden con varias columnas, desempate, paginación, errores y sobre).
  - 53 de integración: páginas, filtros, órdenes en los dos sentidos, `sort` inválido con `400`, chat con `before`, `after` y `has_more`, `ETag` en las partidas y tablas del torneo, y los sub-endpoints nuevos.
- **Cobertura:** 97,2 % de líneas.
- **Inventario de la OpenAPI** después del cambio: los 29 listados declaran `page`, `per`, `sort`, `order` y sus filtros (el chat, su cursor).

## En qué se apartó del plan

- **`at` en `match_list`:** la fecha jugada o, si no se jugó, la programada. Así `from` y `to` filtran igual partidas pendientes y jugadas.
- **`include_byes`** en `/events/{id}/matches`, para dibujar la llave completa con sus huecos. Por defecto los byes no vienen.
- **`include_inactive`** en `/maps`: el admin necesita ver los mapas desactivados para editarlos.
- **Ranking:** la respuesta cambia `points` por `points_per_win`, porque `points` también es un campo de cada fila.
- **Respuestas de un solo objeto:** `/me/pcw/post` y los detalles no se tocaron (no son listas).

## Incidentes durante las pruebas

- **Elementos fuera de la primera página.** Varias pruebas buscaban un elemento en la primera página de listados que acumulan datos de corridas anteriores. Ahora filtran (por nombre, `status` o `q`) para que el resultado sea exacto.

## Cómo revertir

- **En local:** aplicar `reversas/11_listados.sql`, que borra las vistas.
- **Backend:** revertir el commit de esta entrega.
- **En producción:** no aplica todavía.

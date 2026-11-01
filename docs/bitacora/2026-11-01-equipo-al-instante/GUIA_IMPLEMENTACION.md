# Crear un equipo al instante: guía de implementación

## Estado

- **Backend:** implementado y probado en local el 2026-11-01, con commit en `feat/backend-api-fase-1` (sin push).
- **Frontend:** en `feat/frontend-fase-1`, después del merge del backend (ver la sección Frontend).

Sin desplegar.

## Archivos (backend)

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/40_equipo_al_instante.sql` | Nuevo |
| `supabase/replanteo/README.md` | Fila de la `40` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/40_equipo_al_instante.sql` | Nueva: inversa (vuelve la aprobación; los equipos creados se quedan) |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/40_equipo_al_instante.sql` | Nuevas: 26 pruebas SQL, con rollback |
| `web/backend/src/routes/teams.ts` | `POST /api/v1/teams` y `eligible_modes` en el detalle |
| `web/backend/src/schemas/teams.ts` | `TeamCreateBody`, `EligibleMode`, `TeamDetail.eligible_modes`, `TeamConfig.max_led`; se borran `TeamRequestBody` y `TeamRequestForm` |
| `web/backend/src/routes/account.ts` | Se borran `PUT` y `DELETE /me/team-request` (queda el `GET`) |
| `web/backend/src/routes/admin-teams.ts`, `schemas/admin.ts` | Se borran las rutas y esquemas de solicitudes; la configuración suma `max_led` |
| `web/backend/src/services/photos.ts` | Comentario |
| `web/backend/src/db/types.ts` | Regenerado (`pnpm db:types`) |
| `web/backend/test/integration/players-teams.test.ts`, `notifications.test.ts`, `pendientes-frontend.test.ts`, `equipo-torneos.test.ts` | Crear al instante, `409` con `details.reason`, tope configurable, logo después de crear y rutas viejas en `404` |
| `web/backend/test/integration/mixes-perfil-ranking.test.ts`, `players-teams.test.ts` | Los equipos del ranking llevan 5 jugadores |
| `docs/frontend/contrato/` | `equipos.md`, `admin.md`, `api.md` y la novedad en `README.md` |

## Despliegue (pendiente)

1. Staging: cargar la `40` después de la `39` y redesplegar la API.
2. Corte a producción: la `40` va después de la `39`.
3. No toca el plugin: nada que subir al servidor real ni a flow.

## Pruebas (backend)

Contra la Supabase local, el 2026-11-01:

- SQL de la `40`: 26 de 26. La inversa se probó ida y vuelta (aplicar, revertir y volver a aplicar).
- `pnpm typecheck`: sin errores.
- `pnpm test`: 396 unitarias.
- `pnpm test:int`: 172 de integración.

En la base local, la `40` resolvió la única solicitud pendiente: quedó rechazada porque el usuario no tenía SteamID. El ranking de equipos pasó de 198 a 124 equipos.

## En qué se apartó del plan

- **Logo:** `POST /api/v1/teams` es solo JSON (`name`, `tag`). El logo se sube después con `PUT /api/v1/teams/{id}/logo`, que ya existía; así no se duplica la subida.
- **Respuesta:** `201 { id }` en lugar del `TeamDetail` completo. El frontend pide el detalle si lo necesita.
- **Códigos de error:** en lugar de `TEAM_LEAD_LIMIT` y `TEAM_NAME_TAKEN`, el `409 CONFLICT` de siempre con `details.reason` (`lead_limit`, `name_taken`, `tag_taken`). Es lo mismo que hace la `39` con `V3901`.
- **`eligible_modes`:** solo en `TeamDetail`. "Mi equipo" ya pide el detalle; `MyTeam` (el selector de equipos) no lo necesita.
- **Tope al pasar la capitanía:** el plan lo contaba solo al crear. Se sumó también al ceder la capitanía, para que no se pueda esquivar creando y cediendo.
- **Siglas en las pruebas:** las pruebas de integración usan siglas al azar, porque ahora son únicas entre los equipos activos y las corridas anteriores dejan equipos en la base local.

## Cómo revertir

1. Base: `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/40_equipo_al_instante.sql`.
2. Código: `git revert` del commit del backend y del frontend.

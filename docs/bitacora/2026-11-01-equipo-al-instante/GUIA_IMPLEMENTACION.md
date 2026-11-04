# Crear un equipo al instante: guía de implementación

## Estado

- **Backend:** implementado y probado en local el 2026-11-01, con commit en `feat/backend-api-fase-1` (sin push).
- **Frontend:** implementado y probado en local el 2026-11-01, con commit en `feat/frontend-fase-1` (sin push), después del merge del backend (`268ebbc8`).

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

## Archivos (frontend)

| Archivo | Cambio |
|---|---|
| `web/frontend/src/api/schema.d.ts` | Regenerado (`pnpm gen:api`; trae también lo de la gestión de torneos) |
| `web/frontend/src/features/teams/api/queries.ts` | `useCreateTeam` (`POST /teams` y, si hay logo, `PUT /teams/{id}/logo`) en lugar de `useRequestTeam` |
| `web/frontend/src/features/teams/pages/CreateTeam.tsx` | "Crear equipo" al instante; sin estado pendiente ni edición de la solicitud |
| `web/frontend/src/features/teams/pages/NoTeam.tsx` | Sin tarjeta de solicitud pendiente; una solicitud vieja rechazada se ve con su motivo |
| `web/frontend/src/routes/_app/myteam.tsx` | Sin `?edit`; al crear, abre el equipo nuevo |
| `web/frontend/src/features/teams/lib/model.ts` (+ prueba) | `eligibility`: los modos aptos juntos y cuántos faltan para el más cercano |
| `web/frontend/src/features/teams/components/Recruit.tsx`, `pages/TeamView.tsx` | `EligibleTags` en la cabecera del equipo ("Apto para 1v1 · 2v2", "Faltan 3 para 5v5") |
| `web/frontend/src/features/admin/teams/`, `routes/_app/admin.teams.tsx` | Administración › Equipos: máximo de miembros y equipos por líder |
| `web/frontend/src/features/shell/` (`queries.ts`, `nav.ts`, `AppSidebar.tsx`) | Se quita el contador de solicitudes pendientes del menú |
| `web/frontend/e2e/team.spec.ts` | Crear al instante, solicitud vieja rechazada y la vista pública con un equipo con lugar (`has_space=true`) |

## Despliegue (pendiente)

1. Staging: la `40` **cargada en staging el 2026-11-01** (con la 39 a la 44; las pruebas SQL de la 40 a la 44 pasaron allá también). La API del VPS se redesplegó el mismo día (`714ec78ae865`).
2. Corte a producción: la `40` va después de la `39`.
3. No toca el plugin: nada que subir al servidor real ni a flow.

## Pruebas (backend)

Contra la Supabase local, el 2026-11-01:

- SQL de la `40`: 26 de 26. La inversa se probó ida y vuelta (aplicar, revertir y volver a aplicar).
- `pnpm typecheck`: sin errores.
- `pnpm test`: 396 unitarias.
- `pnpm test:int`: 172 de integración.

En la base local, la `40` resolvió la única solicitud pendiente: quedó rechazada porque el usuario no tenía SteamID. El ranking de equipos pasó de 198 a 124 equipos.

## Pruebas (frontend)

- `pnpm exec tsc -b` y `pnpm lint`: sin errores.
- `pnpm test`: 401 unitarias (dos nuevas de `eligibility`).
- `pnpm exec playwright test e2e/team.spec.ts`: 11 de 11.

## En qué se apartó del plan

- **Logo:** `POST /api/v1/teams` es solo JSON (`name`, `tag`). El logo se sube después con `PUT /api/v1/teams/{id}/logo`, que ya existía; así no se duplica la subida.
- **Respuesta:** `201 { id }` en lugar del `TeamDetail` completo. El frontend pide el detalle si lo necesita.
- **Códigos de error:** en lugar de `TEAM_LEAD_LIMIT` y `TEAM_NAME_TAKEN`, el `409 CONFLICT` de siempre con `details.reason` (`lead_limit`, `name_taken`, `tag_taken`). Es lo mismo que hace la `39` con `V3901`.
- **`eligible_modes`:** solo en `TeamDetail`. "Mi equipo" ya pide el detalle; `MyTeam` (el selector de equipos) no lo necesita.
- **Tope al pasar la capitanía:** el plan lo contaba solo al crear. Se sumó también al ceder la capitanía, para que no se pueda esquivar creando y cediendo.
- **Lectura defensiva:** la cabecera del equipo toma `eligible_modes ?? []`. Con la API de producción (sin la `40`) el campo no llega, y sin eso la página no abría (lo mostraron las e2e con el equipo simulado).
- **E2E de la vista pública:** elegía el equipo con más miembros, que en la base local es uno lleno (10 de 10) y por eso no mostraba "Pedir entrar". Ahora elige uno con lugar.
- **Siglas en las pruebas:** las pruebas de integración usan siglas al azar, porque ahora son únicas entre los equipos activos y las corridas anteriores dejan equipos en la base local.

## Cómo revertir

1. Base: `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/40_equipo_al_instante.sql`.
2. Código: `git revert` del commit del backend y del frontend.

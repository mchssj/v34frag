# Equipo y Torneos en la API: guía de implementación

## Estado

Implementado y probado en la Supabase local el 2026-10-28, commiteado en `feat/backend-api-fase-1` (sin push):
- 45 pruebas SQL del `33` (con su inversa).
- 353 pruebas unitarias.
- 150 pruebas de integración.

No está en staging ni en producción.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/33_equipo_torneos.sql` | Nuevo. Toda la parte de la base |
| `supabase/replanteo/README.md` | Fila del `33` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/33_equipo_torneos.sql` | Nuevo. Inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/33_equipo_torneos.sql` | Nuevo. 45 pruebas SQL |
| `web/backend/src/db/types.ts` | Regenerado (`pnpm db:types`) |
| `web/backend/src/lib/errors.ts` | `NOT_A_MEMBER`, `ROSTER_FULL`, `COACH_NOT_ALLOWED`, `REGISTRATION_CLOSED` y `PLAYER_NOT_LINKED`, traducidos de `V3401` a `V3405` |
| `web/backend/src/lib/uploads.ts` | `LOGO_MAX_BYTES`, `BANNER_MAX_BYTES`, `imageSize`, `checkShape`, `LOGO_SHAPE` y `BANNER_SHAPE` |
| `web/backend/src/services/photos.ts` | Nuevo. `savePhoto`, `dropPhoto` y `removePhoto` |
| `web/backend/src/services/matches.ts` | Logo en los lados de una partida |
| `web/backend/src/schemas/players.ts` | `TeamRef.logo_url` |
| `web/backend/src/schemas/teams.ts` | Campos nuevos y `RosterRole`, `JoinRequestBody`, `MemberRoleBody`, `TeamPatch`, `LogoUpload`, `LogoResult`, `TeamEvent`, `MyTeam`, `TeamConfig` y `TeamRequestForm`. Se borra `MAX_ROSTER` |
| `web/backend/src/schemas/events.ts` | Campos nuevos, `LiveMatch`, `BannerUpload`, `BannerResult`, `GameMode` y `GameModeBody`. `RegistrationBody` pasa a `{ active, subs }` |
| `web/backend/src/routes/teams.ts` | `PATCH /teams/{id}`, logo, `GET /teams/{id}/events`, `GET /me/teams` y campos nuevos |
| `web/backend/src/routes/roster.ts` | `PATCH /teams/{id}/members/{playerId}`; invitaciones con `role`, `message`, `invited_by`, `elo` y `level` |
| `web/backend/src/routes/account.ts` | `PUT /me/team-request` con `multipart` y logo |
| `web/backend/src/routes/admin-teams.ts` | `GET`/`PUT /admin/teams/config` |
| `web/backend/src/routes/events.ts` | Campos nuevos, `live_match`, inscripción `{ active, subs }`, banner y modos de juego |
| `web/backend/test/integration/equipo-torneos.test.ts` | Nuevo. 10 casos |
| `web/backend/test/unit/uploads.test.ts` | Nuevo |
| `web/backend/test/unit/errors.test.ts` | Códigos nuevos |
| `web/backend/test/integration/tournaments.test.ts`, `groups-double.test.ts`, `mixes-perfil-ranking.test.ts`, `players-teams.test.ts` | Inscripción `{ active }`, sin `players_min`/`players_max`, y `logo_url` en la solicitud |
| `contrato-frontend-equipo-torneos.md` | Nuevo. Contrato para el frontend |
| `docs/frontend/contrato/` | Novedades, equipos, torneos, notificaciones y decisiones |

## Despliegue (pendiente)

1. **Staging:** cargar los replanteos `31`, `32` y `33` en la Supabase de staging (hoy tiene del `01` al `30`, según la sesión del despliegue al VPS), y redesplegar la API del VPS con este backend. El frontend de staging tiene que pasar a la inscripción `{ active, subs }` antes del ensayo.
2. **Producción:** con el corte, como el resto del replanteo.

No toca el plugin ni la configuración de los servidores de juego, así que no hay despliegue al servidor real, a RBK ni a flow. `csstv_match_lookup` le sigue mandando `min_roster` al plugin, ahora con los activos del modo.

## Pruebas

### Base (Supabase local)

- `pruebas/33_equipo_torneos.sql`: 45 casos, todos en verde.
  - Máximo configurable y `V3402`.
  - Estado y mensaje en invitaciones y pedidos.
  - `team_set_member_role` (permisos, `V3401` y un solo aviso).
  - `looking_for` y el logo.
  - Modos.
  - Inscripción (activos, suplentes, coach `V3403`, SteamID `V3405` con los alias, solo los cambios y avisos).
  - Formato que deja afuera a un inscrito.
  - Cierre `V3404`, historial y categoría del aviso.
- Ciclo completo del `33` (base hasta el `32`, aplicar, probar, que no se aplique dos veces, inversa con la estructura idéntica y volver a aplicar): en verde. Se corrió con un script aparte porque `pruebas/correr.sh` se corta antes de llegar (ver Incidentes).

### API

- `pnpm typecheck`: sin errores.
- `pnpm test`: 353 pruebas unitarias en verde (`imageSize` con PNG, JPG y los tres WebP; `checkShape`; los códigos `V3401` a `V3405`).
- `pnpm test:int`: 150 pruebas de integración en verde. `equipo-torneos.test.ts` cubre:
  - Invitaciones con estado, mensaje e `invited_by`, y el pedido con y sin cuerpo.
  - Cambio de estado (200, 404 y 403).
  - Máximo de miembros y `409 ROSTER_FULL`.
  - `looking_for` y su filtro.
  - Logo (medidas inválidas, capitán, ajeno 403, quitar) y `GET /me/teams`.
  - Solicitud `multipart` con logo que pasa al equipo al aprobarla.
  - Modos (público, admin y crear con uno deshabilitado).
  - Inscripción con suplente, coach, sin SteamID, avisos, campos del detalle y cierre.
  - Historial.
  - Banner.

## En qué se apartó del plan

- **URL en lugar de ruta:** el logo y el banner se guardan como URL pública (`teams.logo_url`, `team_requests.logo_url`, `events.banner_url`) y no como `logo_path`/`banner_path`. Es lo mismo que ya hacían `avatar_url` y la foto de los mapas, y deja que las vistas devuelvan la URL sin armarla en la API. Tampoco hace falta `?v=`: cada subida usa un nombre nuevo.
- **El logo de la solicitud no se mueve:** al aprobarla, el equipo usa la misma URL de `team-requests/<user>/`.
- **`founded_at` de los equipos anteriores:** se llenó con el ingreso más antiguo del plantel, porque `teams` no tiene `created_at`.
- **`team_ref` y la tabla de posiciones:** `logo_url` llega a `team_ref`, al listado, al ranking, a las inscripciones, al campeón, a las partidas y a las invitaciones. La tabla de grupos y del suizo (`/standings`) y los equipos de la ficha de un jugador no lo traen todavía; en `TeamRef` el campo es opcional.
- **Código propio para el coach:** el plan no lo nombraba en un principio. Se sumó `COACH_NOT_ALLOWED` cuando Daniel decidió que el coach no se inscribe.
- **Nombre de la función del historial:** `team_event_history` (el plan decía `team_events`).

## Incidentes durante las pruebas

- **CRLF en el checkout:** en `v34frag-backend` (`core.autocrlf=true`) muchos `.sql` estaban con CRLF en la copia de trabajo, y el replanteo `04` fallaba al cargar (`pnpm db:reset` incluido) porque busca textos con `\n`.
  - Se pasaron a LF los archivos de `supabase/`, `docs/bitacora/2026-10-14-replanteo-modelo-datos/` y `web/backend/scripts/`. En Git no cambia nada: `git diff --numstat` da 0.
  - Los archivos nuevos también se dejaron en LF (Python y el editor los escribían con CRLF).
- **`correr.sh` se corta en el `23`:** la prueba `por STEAM_0 del adicional…` de `pruebas/23_whois.sql` falla por su cuenta, sin relación con este cambio. Queda anotado en `PENDIENTES.md`.
- **Base compartida:** otra sesión hizo un `db:reset` desde una copia sin el `33` en medio de las pruebas. Se coordinó con ella, y las pruebas finales corrieron con la base recién cargada desde este worktree.
- **Política de Storage:** en la primera versión, dentro de la subconsulta sobre `teams`/`events`, `name` se resolvía como el nombre del equipo o del torneo. Se calificó como `objects.name`.
- **Validación de la solicitud:** con dos tipos de contenido y `required: true`, Hono validaba el JSON también como formulario. Se pasó a `required: false` y se controla a mano que lleguen `name` y `tag`.

## Cómo revertir

1. Base: correr `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/33_equipo_torneos.sql`. Pierde los logos, banners, `looking_for`, `founded_at`, los modos y los avisos `event_lineup`, y vuelve a crear `players_min` y `players_max` (5 y 5 + `subs_max`).
2. Borrar `supabase/replanteo/33_equipo_torneos.sql` y su fila del README.
3. API: revertir el commit (o descartar los cambios de `web/backend`) y regenerar `src/db/types.ts`.

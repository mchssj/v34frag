# Contrato para el frontend: Equipo y Torneos

Fecha: 2026-10-28. De: backend (rama `feat/backend-api-fase-1`). Para: frontend (rama `feat/frontend-fase-1`).

Es la respuesta a [`contrato-backend-equipo-torneos.md`](contrato-backend-equipo-torneos.md) (pedidos E1 a E8 y T1 a T4). Anota qué se decidió, en qué se aparta de lo que se pidió y qué endpoints usar. La bitácora completa está en [`docs/bitacora/2026-10-28-equipo-torneos-api/`](docs/bitacora/2026-10-28-equipo-torneos-api/).

**Estado: disponible en la Supabase local** (replanteo `33`). Como el resto de la API nueva, llega a producción con el corte. Si este documento y la OpenAPI (`GET /api/openapi.json`) no coinciden en un detalle, manda la OpenAPI.

## Resumen

| # | Pedido | Respuesta | Cambia respecto del pedido |
|---|---|---|---|
| E1 | Estado editable por el líder | `PATCH /teams/{id}/members/{playerId}`; `role` al invitar | **Sin topes por estado** en el equipo (ni 5 activos ni 1 coach). Solo hay un máximo de miembros |
| E2 | Roles de equipo | `game_role` de cada miembro en el roster | **No hay `GET`/`PUT /roles`**. Son los puestos del perfil del jugador y se pueden repetir |
| E3 | Logo del equipo | `PUT`/`DELETE /teams/{id}/logo`; logo en la solicitud | **El frontend recorta**. Los errores de tipo son `INVALID_FILE` (400), no `FILE_BAD_TYPE` (415) |
| E4 | `looking_for` | En el listado y el detalle, filtro `?looking_for=` y `PATCH /teams/{id}` | Igual a lo pedido |
| E5 | Historial de torneos | `GET /teams/{id}/events` y `record.events_played` | Igual a lo pedido |
| E6 | `founded_at` | En `TeamDetail` | Igual a lo pedido |
| E7 | `GET /me/teams` | Con `my_role` | Igual a lo pedido |
| E8 | Más datos en invitaciones | `invited_by`, `message`, `role`, y `elo` y `level` del jugador | Igual a lo pedido |
| T1 | BO y etapa en el listado | `bo`, `bo_final`, `current_stage` y `progress` en `EventSummary` | Igual a lo pedido |
| T2 | Banner | `banner_url`; `PUT`/`DELETE /events/{id}/banner` | **El frontend recorta**. Mismos errores que el logo |
| T3 | Cierre de inscripciones | `registration_closes_at` y `409 REGISTRATION_CLOSED` | Igual a lo pedido |
| T4 | Partida en vivo con el mapa | `live_match` en `EventDetail` | Igual a lo pedido |
| — | **Modos de juego e inscripción (rompe)** | `game_mode`, `subs_max` y la inscripción con `{ active, subs }` | Nuevo: decisión de Daniel (ver abajo) |

## Decisiones tomadas

| Tema | Decisión | Quién |
|---|---|---|
| Tamaño del plantel | Un equipo oficial tiene hasta **10 miembros por defecto**, y el admin cambia ese máximo (de 2 a 30). No hay topes por estado: el capitán reparte activos, suplentes y coach como quiera | Daniel, 2026-10-28 |
| Tope de 5 activos | Es **de los torneos**, no del equipo: cada torneo inscribe los activos de su modo de juego | Daniel, 2026-10-28 |
| Modos de juego | Catálogo `1v1`, `2v2`, `3v3` y `5v5`, que el admin habilita o deshabilita. Cada torneo elige uno (`5v5` por defecto) y sus activos son los jugadores por equipo del modo | Daniel, 2026-10-28 |
| Suplentes en torneos | Los fija el organizador de cada torneo, **de 0 a 4**, sin importar el modo | Daniel, 2026-10-28 |
| Quién es activo | El capitán elige libremente entre los miembros del roster. Un `sub` del equipo puede ser activo en un torneo | Daniel, 2026-10-28 |
| Coach | **Nunca se inscribe**, ni como activo ni como suplente. Si el organizador lo deja jugar en una partida porque falta uno, lo decide fuera de la plataforma | Daniel, 2026-10-28 |
| Roles de juego | IGL, AWPer, etc. son el puesto que cada jugador eligió en **su perfil** (`game_role`). Pueden repetirse en un equipo: cómo se reparten lo decide el capitán | Daniel, 2026-10-28 |
| Imágenes | El frontend recorta (logo cuadrado, banner 4:1). La API valida tipo, peso y medidas, y guarda una sola versión | Daniel, 2026-10-28 |
| Pedido para entrar | Entra como `player`; el capitán le cambia el estado después | Daniel, 2026-10-28 |
| Mensaje | Opcional en invitaciones y pedidos, hasta 200 caracteres | Daniel, 2026-10-28 |
| Aviso a los inscritos | Cada jugador recibe `event_lineup` cuando lo inscriben, lo cambian de activo a suplente (o al revés) o lo sacan | Daniel, 2026-10-28 |

## Errores nuevos

Todos con el formato de siempre: `{ error: { code, message, details? } }`. El `message` está en español y se puede mostrar tal cual.

| `code` | HTTP | Cuándo |
|---|---|---|
| `ROSTER_FULL` | 409 | Invitar, pedir entrar o aceptar con el equipo lleno (el máximo lo fija el admin) |
| `NOT_A_MEMBER` | 404 | Cambiar el estado de alguien que no está en el plantel |
| `COACH_NOT_ALLOWED` | 400 | Inscribir al coach del equipo como activo o suplente |
| `REGISTRATION_CLOSED` | 409 | Inscribir, cambiar o dar de baja después de `registration_closes_at` (el capitán; el organizador y el admin sí pueden) |
| `PLAYER_NOT_LINKED` | 400 | Inscribir jugadores sin SteamID. `details.aliases` trae **todos** los que fallan |
| `INVALID_FILE` | 400 | Imagen que no es JPG, PNG ni WebP, o con medidas o proporción fuera de lo permitido (el `message` dice cuál) |
| `FILE_TOO_LARGE` | 413 | Logo de más de 2 MB o banner de más de 4 MB |

Las demás reglas de la inscripción (activos que no son los del modo, demasiados suplentes, repetidos, alguien que no es del plantel o que está inscrito con otro equipo) siguen saliendo como `400 BUSINESS_RULE`, con el mensaje.

## Equipo

### Esquemas que cambian

- **`TeamRef`** suma `logo_url: string | null`. Viene en el listado y el detalle de equipos, el ranking de equipos, las inscripciones y el campeón de un torneo, los lados de una partida (`MatchSummary.side1.team`) y las invitaciones. En otros lugares puede faltar: tratarlo como `null`.
- **`TeamSummary`** (listado y detalle) suma:
  - `logo_url: string | null`.
  - `looking_for: ("player" | "sub" | "coach")[]`. Sale vacío si el equipo no busca nada **o si el plantel está lleno**.
  - `max_members` deja de ser fijo: es el máximo que configuró el admin (`null` en los bandos de PCW).
  - `members` cuenta todos los miembros actuales: activos, suplentes y coach.
- **`TeamDetail`** suma `founded_at: string | null` (fecha de aprobación; en los equipos anteriores, el ingreso más antiguo) y `record.events_played` (torneos en curso o terminados).
- **`RosterEntry`** suma `game_role: string | null`: `AWPer`, `Rifler`, `IGL`, `Support`, `Entry fragger`, `Lurker` u `Otro`. Es `null` si el jugador no eligió puesto o si su perfil es privado.
- **`Invite`** suma:
  - `role` (con qué estado entra) y `message`.
  - `invited_by: { player_id, alias } | null` (siempre `null` en los pedidos).
  - `player.elo` y `player.level`.

### Endpoints

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /api/v1/teams?looking_for=player,sub` | Público | Equipos que buscan alguno de esos puestos. `has_space` usa el máximo configurado |
| `GET /api/v1/teams/{id}` | Público | Con `logo_url`, `looking_for`, `founded_at` y `record.events_played` |
| `GET /api/v1/teams/{id}/members` | Público | Con `game_role` en cada miembro |
| `PATCH /api/v1/teams/{id}` | Capitán o admin | `{ "looking_for": ["sub", "coach"] }` → `204`. `[]` = no busca |
| `PATCH /api/v1/teams/{id}/members/{playerId}` | Capitán o admin | `{ "role": "player" \| "sub" \| "coach" }` → `200` con el `RosterEntry`. Al jugador le llega `team_role_changed` |
| `PUT /api/v1/teams/{id}/logo` | Capitán o admin | `multipart/form-data`, campo `file` → `200 { logo_url }`. Reemplaza al anterior |
| `DELETE /api/v1/teams/{id}/logo` | Capitán o admin | `204`. El escudo vuelve a la sigla |
| `GET /api/v1/teams/{id}/events` | Público | Historial de torneos, paginado (ver abajo) |
| `GET /api/v1/me/teams` | Usuario | `[{ id, name, tag, logo_url, my_role }]`. `my_role` es `leader` si es el capitán; si no, su estado |
| `POST /api/v1/teams/{id}/invites` | Capitán o admin | Suma `role` (por defecto `player`) y `message` opcional al cuerpo |
| `POST /api/v1/teams/{id}/join-requests` | Usuario | Cuerpo **opcional** `{ "message": "…" }` |
| `GET /api/v1/me/team-invites`, `GET /api/v1/teams/{id}/pending` | — | `Invite` con los campos nuevos |
| `PUT /api/v1/me/team-request` | Usuario | Sigue aceptando JSON `{ name, tag }`. Con `multipart/form-data` suma `logo` opcional. Sin `logo` se conserva el que tenía. Responde `logo_url`, y al aprobarse el logo pasa al equipo |
| `GET /api/v1/me/team-request` | Usuario | Suma `logo_url` |
| `GET`/`PUT /api/v1/admin/teams/config` | Admin | `{ "max_members": 10 }`, de 2 a 30 |

### Historial de torneos

`GET /api/v1/teams/{id}/events` devuelve `{ items, total, page, per, sort, order }`, del más reciente al más viejo (`order=asc` lo invierte). No incluye los torneos cancelados.

```json
{
  "event": { "id": "…", "name": "Copa Invierno", "template": "groups", "status": "finished", "starts_on": "2025-07-05", "ends_on": "2025-08-02" },
  "result": "champion",
  "place": 1,
  "played": 6, "won": 5, "lost": 1
}
```

| `result` | Cuándo | `place` |
|---|---|---|
| `registered` | El torneo está en inscripciones | `null` |
| `in_progress` | En curso y el equipo sigue en carrera | `null` |
| `champion` | Ganó el torneo | 1 |
| `runner_up` | Perdió la final o la gran final | 2 |
| `semifinal` | Perdió una semifinal, el 3.er puesto o la final del lower | 3 (4 si perdió el 3.er puesto) |
| `quarterfinal` | Perdió en cuartos | 5 |
| `groups` | No pasó de grupos o del suizo | `null` |
| `eliminated` | Cualquier otra eliminación | `null` |

`total` cuenta también los torneos en inscripciones. Para el KPI "Torneos jugados" conviene `record.events_played` del detalle, que cuenta solo los torneos en curso o terminados.

### Imágenes

| | Logo | Banner |
|---|---|---|
| Tipos | JPG, PNG o WebP (se detecta por el contenido) | Igual |
| Peso | Hasta 2 MB | Hasta 4 MB |
| Forma | Cuadrado (tolerancia del 2 %) | 4:1 (tolerancia del 5 %) |
| Medidas | De 128×128 a 1024×1024 | De 800×200 a 2400×600 |
| Campo | `file` (`logo` en la solicitud de equipo) | `file` |

**El frontend recorta antes de subir.** Sugerencia: el logo a 512×512 y el banner a 1600×400. Cada subida genera una URL nueva, así que no hay problemas de caché.

## Torneos

### Modos de juego e inscripción (rompe)

- **`players_min` y `players_max` ya no existen**, ni en `EventDetail` ni en `POST`/`PATCH /events`.
- Cada torneo tiene:
  - `game_mode`: `5v5` por defecto.
  - `players_per_team`: los activos que inscribe cada equipo, que salen del modo.
  - `subs_max`: de 0 a 4, 0 por defecto.
- El cuerpo de **`PUT /api/v1/events/{id}/registrations/{teamId}`** cambia a:

  ```json
  { "active": ["<player_id>", "…"], "subs": ["<player_id>"], "start_stage": 1 }
  ```

  - `active`: exactamente `players_per_team` jugadores.
  - `subs`: entre 0 y `subs_max` (opcional, `[]` por defecto).
  - Todos tienen que ser miembros del plantel con SteamID, y ninguno puede ser el coach.
  - Volver a enviarlo reemplaza a los inscritos. Solo cambia lo que cambió, así que los avisos son los reales.
- **`GET /api/v1/events/{id}/registrations`**: cada jugador suma `role` (`active` o `sub`); primero vienen los activos. `team` trae `logo_url`.
- El organizador **no puede cambiar el modo ni bajar `subs_max`** si eso deja afuera a un equipo ya inscrito (`400`). Ese equipo tiene que corregir su inscripción antes.

### Esquemas que cambian

**`EventSummary`** (listado y detalle) suma:

| Campo | Tipo | Nota |
|---|---|---|
| `game_mode` | `string` | `5v5`, `2v2`… |
| `players_per_team` | `int` | Activos por equipo |
| `subs_max` | `int` | 0 a 4 |
| `bo` | `1 \| 3 \| 5 \| null` | BO de las partidas comunes (`bo` o `bo_group`) |
| `bo_final` | `1 \| 3 \| 5 \| null` | BO de la final (`bo_final`, `bo_grand_final` o `playoffs.bo_final`) |
| `current_stage` | `string \| null` | Fase de la partida en vivo o de la próxima ("Semifinal", "Grupo A · fecha 2"); `null` si no está en curso |
| `progress` | `{ played, total } \| null` | Partidas terminadas y armadas (sin libres); `null` antes del fixture. `total` crece a medida que se arman las rondas siguientes |
| `banner_url` | `string \| null` | `null`: patrón rayado |
| `registration_closes_at` | `string \| null` | `null`: se puede cancelar hasta que se arma el fixture |

**`EventDetail`** suma `live_match` y pierde `players_min` y `players_max`:

```json
"live_match": { "id": "…", "label": "Semifinal", "map": "de_dust2", "map_index": 2, "maps_total": 3 }
```

`live_match` es `null` si no hay partidas en vivo. `map` puede ser `null` mientras no se sepa el mapa, y `map_index` es la cantidad de mapas ya jugados de la serie más 1.

### Endpoints

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /api/v1/events?game_mode=5v5` | Público | Con los campos nuevos. **Ya no hace falta pedir el detalle ni las partidas por tarjeta** |
| `GET /api/v1/events/{id}` | Público | Con `live_match` |
| `POST`/`PATCH /api/v1/events` | Organizador o admin | Aceptan `game_mode` (uno habilitado), `subs_max` y `registration_closes_at` (fecha y hora ISO, o `null`) |
| `PUT /api/v1/events/{id}/registrations/{teamId}` | Capitán, organizador o admin | `{ active, subs, start_stage? }` |
| `DELETE /api/v1/events/{id}/registrations/{teamId}` | Capitán, organizador o admin | Pasado el cierre, el capitán recibe `409 REGISTRATION_CLOSED` |
| `PUT /api/v1/events/{id}/banner` | Organizador o admin | `multipart/form-data`, campo `file` → `200 { banner_url }` |
| `DELETE /api/v1/events/{id}/banner` | Organizador o admin | `204` |
| `GET /api/v1/game-modes` | Público | Los modos habilitados: `[{ code, name, players_per_team, active }]` |
| `GET /api/v1/admin/game-modes` | Admin | Todos los modos |
| `PUT /api/v1/admin/game-modes` | Admin | `{ "code": "1v1", "active": false }` → la lista. Tiene que quedar uno habilitado, y un torneo que ya usa el modo lo conserva |

## Notificaciones

| Tipo | Categoría | A quién | `data` |
|---|---|---|---|
| `event_lineup` (nuevo) | `tournament` | Cada jugador inscrito (no al capitán, que ya recibe `event_registration`) | `{ event, team, registered, role }`. `registered: false` = lo sacaron (`role: null`). `role` es `active` o `sub` |
| `team_role_changed` (ya existía) | `team` | El jugador al que le cambian el estado | `{ team, role }` |

En los avisos, `team` (la salida de `team_ref`) trae también `logo_url`.

## Para confirmar (respuesta)

- **Notificaciones de inscripción:** hoy solo avisaban al capitán. Desde esta entrega, cada inscrito recibe `event_lineup`.
- **Inscripción sin SteamID:** el código es `PLAYER_NOT_LINKED` (400), con los alias en `details.aliases`.

## Qué tiene que cambiar el frontend

| Dónde | Cambio |
|---|---|
| Inscripción a un torneo (**rompe**) | Mandar `{ active, subs }` en lugar de `{ players }`. Separar activos (exactamente `players_per_team`) y suplentes (hasta `subs_max`), y no ofrecer al coach |
| Crear y editar torneo (**rompe**) | Sacar `players_min` y `players_max`. Sumar el modo (de `GET /game-modes`), los suplentes (0 a 4) y el cierre de inscripciones |
| Tarjeta "Roles de equipo" | Armarla con el `game_role` de cada miembro. Puede haber varios con el mismo puesto, y también `Rifler` y `Otro`. No hay que editar nada: cada jugador lo cambia en su perfil |
| Menú ⋯ del roster | `PATCH /teams/{id}/members/{playerId}` sin topes por estado |
| Logo y banner | Recortar en el cliente y subir como `multipart`; mostrar el `message` de `INVALID_FILE` |
| Topes del plantel | Leer `max_members` del equipo, no un 10 fijo |

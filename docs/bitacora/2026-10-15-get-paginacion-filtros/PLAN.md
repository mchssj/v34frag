# Plan: paginación, filtros y orden en el servidor para todos los GET

> Planeación original. Estado: **aprobado** por Daniel el 2026-10-15.

**Requisito obligatorio** que pidió Daniel el 2026-10-15: **toda consulta `GET` que devuelva una lista tiene que tener paginación, filtros y orden resueltos en el servidor.** El navegador no pagina, no filtra y no ordena nada.

No se definió al principio, así que las dos entregas de dominio (jugadores y equipos; partidas, torneos y PCW) tienen listas que no lo cumplen. Este plan:
- Define una convención única.
- Revisa los 31 `GET` de la API.
- Dice qué cambia en cada uno.

## Estado actual

| Tipo | Cuántos | Endpoints |
|---|---|---|
| Un solo objeto (no son listas) | 11 | `/api/health`, `/auth/me`, `/me/profile`, `/pcw/formats`, `/aliases/{alias}/available`, `/me/team-request`, `/admin/ranking/config`, y los detalles `/players/{id}`, `/teams/{id}`, `/matches/{id}`, `/events/{id}` |
| Listas con paginación parcial | 5 | `/players` (tiene orden por ELO o alias), `/players/{id}/matches`, `/teams`, `/matches`, `/events`: sin orden elegible (salvo `/players`) y con pocos filtros |
| Listas sin paginación | 15 | `/ranking/teams`, `/me/team-invites`, `/teams/{id}/pending`, `/matches/{id}/chat`, `/pcw/posts`, `/me/pcw`, `/maps`, `/servers`, `/me/profile-requests`, y en admin `/steam/unlinked`, `/users`, `/blocked-words`, `/blocked-words/hits`, `/profile-requests`, `/team-requests` |
| Listas dentro de un detalle | — | Ficha del jugador: stats por mapa, medallas, historial. Equipo: plantel, ex integrantes, últimas partidas. Torneo: inscritos, grupos, suizo, todas las partidas. Partida: jugadores, mapas jugados, veto |

## Decisiones

| Tema | Decisión | Origen |
|---|---|---|
| Alcance | Todo `GET` que devuelva una lista | Daniel |
| Dónde | En el servidor: PostgREST (`range`, `order` y filtros) sobre tablas o vistas. Lo que hoy se calcula en el backend (ranking, tablas de grupos y del suizo) pasa a vistas con su orden y su posición, para que la base pagine | Propuesta |
| Paginación | `page` (desde 1) y `per` (de 1 a 100; por defecto 20) | Ya vigente |
| Orden | `sort=<campo>` y `order=asc\|desc`, con una lista cerrada de campos por endpoint y un orden por defecto. Un campo que no está en la lista da `400 VALIDATION_ERROR`. Siempre se suma un desempate estable (el id) para que las páginas no se mezclen | Propuesta |
| Filtros | `q` (texto libre, sin distinguir mayúsculas ni tildes) donde tenga sentido, más filtros propios de cada endpoint (tabla de abajo). Fechas con `from` y `to` (ISO 8601) | Propuesta |
| Respuesta | Siempre `{ items, total, page, per, sort, order }` | Propuesta (amplía la actual) |
| Listas dentro de un detalle | El detalle trae solo lo fijo y acotado; las listas que crecen pasan a sub-endpoints paginados (pregunta 1) | Daniel |
| Chat | Paginación por cursor (`before`, `after`, `limit`) | Daniel |
| Listas chicas y fijas (mapas, servidores) | El mismo formato que el resto | Daniel |

### Preguntas (propuesta entre paréntesis)

1. **Listas dentro de un detalle.** (Cada detalle devuelve solo sus datos y lo que es parte fija y acotada de la entidad: el veto, los mapas de una serie, que son 5 como máximo, los jugadores de un mix y los rosters de una partida. Las listas que pueden crecer pasan a sub-endpoints paginados: medallas, stats por mapa e historial del jugador; plantel y ex integrantes del equipo; inscritos, partidas y tablas del torneo.)
2. **Chat.** (Paginación por cursor y no por página: `before` y `after` con el id del mensaje, más `limit`. Es lo que sirve para un chat en vivo, donde los mensajes nuevos correrían las páginas.)
3. **Listas chicas y fijas** (pool de mapas, hasta 20; servidores). (Mismo formato que el resto, con `page`, `per`, `sort` y filtros, para que el frontend use un único componente de lista.)

## Convención

```http
GET /api/v1/players?page=2&per=20&sort=rating&order=desc&q=mecha&team=<id>&has_steam=true
```

```json
{ "items": [ ... ], "total": 134, "page": 2, "per": 20, "sort": "rating", "order": "desc" }
```

- `total` es el total con los filtros aplicados.
- Los booleanos van como `true` o `false`.
- Los ids van como uuid.
- Los valores de enum se validan.

## Endpoint por endpoint

Orden por defecto en **negrita**.

### Públicos

| Endpoint | Filtros | Orden |
|---|---|---|
| `GET /players` | `q` (alias y equipos), `team`, `has_account`, `has_steam`, `elo_min`, `elo_max` | **`elo` desc**, `alias`, `elo_matches`, `rating`, `kd`, `wins` |
| `GET /players/{id}/matches` | `kind`, `result` (`won`, `lost` o `draw`), `map`, `from`, `to` | **`played_at` desc**, `rating`, `kills`, `elo_delta` |
| `GET /players/{id}/map-stats` (nuevo, sale de la ficha) | `map` | **`maps` desc**, `rating`, `kd`, `adr`, `wins` |
| `GET /players/{id}/medals` (nuevo, sale de la ficha) | — | **`created_at` desc**, `title` |
| `GET /players/{id}/teams` (nuevo: historial) | `active` (`true` o `false`) | **`joined_at` desc**, `left_at`, `name` |
| `GET /teams` | `q`, `kind`, `has_space` (menos de 10) | **`name` asc**, `members` |
| `GET /teams/{id}/members` (nuevo: plantel y ex integrantes) | `active`, `role` | **`alias` asc**, `joined_at`, `left_at`, `elo` |
| `GET /ranking/teams` | `pcw`, `q` | **`points` desc**, `won`, `played`, `name` |
| `GET /matches` | `kind`, `status`, `event`, `team`, `player`, `map`, `from`, `to`, `q` (equipos y bandos) | **`played_at` desc**, `starts_at` |
| `GET /matches/{id}/chat` | Cursor (pregunta 2) | Por id |
| `GET /events` | `q`, `status`, `template`, `organizer`, `from`, `to` | **`starts_on` desc**, `name`, `status` |
| `GET /events/{id}/registrations` (nuevo) | `q`, `start_stage` | **`seed` asc**, `name` |
| `GET /events/{id}/matches` (nuevo) | `stage`, `phase`, `grp`, `round`, `status`, `team` | **llave** (fase, etapa, grupo, ronda, posición), `starts_at`, `played_at` |
| `GET /events/{id}/standings` (nuevo: grupos y suizo) | `stage` (`group` o `swiss`), `grp`, `phase` | **`place` asc** (con los desempates de la base) |
| `GET /pcw/posts` | `best_of`, `q` (bando y equipo), `from`, `to` | **`created_at` desc**, `starts_at` |
| `GET /maps` | `q` | **`position` asc**, `name` |

En `/events/{id}/matches`, para dibujar una llave completa en una sola consulta, el máximo de `per` sube a 200.

### Con sesión

| Endpoint | Filtros | Orden |
|---|---|---|
| `GET /me/team-invites` | `kind` (`invite` o `request`), `team` | **`created_at` desc**, `expires_at` |
| `GET /teams/{id}/pending` | `kind` | **`created_at` desc**, `expires_at` |
| `GET /me/pcw/matches` (reemplaza a `/me/pcw`) | `status` | **`starts_at` desc**, `played_at` |
| `GET /me/pcw/post` (mi anuncio abierto, un objeto) | — | — |
| `GET /servers` | `q` | **`name` asc** |
| `GET /me/profile-requests` (deprecado) | `status` | **`created_at` desc** |

### Admin

| Endpoint | Filtros | Orden |
|---|---|---|
| `GET /admin/users` | `q`, `role`, `has_player`, `has_steam` | **`alias` asc**, `role` |
| `GET /admin/steam/unlinked` | `q` (nombre o SteamID) | **`last_played` desc**, `matches`, `last_nick` |
| `GET /admin/blocked-words` | `q` | **`word` asc**, `created_at` |
| `GET /admin/blocked-words/hits` | `kind` | **`kind` asc**, `name` |
| `GET /admin/team-requests` | `status`, `q` | **`status`** (pendientes primero), `name` |
| `GET /admin/profile-requests` (deprecado) | `status` | **`created_at` desc** |

## Base de datos (`supabase/replanteo/11_listados.sql`)

Solo vistas y funciones de lectura, sin cambios de datos:

| Vista | Para qué |
|---|---|
| `team_ranking` | Por equipo oficial: puntos de torneo, puntos totales con PCW y la posición en cada modo (`rank()` con los desempates actuales) |
| `event_standings` | Une grupos y suizo con la posición calculada por la base (`event_group_order` y el orden del suizo) |
| `team_members_view` | Plantel con alias, ELO y nivel para ordenar y filtrar |
| `event_registrations_view` | Inscritos con siembra y nombre del equipo |
| `player_map_stats` | Ya existe |

- **`admin_users`** gana parámetros de filtro, orden y paginación (`profiles` solo deja leer el propio, así que no puede ser una vista común).
- Con su inversa, sus pruebas y `correr.sh`.

## Backend

- **`lib/list.ts`:** un helper que arma el esquema de la consulta (`page`, `per`, `sort` con su lista cerrada, `order`) y lo aplica a la consulta de PostgREST con el desempate estable. Devuelve el sobre `{ items, total, page, per, sort, order }`.
- **Cada endpoint de lista** usa el helper. Los detalles quedan sin listas que puedan crecer (pregunta 1).
- **Pruebas:**
  - Unitarias del helper.
  - De integración por endpoint: página 2, cada filtro, cada orden en los dos sentidos y un `sort` inválido que da `400`.

## Frontend

- **`docs/frontend/contract.md`:** la convención en la sección 1 ("Listados") y, en cada endpoint, sus filtros y órdenes.
- **Cambio para el frontend:** los endpoints que hoy devuelven un arreglo pasan a devolver el sobre, y `/me/pcw` se divide en dos. Como nada está publicado, no hay compatibilidad que mantener.

## Requisitos antes de empezar

- Aprobación del plan y respuesta a las tres preguntas (hechas: Daniel aprobó las tres propuestas).

## Orden de implementación

1. **Base:** `11_listados.sql`, con inversa, pruebas y `correr.sh`. Tipos regenerados.
2. **Helper** `lib/list.ts` y sus pruebas.
3. **Endpoints públicos:** jugadores, equipos, ranking, partidas, torneos, PCW y mapas.
4. **Con sesión y admin.**
5. **Detalles:** sacar las listas a sus sub-endpoints.
6. **Documentación:** `DOCUMENTACION.md`, `GUIA_IMPLEMENTACION.md`, `contract.md` y `docs/PENDIENTES.md`.

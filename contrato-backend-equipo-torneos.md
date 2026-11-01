# Pedidos al backend: Equipo y Torneos

Fecha: 2026-10-28. De: frontend (rama `feat/frontend-fase-1`). Para: backend.

Las vistas de **Equipo** (`/myteam`, `/teams/{id}`) y **Torneos** (`/events`, `/events/{id}`) ya están implementadas con lo que la API tiene hoy. Lo que falta se muestra deshabilitado con "Próximamente", o se resuelve con un rodeo en el frontend. Este documento lista qué necesitamos para cerrarlas.

Revisado contra el OpenAPI actual (rama `feat/backend-api-fase-1` al `417ba50`): nada de lo que sigue existe todavía.

## Resumen

| # | Pedido | Vista | Prioridad | Qué destraba |
|---|---|---|---|---|
| E1 | Estado en el roster editable por el líder | Equipo | **Para cerrar** | Menú ⋯ → Activo / Suplente / Coach; invitar con estado |
| E2 | Roles de equipo (IGL, Entry, AWPer, Lurker, Support) | Equipo | **Para cerrar** | Tarjeta "Roles de equipo" |
| E3 | Logo del equipo | Equipo | **Para cerrar** | "Subir imagen" al crear; el escudo con logo en toda la web |
| E4 | `looking_for`: qué busca cada equipo | Equipo | **Para cerrar** | Filtros "Buscan activo / suplente / coach" en Buscar equipo |
| E5 | Historial de torneos del equipo | Equipo | **Para cerrar** | KPI "Torneos jugados" y "Torneos en los que participó" |
| E6 | `founded_at` del equipo | Equipo | Mejora | "Desde {fecha}" en la cabecera |
| E7 | `GET /me/teams` con mi rol | Equipo | Mejora | Quita un pedido por equipo al abrir Mi equipo |
| E8 | Más datos en invitaciones y pedidos | Equipo | Mejora | Quién invitó, el mensaje, nivel y puesto del jugador |
| T1 | BO y etapa actual en `GET /events` | Torneos | **Para cerrar** | Quita el pedido por tarjeta del listado |
| T2 | Banner del torneo | Torneos | **Para cerrar** | La imagen del listado y del detalle |
| T3 | Cierre de inscripciones | Torneos | **Para cerrar** | "Cupo · cierra en…" |
| T4 | Partida en vivo con el mapa en juego | Torneos | Mejora | "Semifinal · Mapa 2 de 3" en el botón "Ver partida en vivo" |

"Para cerrar" = sin eso el requerimiento queda abierto. "Mejora" = se puede cerrar sin eso, pero el frontend hace un rodeo o muestra menos.

Convenciones que asumimos, las mismas de la API actual: listas paginadas `{ items, total, page, per }`, errores `{ error: { code, message } }` con `code` en mayúsculas, y los valores de estado del roster que ya existen (`player`, `sub`, `coach`).

---

## Equipo

### E1. Estado en el roster editable por el líder

**Hoy:** `RosterEntry.role` (`player` / `sub` / `coach`) se lee, pero solo un admin lo cambia. En el menú ⋯ del roster las opciones Activo / Suplente / Coach están deshabilitadas, y el panel "Invitar jugador" tiene el campo "Estado en el roster" deshabilitado.

**Pedimos:**

- `PATCH /api/v1/teams/{id}/members/{playerId}`
  - Quién: el líder del equipo o un admin.
  - Body: `{ "role": "player" | "sub" | "coach" }`.
  - Respuesta: `200` con el `RosterEntry` actualizado (o `204`).
  - Topes: **5 `player`** y **1 `coach`** como máximo.
  - Errores:

    | Código | HTTP | Cuándo |
    |---|---|---|
    | `ROSTER_LIMIT_PLAYERS` | 409 | Ya hay 5 activos |
    | `ROSTER_LIMIT_COACH` | 409 | Ya hay un coach |
    | `NOT_A_MEMBER` | 404 | El jugador no está en el roster |
    | `FORBIDDEN` | 403 | No es el líder ni admin |

- **Invitar con estado:** `InviteBody` suma `role` opcional (por defecto `player`). Al aceptar, el jugador entra con ese estado, con los mismos topes (si ya no hay lugar, entra como `sub` o se rechaza con el código de arriba; lo que prefieran, pero que sea uno de los dos y documentado). `Invite` devuelve `role`.
- Notificación al jugador cuando le cambian el estado (si encaja en las notificaciones de la `28`).

### E2. Roles de equipo

Son independientes del estado del roster: un Activo puede ser AWPer, un Suplente puede no tener rol.

**Hoy:** la tarjeta muestra los cinco roles "Sin asignar" con "Próximamente".

**Pedimos:**

- `GET /api/v1/teams/{id}/roles` (todos, sin sesión también):

  ```json
  { "igl": { "player_id": "…", "alias": "Zeta" }, "entry": null, "awper": null, "lurker": null, "support": null }
  ```

- `PUT /api/v1/teams/{id}/roles` (líder o admin), con el objeto completo de ids:

  ```json
  { "igl": "<player_id>", "entry": null, "awper": "<player_id>", "lurker": null, "support": null }
  ```

  - Cada jugador tiene como máximo **un** rol, y tiene que ser miembro actual del roster.
  - Errores: `ROLE_DUPLICATE_PLAYER` (409), `NOT_A_MEMBER` (404), `FORBIDDEN` (403).
- Si un jugador sale del equipo, su rol queda en null.
- Opcional, para no pedir dos veces: `roles` dentro de `GET /teams/{id}`.

### E3. Logo del equipo

**Hoy:** "Subir imagen" en Crear equipo está deshabilitado; el escudo muestra la sigla (o las iniciales del nombre).

**Pedimos:**

- **Al pedir el equipo:** `PUT /api/v1/me/team-request` acepta `multipart/form-data` con `logo` opcional, además de `name` y `tag`.
- **Después:** `PUT /api/v1/teams/{id}/logo` (multipart, líder o admin) y `DELETE /api/v1/teams/{id}/logo` para volver a la sigla.
- **Reglas:** PNG, JPG o WebP; máximo 2 MB; el servidor lo recorta al cuadrado y lo guarda en 512×512 (y, si es barato, una versión de 128).
- **Errores:** `FILE_TOO_LARGE` (413), `FILE_BAD_TYPE` (415).
- **Respuesta:** `logo_url: string | null` en `TeamRef` (o al menos en `TeamSummary`, `TeamDetail`, `TeamRequest`, el ranking de equipos, las inscripciones de torneo y los lados de una partida). El escudo se usa en todas esas pantallas; con `logo_url` en `TeamRef` sale en todas sin pedidos extra.

### E4. `looking_for`

**Hoy:** en Buscar equipo, los chips "Buscan activo / suplente / coach" y la etiqueta de qué busca cada equipo están con "Próximamente".

**Pedimos:**

- `looking_for: ("player" | "sub" | "coach")[]` en `TeamSummary` y `TeamDetail` (lista vacía = no busca).
- Filtro `GET /api/v1/teams?looking_for=player,sub` (cualquiera de los indicados).
- Edición del líder: `PATCH /api/v1/teams/{id}` con `{ "looking_for": [...] }`.
- Sugerencia: si el roster está lleno (10), `looking_for` vale `[]` en la respuesta aunque esté guardado, para no ofrecer un equipo sin lugar.

En el frontend falta diseñar el control para que el líder lo edite; con el campo y el filtro alcanza para empezar.

### E5. Historial de torneos del equipo

**Hoy:** el KPI "Torneos jugados" y la sección "Torneos en los que participó" están con "Próximamente". Los títulos sí funcionan (los sacamos de `GET /events?status=finished` filtrando por `champion`).

**Pedimos:** `GET /api/v1/teams/{id}/events` (paginado, del más reciente al más viejo):

```json
{
  "items": [
    {
      "event": { "id": "…", "name": "Copa Invierno 2025", "template": "groups", "status": "finished", "starts_on": "2025-07-05", "ends_on": "2025-08-02" },
      "result": "champion",
      "place": 1,
      "played": 6, "won": 5, "lost": 1
    }
  ],
  "total": 1, "page": 1, "per": 20
}
```

- `result`: `champion` | `runner_up` | `semifinal` | `quarterfinal` | `groups` | `eliminated` | `in_progress` | `registered`. Y `place` cuando se puede calcular (null si no).
- Incluye los torneos en inscripciones y en curso (con `registered` / `in_progress`), y no los cancelados.
- Con `total` sacamos el KPI "Torneos jugados" (o, si prefieren, un `events_played` en `TeamDetail.record`).

### E6. `founded_at` (mejora)

`founded_at: string` (fecha de aprobación de la solicitud) en `TeamDetail`. Hoy mostramos "Desde {fecha}" con el ingreso más antiguo del roster, que falla en los equipos migrados sin fechas.

### E7. `GET /api/v1/me/teams` (mejora)

```json
[{ "id": "…", "name": "Furia Sur", "tag": "FUR", "logo_url": null, "my_role": "leader" | "player" | "sub" | "coach" }]
```

Hoy sacamos los equipos de `GET /me/profile` y el rol de cada uno pidiendo su plantel: un pedido por equipo cada vez que se abre Mi equipo o el detalle de un torneo.

### E8. Más datos en invitaciones y pedidos (mejora)

En `Invite`:
- `invited_by: { player_id, alias } | null` (quién invitó, en las invitaciones);
- `message: string | null` (si se suma un mensaje al invitar o al pedir entrar);
- `role` (ver E1);
- en `player`: `level` y `elo`, para la tarjeta del pedido que ve el líder.

---

## Torneos

### T1. BO y etapa actual en el listado

**Hoy:** `EventSummary` no trae la configuración ni la etapa. Para mostrar "BO3 · Final BO3" y "Etapa actual: Semifinal" en cada tarjeta, el frontend pide el detalle de **cada** torneo y, si está en curso, **todas sus partidas**. Con 20 torneos son hasta 40 pedidos al abrir el listado. Es un rodeo y lo queremos quitar.

**Pedimos**, en `EventSummary`:

| Campo | Tipo | Ejemplo |
|---|---|---|
| `bo` | `1 \| 3 \| 5` | El BO de las partidas comunes (`bo` o `bo_group` según la plantilla) |
| `bo_final` | `1 \| 3 \| 5` | El BO de la final (`bo_final`, `bo_grand_final` o `playoffs.bo_final`) |
| `current_stage` | `string \| null` | El `label` de la partida en vivo o de la próxima ("Semifinal"); null fuera de "en curso" |
| `progress` | `{ played, total } \| null` | Partidas terminadas y totales (sin libres), para la barra |

(Si les resulta más simple, `config` completo en `EventSummary` también sirve para `bo` y `bo_final`.)

### T2. Banner del torneo

**Hoy:** el listado y el detalle muestran un patrón rayado en el lugar de la imagen.

**Pedimos:**

- `banner_url: string | null` en `EventSummary` y `EventDetail`.
- Subirlo: `PUT /api/v1/events/{id}/banner` (multipart, organizador del torneo o admin) y `DELETE` para quitarlo.
- Reglas sugeridas: PNG, JPG o WebP, máximo 4 MB, proporción ancha (se muestra a 120 px de alto en el detalle y 88 px en las tarjetas); el servidor lo guarda en 1600×400 y 800×200.
- Mismos errores que el logo: `FILE_TOO_LARGE`, `FILE_BAD_TYPE`.

### T3. Cierre de inscripciones

**Hoy:** el pie de la tarjeta dice solo "Cupo"; el diseño pide "Cupo · cierra en 2 d". Además el botón dice "puedes cancelar hasta que se arme el fixture", porque no hay fecha.

**Pedimos:**

- `registration_closes_at: string | null` (fecha y hora) en `EventSummary` y `EventDetail`, editable por el organizador en `POST`/`PATCH /events`.
- Que el backend la respete: después de esa hora, `PUT`/`DELETE /events/{id}/registrations/{teamId}` responden `409 REGISTRATION_CLOSED` (salvo el organizador o un admin). Si es null, sigue como hoy (hasta generar el fixture).

### T4. Partida en vivo con el mapa (mejora)

**Hoy:** deducimos la partida en vivo de `GET /events/{id}/matches` (la primera con `status = live`) y mostramos "Semifinal · BO3".

**Pedimos**, en `EventDetail`:

```json
"live_match": { "id": "…", "label": "Semifinal", "map": "de_dust2", "map_index": 2, "maps_total": 3 } | null
```

O, como alternativa, `map_index` dentro de `MatchSummary` cuando `status = live`.

---

## Para confirmar (no son pedidos nuevos)

- **Notificaciones de inscripción:** el handoff pide avisar a los jugadores cuando su líder los inscribe en un torneo o cambia los inscritos. ¿Ya lo cubre alguno de los triggers de la `28_notificaciones`? Si no, sumarlo.
- **Inscripción sin SteamID:** hoy el `PUT` de inscripción rechaza a los jugadores sin SteamID con un mensaje. Confirmen el `code` exacto para que el diálogo lo muestre bien (por ejemplo `PLAYER_NOT_LINKED`, con los alias en `details`).

## Qué hace el frontend cuando llegue cada uno

| # | Cambio en el frontend |
|---|---|
| E1 | Activa el menú ⋯ y el campo de estado al invitar; muestra los errores de tope |
| E2 | Activa la tarjeta de roles con su selector |
| E3 | Activa "Subir imagen"; el escudo muestra el logo en toda la web |
| E4 | Activa los filtros y la etiqueta en Buscar equipo |
| E5 | Activa el KPI y la sección del historial |
| E6, E7, E8 | Reemplaza los rodeos actuales; sin cambios visibles grandes |
| T1 | Quita los pedidos por tarjeta del listado |
| T2 | Muestra el banner; mantiene el patrón rayado cuando es null |
| T3 | Muestra "cierra en…" y cambia la nota del botón |
| T4 | Suma "Mapa n de n" al botón "Ver partida en vivo" |

Detalle de cómo están hoy las dos vistas: bitácoras `docs/bitacora/2026-10-24-equipo/` y `docs/bitacora/2026-10-25-torneos/`.

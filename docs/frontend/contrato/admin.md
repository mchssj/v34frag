# Contrato para el frontend: Admin

> Parte del contrato para el frontend. Índice, estado y novedades: [`README.md`](README.md). Las decisiones de todos los módulos están en [`decisiones.md`](decisiones.md).

## 9. Admin

| Pantalla | Endpoints | Estado |
|---|---|---|
| Formatos de PCW | `PUT /api/v1/admin/pcw/formats` | Disponible |
| Roles | `PUT /api/v1/admin/users/{id}/role` (`user`, `organizer` o `moderator`; desde el 2026-10-26 también `moderator`); la lista sale de `GET /api/v1/admin/users` (filtro `role`). Todos los roles juegan; el admin además organiza y modera. El rol admin se da en la base | Disponible |
| Baneos | Ver "Baneos (moderadores y admins)" abajo | Disponible |
| VIP | Ver "VIP (admin)" abajo | Disponible (2026-10-28) |
| Catálogo de mapas | `GET /api/v1/maps?include_inactive=true` y `PUT /api/v1/admin/maps`: la lista completa en orden, con versiones, `active` (disponible; `false` = retirado), `mixes` (sale en el select de Mixes) y `veto_default` (pool por defecto del veto). **No borra:** tiene que traer todos los mapas que existen (si falta uno, `400`). Al menos 2 en el pool por defecto, y un retirado no puede estar en él. `mixes` y `veto_default` que no vienen quedan como estaban (en un mapa nuevo, como `active`) | Disponible |
| Foto de un mapa | `POST /api/v1/admin/maps/{name}/image` (`multipart/form-data`, campo `file`, JPG/PNG/WebP de hasta 2 MB; reemplaza a la anterior) y `DELETE` de la misma ruta para quitarla. Devuelven el mapa. Es el fondo del marcador de la sala del mix y vale para todas sus versiones | Disponible |
| Resultado de una PCW | `POST /api/v1/admin/pcw/matches/{id}/result` (`{ maps }`) | Disponible |
| Partidas huérfanas | `DELETE /api/v1/admin/matches/{id}` (sin stats) | Disponible |
| Torneos | Lo mismo que el organizador, sobre todos los torneos | Disponible |
| Jugadores | Alta, edición y baja (`/api/v1/admin/players`). El nick solo se edita en jugadores sin cuenta (en los vinculados manda el alias). Vincular una cuenta es `PATCH` con `user_id`. La baja falla con mensaje si tiene partidas | Disponible |
| Foto y medallas | `POST /api/v1/admin/players/{id}/photo` (mismas reglas que el avatar), `POST …/{id}/medals`, `DELETE /api/v1/admin/medals/{id}` | Disponible |
| SteamID sin vincular | `GET /api/v1/admin/steam/unlinked`, `POST /api/v1/admin/steam/link` (suma el SteamID a la ficha: principal si no tiene, adicional si ya tiene; hasta 4; `player_id: null` lo quita) | Disponible |
| SteamID de las fichas | Ver "SteamID y `!claim` (admin)" abajo | Disponible |
| Usuarios y alias | `GET /api/v1/admin/users?q=` (alias, rol, jugador). `PUT /api/v1/admin/users/{id}/alias`: si choca con una palabra bloqueada, ofrecer "Guardar igual" (`force: true`) | Disponible |
| Palabras bloqueadas | Lista, alta y baja, y "Nombres actuales que la contienen": `GET`/`POST /api/v1/admin/blocked-words`, `DELETE /api/v1/admin/blocked-words/{id}`, `GET /api/v1/admin/blocked-words/hits` | Disponible |
| Equipos | Alta, edición y baja; sumar a un jugador directamente y cambiar su rol. Nombre o sigla con palabra bloqueada: ofrecer "Guardar igual" (`force: true`). La baja falla si tiene partidas o inscripciones. Caminos: `POST /api/v1/admin/teams`, `PATCH`/`DELETE /api/v1/admin/teams/{id}`, `POST /api/v1/admin/teams/{id}/members`, `PATCH /api/v1/admin/teams/{id}/members/{playerId}` (rol) | Disponible |
| Solicitudes de equipo nuevo | Listar (`has_steam` dice si se puede aprobar), aprobar y rechazar: `GET /api/v1/admin/team-requests`, `POST /api/v1/admin/team-requests/{userId}/approve` y `/reject` | Disponible |
| Puntos del ranking | `GET`/`PUT /api/v1/admin/ranking/config` | Disponible |
| Servidores | Ver "Servidores (admin)" abajo | Disponible |
| ELO | Ver "ELO (admin)" abajo | Disponible |
| Clips | Ver "Clips (admin)" abajo | Disponible |
| Demos | Ver "Demos (admin)" abajo | Disponible |

### Baneos (moderadores y admins)

Plan: [`docs/bitacora/2026-10-25-baneos-web/`](../../bitacora/2026-10-25-baneos-web/PLAN.md). Un baneo vale en **todos los servidores** (también RBK), se aplica al conectarse y, a quien ya está jugando (aunque sea un mix), lo echa la sincronización de cada 3 minutos y de cada cambio de mapa, o al momento si un moderador o admin escribe `!syncbans` en el servidor (conviene decirlo en el formulario de "Banear") y no avisa por Discord ni por notificación. Los servidores lo aplican cuando tengan el plugin `csstv_bans` (después del corte).

| Acción | Endpoint | Reglas |
|---|---|---|
| Lista | `GET /api/v1/bans` (la pública; moderadores y admins ven también el SteamID de los baneos con ficha y buscan por él) | Filtros `status` (`active`, `expired`, `lifted`), `source` (`web`, `server`, `import`), `server` y `q`. `sort`: **`created_at` desc** (también `expires_at`) |
| Banear | `POST /api/v1/admin/bans` con `player_id` **o** `steam_id`, `reason` (hasta 200) y `expires_at` **o** `permanent: true` | Una ficha vale para todos sus SteamID (también los que sume después); necesita SteamID. Un SteamID con ficha banea la ficha. **Permanente, solo un admin:** al moderador no se le muestra la opción. Reemplaza al baneo activo que tuviera (queda levantado con `lifted.replaced_by`); un moderador no puede reemplazar uno permanente (`403`) |
| Cambiar | `PATCH /api/v1/admin/bans/{id}` con `reason`, `expires_at` o `permanent: true` | Solo un baneo activo. Un moderador cambia cualquiera que no sea permanente y no puede volverlo permanente |
| Levantar | `POST /api/v1/admin/bans/{id}/lift` con `reason` | No se borra: queda como `lifted`, con quién y por qué. Uno permanente, solo un admin |

Los errores de permiso llegan como `403` con el mensaje para mostrar ("Solo un admin puede banear de forma permanente"); los de datos, como `400`.

### VIP (admin)

Plan: [`docs/bitacora/2026-10-28-vip-fase-0/`](../../bitacora/2026-10-28-vip-fase-0/PLAN.md). El VIP es de la **cuenta** (no de la ficha). Se cobra por fuera de la web: el admin lo carga a mano. Cada vez que se da es un período; nada se borra, se quita. **Vence solo** al pasar la fecha.

| Acción | Endpoint | Reglas |
|---|---|---|
| Lista (Administración › VIP) | `GET /api/v1/admin/vips` | Cada cuenta que fue VIP: `user` (`id`, `alias`), `player` (`id`, `photo_url`, o `null`), `status` (`lifetime`, `active`, `revoked` o `expired`), `active`, `lifetime`, `until` (fin del VIP vigente; `null` si es lifetime o no está activo), `since` y `last_change`. Filtros `status`, `q` (alias) y `expiring` (temporales activos que vencen en los próximos N días, de 1 a 90: con `7`, la marca "vence pronto" para saber a quién cobrarle). `sort`: **`until` asc** (también `since`, `alias`, `last_change`); los lifetime y los inactivos, al final |
| Historial de una cuenta | `GET /api/v1/admin/users/{id}/vip` | `vip` (`active`, `lifetime`, `until`, `since`, o `null` si nunca fue VIP) y `periods` (del más nuevo al más viejo): `starts_at`, `ends_at` (`null` = lifetime), `source` (`manual` o `import`), `note`, `granted_by` (`id`, `alias`) y `revoked` (`at`, `reason`, `by`, o `null`) |
| Dar o extender | `POST /api/v1/admin/users/{id}/vip` con **una** de `months` (1, 3, 6 o 12), `until` (ISO 8601) o `lifetime: true`, y `note` (opcional, hasta 200) | Si ya es VIP, el período nuevo **empieza donde termina el actual** (el que paga antes no pierde días): mostrar cómo queda ("VIP hasta el AAAA-MM-DD") antes de confirmar. Con `until`, la fecha tiene que pasar el fin actual. A un lifetime no se le ofrecen duraciones. Responde como el historial |
| Quitar | `POST /api/v1/admin/users/{id}/vip/revoke` con `reason` (obligatorio, hasta 200) | Quita los períodos vigentes y los futuros, también un lifetime. Responde como el historial |

- **En Administración › Usuarios** cada fila trae `vip` (el mismo objeto que en el historial, o `null`): mostrar el estado y los botones "Dar VIP", "Extender" y "Quitar VIP".
- **Errores:** sin duración o con más de una, `400` (`VALIDATION_ERROR`); un temporal a un lifetime ("Ya es VIP lifetime"), una fecha que no pasa el fin actual o quitar sin VIP vigente ("No tiene VIP vigente"), `400` (`BUSINESS_RULE`) con el mensaje para mostrar; cuenta que no existe, `404`.

### Servidores (admin)

| Endpoint | Qué hace |
|---|---|
| `GET /api/v1/admin/servers` | Lista (filtros en la sección 1). Cada servidor: `name`, `active`, `license_state`, `license_expires_at`, `allowed_ip`, `online`, `last_seen_at`, `last_ip`, `plugin_version`, `connect_address`, `panel_server_id`, `mode`, `region`, `tv_port`, `matches`, `last_match_at` |
| `GET /api/v1/admin/servers/{id}` | Un servidor, con los mismos campos |
| `POST /api/v1/admin/servers` | Alta. Body: `name` (obligatorio, de 2 a 40, único sin distinguir mayúsculas), `connect_address` (`host:puerto`), `panel_server_id`, `license_expires_at` (ISO 8601), `allowed_ip`, `mode` (`mix`, `competitive`, `public`, `deathmatch`, `retakes` o `practice`), `region` (texto libre, de 2 a 30), `tv_port` (puerto de SourceTV, de 1 a 65535). Responde `201` con `{ id, token, cfg, build_command }` |
| `PATCH /api/v1/admin/servers/{id}` | Cualquiera de los campos del alta (`null` o `""` borra), más `active` (`false` revoca, `true` reactiva). Devuelve el servidor |
| `POST /api/v1/admin/servers/{id}/token` | Token nuevo: el anterior deja de funcionar al instante y el servidor queda activo. Mismo cuerpo de respuesta que el alta |
| `DELETE /api/v1/admin/servers/{id}` | Solo sin partidas. Con partidas, `400 BUSINESS_RULE`: ofrecer "Revocar" |

- **El token se muestra una sola vez** (la base guarda su hash). Mostrar `cfg` en un cuadro con "Copiar" y avisar que no se vuelve a ver; si se pierde, se genera otro.
- **`build_command`:** para servidores externos (como RBK), que llevan el build licenciado. Mostrarlo junto al token.
- **`license_state`:** `ok`; `expiring` (vence en 7 días o menos: aviso amarillo); `expired` (el servidor no puede jugar mixes ni subir resultados: aviso rojo); `revoked`.
- **`online`:** el servidor validó su licencia en los últimos 35 minutos (lo hace al cargar cada mapa y cada 30 minutos).
- **IP permitida:** `last_ip` es la IP de la última conexión válida; ofrecer "Usar la última IP" para cargarla en `allowed_ip`.
- **Modo y región:** se muestran en el estado público de los servidores (sección [8e](partidas.md)). El modo es un selector con la lista fija; la región, un campo de texto.
- **Puerto de SourceTV (`tv_port`):** el `tv_port` del servidor (por ejemplo 27020). Con él, los mixes en vivo muestran "Ver en TV" (`steam://connect/{host}:{tv_port}`, el host sale de `connect_address`). Campo numérico opcional.
- Nombre repetido: `409 CONFLICT`.

### ELO (admin)

| Endpoint | Qué hace |
|---|---|
| `GET /api/v1/elo/config` | `{ config, updated_at, updated_by }`. `config` tiene los siete valores; `updated_by` (`{ id, alias }`) solo lo ve un admin |
| `POST /api/v1/admin/elo/preview` | Body: los siete valores. Devuelve los ejemplos (`even`, `high_rating`, `low_rating`, `new_player`, `floor` y `participation`). No guarda nada: llamarlo mientras el admin edita, con un pequeño retardo entre teclas |
| `PUT /api/v1/admin/elo/config` | Body: `{ config }`. Responde `{ config }`. **Vale para los mixes nuevos**: no recalcula el historial (avisarlo en el formulario) |
| ~~`POST /api/v1/admin/elo/recompute`~~ y ~~`POST /api/v1/admin/elo/simulate`~~ | **Se borraron el 2026-10-21** (pedido de Daniel): desde la web ya no se recalcula el ELO de todos. Para corregir a jugadores puntuales están los ajustes manuales (abajo) |

| Valor | Rango | Qué es |
|---|---|---|
| `base` | 5 a 100 | ELO que gana o pierde cada uno con equipos parejos |
| `bonus_max` | 0 a 20 | Tope del bonus o castigo por rendimiento |
| `bonus_factor` | 0 a 50 (admite decimales) | Bonus por cada punto de rating sobre o bajo 1,00 |
| `elo_floor` | 0 a 1000 | Nadie baja de este ELO |
| `start_elo` | 100 a 5000, no menor que `elo_floor` | ELO de un jugador nuevo |
| `min_pct` | 1 a 100 | Con menos de este % de las rondas, el ELO no cambia |
| `full_pct` | `min_pct` a 100 | Desde este % de las rondas cuenta completo |

### Clips (admin, desde el 2026-10-23)

Escala y topes de las jugadas destacadas (sección [8g](partidas.md)).

| Endpoint | Qué hace |
|---|---|
| `GET /api/v1/admin/clips/config` | `{ config, updated_at, updated_by }`. `updated_by` es `{ id, alias }` |
| `PATCH /api/v1/admin/clips/config` | Body: solo lo que cambia (en `priorities`, solo los tipos que cambian). Responde lo mismo que el `GET`. **Vale al instante para todas las partidas**, también las viejas: los datos no se tocan, cambia qué se muestra y en qué orden (avisarlo en el formulario) |

| Valor | Rango | Qué es |
|---|---|---|
| `priorities` | 1 a 99 por tipo (`ace`, `clutch_5`, `clutch_4`, `4k`, `clutch_3`, `3k`, `clutch_2`, `clutch_1`) | 1 es lo más valioso. Empates: primero la jugada de una ronda ganada, después la ronda más tardía. De fábrica: ace 1, 1v5 y 1v4 2, 4k 3, 1v3 4, 3k 5, 1v2 6, 1v1 7 |
| `per_player` | 1 a 10 | Clips por jugador en cada partida (por ficha: sus SteamID suman juntos) |
| `per_match` | 1 a 50 | Clips por partida |
| `split_gap_seconds`, `pre_seconds`, `post_seconds` | 1 a 60, 0 a 15, 0 a 15 | Para el video (fase C, todavía no existe): cortar el clip si pasan más de esos segundos entre dos kills, y márgenes antes y después. Se pueden mostrar como "Video (próximamente)" |

### Ajustes manuales de ELO (admin, desde el 2026-10-21)

Para corregir el ELO de jugadores puntuales (un mix caído, un abandono, un error), en lugar de recalcular a todos.

| Endpoint | Qué hace |
|---|---|
| `POST /api/v1/admin/elo/adjustments` | Body: `{ player_ids, delta \| set_elo, reason }`. De 1 a 10 fichas (sin repetir, todas con SteamID). **Uno de los dos:** `delta` suma o resta (de −500 a +500, sin 0) o `set_elo` fija el ELO (0 a 10000). `reason` es obligatorio (hasta 200) y **lo ve el jugador**. Responde `201 { items: [{ adjustment_id, player, elo_before, elo_after }] }`; con `set_elo`, quien ya tenía ese ELO viene con `adjustment_id: null` (no se ajustó) |
| `GET /api/v1/admin/elo/adjustments` | Listado: `id`, `kind` (`delta` o `set`), `delta`, `set_elo`, `reason`, `applied_at`, `player` (`{ id, alias }` o `null`), `steam_id` y `created_by` (`{ id, alias }`). Filtros `player`, `q` (alias, motivo o SteamID), `from`, `to`; `sort`: **`applied_at` desc**, `delta` |
| `DELETE /api/v1/admin/elo/adjustments/{id}` | **Deshacer**. Body: `{ confirm }`. Responde `204`; `404` si no existe |

- **Cuenta desde ahora** y respeta el ELO mínimo (`elo_floor`). Solo mueve el ELO y el pico: no cambia partidas, victorias ni stats.
- **`set_elo` guarda el valor:** si después la base recalcula sola (al aprobar o quitar un SteamID, o con un mix que llega tarde a una temporada cerrada), el jugador vuelve a quedar en ese valor en esa fecha. `delta` es el cambio que hubo al fijarlo.
- **Deshacer** resta el cambio. Si es un "fijar", o después hubo un cierre o comienzo de temporada o un "fijar" de la misma ficha, recalcula el ELO de todos para que quede como si el ajuste no hubiera existido: avisarlo en la confirmación.

**Pantalla sugerida:**
1. Buscar y elegir hasta 10 jugadores (`GET /api/v1/players?q=`), con su ELO actual.
2. Elegir "Sumar o restar" o "Fijar en", y el motivo.
3. Antes de confirmar, mostrar cómo queda cada uno ("1480 → 1500"), calculado en el navegador con el ELO actual y el mínimo de `GET /api/v1/elo/config`. La respuesta trae el resultado real.
4. Debajo, el listado con "Deshacer".

**Deshacer pide doble confirmación (obligatorio).**
1. Pregunta si está seguro, con el ajuste (jugador, cambio y motivo).
2. Pide escribir **`estoy seguro`** en un campo de texto. El botón de enviar queda deshabilitado hasta que el texto coincide (sin distinguir mayúsculas ni espacios en los bordes).
3. Manda ese texto en `confirm`. La API también lo exige: sin él, o con otro texto, responde `400 VALIDATION_ERROR` en el campo `confirm` y no lo deshace.

### Temporadas (admin)

Configuración, abrir la temporada 1, cambiar la activa, vista previa del cierre y "Terminar temporada" (con doble confirmación): sección [8f](temporadas.md).

### Demos (admin)

| Endpoint | Qué hace |
|---|---|
| `GET /api/v1/admin/demos/summary` | `pending`, `uploaded`, `missing`, `expired`, `uploaded_bytes` (lo que ocupan en R2), `oldest_pending_at`, `worker_online` y `worker_last_seen_at` |
| `GET /api/v1/admin/demos` | Listado (filtros en la sección 1). Cada demo: partida (`match_id`, tipo, estado, mapa, fecha, bandos, marcador, `parent_match_id`), `server` (`{ id, name, has_panel }`), `demo_status`, `demo_size` (bytes), `demo_attempts`, `demo_uploaded_at`, `expires_at`, `demo_url` y `can_retry` |
| `POST /api/v1/admin/demos/{matchId}/retry` | Una demo `missing` vuelve a la cola del Worker. `204`, o `400` con el motivo (ya subida, vencida, ya en la cola o servidor sin id del panel) |
| `GET /api/v1/admin/demo-workers` | Workers de demos: `name`, `active`, `online`, `last_seen_at` |
| `POST /api/v1/admin/demo-workers` | Alta. Body: `name` (único). `201` con `{ id, token, secret_command }` |
| `PATCH /api/v1/admin/demo-workers/{id}` | `name` o `active` (`false` revoca). Devuelve el Worker |
| `POST /api/v1/admin/demo-workers/{id}/token` | Token nuevo. Body: `{ confirm }`. Responde como el alta |
| `DELETE /api/v1/admin/demo-workers/{id}` | `204` |

- **Avisos en el resumen:** `worker_online: false` (el Worker no está corriendo: las demos no se suben), `missing > 0` (ofrecer el filtro de perdidas) y `oldest_pending_at` de hace más de una hora.
- **Vencimiento:** las demos se guardan 90 días; mostrar `expires_at` y el tamaño en MB.
- **Reintentar:** el botón solo con `can_retry: true`. Después, la demo aparece como pendiente y el Worker la busca en los próximos 10 minutos.
- **Token del Worker:** se muestra una sola vez, con `secret_command` (cómo cargarlo en Cloudflare).
- **Token nuevo, con doble confirmación (obligatorio):** el Worker deja de subir demos hasta que se carga el token nuevo en Cloudflare. Igual que al deshacer un ajuste de ELO: preguntar si está seguro, pedir escribir **`estoy seguro`** (el botón queda deshabilitado hasta que coincide) y mandarlo en `confirm`. La API lo exige: sin él, `400 VALIDATION_ERROR` en `confirm`.

### Mixes interrumpidos (admin)

| Endpoint | Qué hace |
|---|---|
| `GET /api/v1/matches?kind=mix&review=pending` | Pendientes. En el detalle, `review_detail`: `rounds_played`, `max_rounds`, `min_rounds`, `can_apply` y `blocked_reason` |
| `POST /api/v1/admin/mixes/{id}/apply-elo` | Aplicar el ELO. Body `{ confirm }`. `204`; `400 BUSINESS_RULE` con el motivo (no llega al 35 %, empate, ya revisado); `404` si no es un interrumpido |
| `POST /api/v1/admin/mixes/{id}/discard` | Descartar: queda cancelado, sin ELO. `204`; `404` si no está pendiente |
| `GET /api/v1/mixes/live?stale=true` | Mixes en vivo sin fotos hace más de 10 minutos (el servidor se cayó y no volvió) |
| `POST /api/v1/admin/mixes/live/{uid}/close` | Cerrarlo como interrumpido con la última foto. `200` con `{ match_id }`; `400` si todavía manda fotos; `404` si ya no está en vivo |

- **Aplicar el ELO, con doble confirmación (obligatorio).** Igual que al deshacer un ajuste de ELO: preguntar si está seguro, mostrando quién gana y con cuántas rondas; pedir escribir **`estoy seguro`**; mandarlo en `confirm`. El botón solo con `can_apply: true`; si no, mostrar `blocked_reason`.
- **Descartar** y **Cerrar como interrumpido** llevan una confirmación simple.

### Borrar un mix (admin, desde el 2026-10-24)

| Endpoint | Qué hace |
|---|---|
| `DELETE /api/v1/admin/mixes/{id}` | Body `{ elo: "keep" \| "revert", confirm }`. `200` con `{ elo_mode, players }` (`elo_mode: "none"` si el mix no había movido el ELO). `400 BUSINESS_RULE` si no es un mix terminado o cancelado, o si está vinculado con `!match` a una partida de torneo o PCW; `404` si no existe |

- **"Borrar este mix"** en la sala del mix, solo para admins. El diálogo pregunta qué pasa con el ELO:
  - **Mantener el ELO** (`keep`): los jugadores se quedan con lo que ganaron o perdieron.
  - **Revertir el ELO** (`revert`): a cada jugador se le resta lo que le dio ese mix.
  - En los dos casos **no se recalcula la historia**: los mixes posteriores quedan como están.
- **Doble confirmación (obligatoria):** escribir **`estoy seguro`** y mandarlo en `confirm`.
- Se borran también sus stats, chat y clips. La demo queda en R2 hasta que venza. El borrado queda registrado para los admins.
- Toast: "Mix borrado. Se mantuvo el ELO." o "Mix borrado. ELO revertido."

### SteamID y `!claim` (admin)

| Endpoint | Qué hace |
|---|---|
| `GET /api/v1/admin/steam-requests` | Pedidos de SteamID: `kind` (`add`: adicional con `!claim`; `remove`: el jugador pide desvincularlo), SteamID, nick que usó, ficha, cuenta, servidor, `matches`, `player_steam_count`, `shares_match` y `note` (el motivo del jugador, en `remove`). Filtros `status`, `kind` y `q` |
| `POST /api/v1/admin/steam-requests/{id}/approve` | Aprobar. **`add`:** lo suma a la ficha, le pasa el historial y **recalcula el ELO de todos**; falla (`400`) si comparte partidas con otro SteamID de la ficha (`shares_match: true`: no mostrar el botón). **`remove`:** lo saca de la ficha (como `DELETE /api/v1/admin/steam/{steamid}`); falla si es el único SteamID de la ficha |
| `POST /api/v1/admin/steam-requests/{id}/reject` | Rechazar. Body `{ reason }` (`reason` opcional; lo ve el jugador) |
| `GET /api/v1/admin/claims` | Registro de cada `!claim`, aceptado o no, y de los reclamos del sistema viejo |
| `GET` / `PUT /api/v1/admin/steam/config` | `max_steam_ids`: tope de SteamID por ficha que se pueden pedir con `!claim` (de 1 a 4, por defecto 3) |
| `DELETE /api/v1/admin/steam/{steamid}` | Quitar un SteamID de su ficha: sus partidas vuelven a quedar sin ficha. Si era el principal, el adicional más viejo pasa a serlo. Si el jugador había pedido desvincularlo, el pedido queda aprobado |
| `POST /api/v1/admin/steam/{steamid}/primary` | Hacer principal un SteamID adicional (sin el límite de 24 horas del jugador) |

- Aprobar o quitar un SteamID de una ficha con varios **recalculan el ELO de todos** (pueden mover un poco los cambios de ELO de otros jugadores). Avisarlo en la confirmación. Cambiar el principal **no** recalcula: el ELO de la ficha queda igual.
- Un pedido que el jugador canceló llega con `status: cancelled` (desde el 2026-10-19): mostrarlo como "Cancelado por el jugador", sin botones (aprobarlo o rechazarlo da `400`).
- En la bandeja, un pedido `remove` se muestra como "Quiere desvincular" con su `note`; uno `add`, como "SteamID adicional".
- Los pedidos pendientes **reservan** el SteamID y vencen a los 30 días.

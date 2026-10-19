# Contrato para el frontend: Admin

> Parte del contrato para el frontend. Índice, estado y novedades: [`README.md`](README.md). Las decisiones de todos los módulos están en [`decisiones.md`](decisiones.md).

## 9. Admin

| Pantalla | Endpoints | Estado |
|---|---|---|
| Formatos de PCW | `PUT /api/v1/admin/pcw/formats` | Disponible |
| Organizadores | `PUT /api/v1/admin/users/{id}/role` (`user` u `organizer`); la lista sale de `GET /api/v1/admin/users` | Disponible |
| Pool de mapas | `GET /api/v1/maps` y `PUT /api/v1/admin/maps` (lista completa en orden, con versiones y activos) | Disponible |
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
| Demos | Ver "Demos (admin)" abajo | Disponible |

### Servidores (admin)

| Endpoint | Qué hace |
|---|---|
| `GET /api/v1/admin/servers` | Lista (filtros en la sección 1). Cada servidor: `name`, `active`, `license_state`, `license_expires_at`, `allowed_ip`, `online`, `last_seen_at`, `last_ip`, `plugin_version`, `connect_address`, `panel_server_id`, `matches`, `last_match_at` |
| `GET /api/v1/admin/servers/{id}` | Un servidor, con los mismos campos |
| `POST /api/v1/admin/servers` | Alta. Body: `name` (obligatorio, de 2 a 40, único sin distinguir mayúsculas), `connect_address` (`host:puerto`), `panel_server_id`, `license_expires_at` (ISO 8601), `allowed_ip`. Responde `201` con `{ id, token, cfg, build_command }` |
| `PATCH /api/v1/admin/servers/{id}` | Cualquiera de los campos del alta (`null` o `""` borra), más `active` (`false` revoca, `true` reactiva). Devuelve el servidor |
| `POST /api/v1/admin/servers/{id}/token` | Token nuevo: el anterior deja de funcionar al instante y el servidor queda activo. Mismo cuerpo de respuesta que el alta |
| `DELETE /api/v1/admin/servers/{id}` | Solo sin partidas. Con partidas, `400 BUSINESS_RULE`: ofrecer "Revocar" |

- **El token se muestra una sola vez** (la base guarda su hash). Mostrar `cfg` en un cuadro con "Copiar" y avisar que no se vuelve a ver; si se pierde, se genera otro.
- **`build_command`:** para servidores externos (como RBK), que llevan el build licenciado. Mostrarlo junto al token.
- **`license_state`:** `ok`; `expiring` (vence en 7 días o menos: aviso amarillo); `expired` (el servidor no puede jugar mixes ni subir resultados: aviso rojo); `revoked`.
- **`online`:** el servidor validó su licencia en los últimos 35 minutos (lo hace al cargar cada mapa y cada 30 minutos).
- **IP permitida:** `last_ip` es la IP de la última conexión válida; ofrecer "Usar la última IP" para cargarla en `allowed_ip`.
- Nombre repetido: `409 CONFLICT`.

### ELO (admin)

| Endpoint | Qué hace |
|---|---|
| `GET /api/v1/elo/config` | `{ config, updated_at, updated_by }`. `config` tiene los siete valores; `updated_by` (`{ id, alias }`) solo lo ve un admin |
| `POST /api/v1/admin/elo/preview` | Body: los siete valores. Devuelve los ejemplos (`even`, `high_rating`, `low_rating`, `new_player`, `floor` y `participation`). No guarda nada: llamarlo mientras el admin edita, con un pequeño retardo entre teclas |
| `POST /api/v1/admin/elo/simulate` | Body: los siete valores. Listado (`q`, `changed`; `sort`: **`abs_delta` desc**, `delta`, `elo_after`, `elo_before`, `name`) de cómo quedaría cada jugador si se recalcula todo: `elo_before`, `elo_after`, `delta`, partidas antes y después. No guarda nada |
| `PUT /api/v1/admin/elo/config` | Body: `{ config, recompute, confirm }`. Sin `recompute`, vale para los mixes nuevos y `recomputed` es `null`. Con `recompute: true`, también recalcula todo y pide `confirm` |
| `POST /api/v1/admin/elo/recompute` | Body: `{ confirm }`. Recalcula todo con la configuración actual. Responde `{ recomputed }` (mixes aplicados) |

| Valor | Rango | Qué es |
|---|---|---|
| `base` | 5 a 100 | ELO que gana o pierde cada uno con equipos parejos |
| `bonus_max` | 0 a 20 | Tope del bonus o castigo por rendimiento |
| `bonus_factor` | 0 a 50 (admite decimales) | Bonus por cada punto de rating sobre o bajo 1,00 |
| `elo_floor` | 0 a 1000 | Nadie baja de este ELO |
| `start_elo` | 100 a 5000, no menor que `elo_floor` | ELO de un jugador nuevo |
| `min_pct` | 1 a 100 | Con menos de este % de las rondas, el ELO no cambia |
| `full_pct` | `min_pct` a 100 | Desde este % de las rondas cuenta completo |

**Recalcular pide doble confirmación (obligatorio).** Recalcular rehace el ELO de todos los jugadores con todo el historial y no se puede deshacer desde la web. Antes de enviar `PUT /api/v1/admin/elo/config` con `recompute: true` o `POST /api/v1/admin/elo/recompute`, el frontend:
1. Pregunta si está seguro, con un resumen de lo que va a pasar (sugerencia: mostrar la simulación con los valores nuevos).
2. Pide escribir **`estoy seguro`** en un campo de texto. El botón de enviar queda deshabilitado hasta que el texto coincide (sin distinguir mayúsculas ni espacios en los bordes).
3. Manda ese texto en `confirm`. La API también lo exige: sin él, o con otro texto, responde `400 VALIDATION_ERROR` en el campo `confirm` y no recalcula.

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
- **Token nuevo, con doble confirmación (obligatorio):** el Worker deja de subir demos hasta que se carga el token nuevo en Cloudflare. Igual que al recalcular el ELO: preguntar si está seguro, pedir escribir **`estoy seguro`** (el botón queda deshabilitado hasta que coincide) y mandarlo en `confirm`. La API lo exige: sin él, `400 VALIDATION_ERROR` en `confirm`.

### Mixes interrumpidos (admin)

| Endpoint | Qué hace |
|---|---|
| `GET /api/v1/matches?kind=mix&review=pending` | Pendientes. En el detalle, `review_detail`: `rounds_played`, `max_rounds`, `min_rounds`, `can_apply` y `blocked_reason` |
| `POST /api/v1/admin/mixes/{id}/apply-elo` | Aplicar el ELO. Body `{ confirm }`. `204`; `400 BUSINESS_RULE` con el motivo (no llega al 35 %, empate, ya revisado); `404` si no es un interrumpido |
| `POST /api/v1/admin/mixes/{id}/discard` | Descartar: queda cancelado, sin ELO. `204`; `404` si no está pendiente |
| `GET /api/v1/mixes/live?stale=true` | Mixes en vivo sin fotos hace más de 10 minutos (el servidor se cayó y no volvió) |
| `POST /api/v1/admin/mixes/live/{uid}/close` | Cerrarlo como interrumpido con la última foto. `200` con `{ match_id }`; `400` si todavía manda fotos; `404` si ya no está en vivo |

- **Aplicar el ELO, con doble confirmación (obligatorio).** Igual que al recalcular: preguntar si está seguro, mostrando quién gana y con cuántas rondas; pedir escribir **`estoy seguro`**; mandarlo en `confirm`. El botón solo con `can_apply: true`; si no, mostrar `blocked_reason`.
- **Descartar** y **Cerrar como interrumpido** llevan una confirmación simple.

### SteamID y `!claim` (admin)

| Endpoint | Qué hace |
|---|---|
| `GET /api/v1/admin/steam-requests` | Pedidos de SteamID adicional: SteamID, nick que usó, ficha, cuenta, servidor, `matches`, `player_steam_count` y `shares_match` |
| `POST /api/v1/admin/steam-requests/{id}/approve` | Aprobar: lo suma a la ficha, le pasa el historial y **recalcula el ELO de todos**. Falla (`400`) si comparte partidas con otro SteamID de la ficha (`shares_match: true`: no mostrar el botón) |
| `POST /api/v1/admin/steam-requests/{id}/reject` | Rechazar. Body `{ reason }` (`reason` opcional; lo ve el jugador) |
| `GET /api/v1/admin/claims` | Registro de cada `!claim`, aceptado o no, y de los reclamos del sistema viejo |
| `GET` / `PUT /api/v1/admin/steam/config` | `max_steam_ids`: tope de SteamID por ficha que se pueden pedir con `!claim` (de 1 a 4, por defecto 3) |
| `DELETE /api/v1/admin/steam/{steamid}` | Quitar un SteamID de su ficha: sus partidas vuelven a quedar sin ficha. Si era el principal, el adicional más viejo pasa a serlo |
| `POST /api/v1/admin/steam/{steamid}/primary` | Hacer principal un SteamID adicional |

- Aprobar, quitar o cambiar el principal **recalculan el ELO de todos** (pueden mover un poco los cambios de ELO de otros jugadores). Avisarlo en la confirmación.
- Los pedidos pendientes **reservan** el SteamID y vencen a los 30 días.

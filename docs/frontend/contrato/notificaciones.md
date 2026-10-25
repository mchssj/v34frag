# Contrato para el frontend: Notificaciones

> Parte del contrato para el frontend. Índice, estado y novedades: [`README.md`](README.md). Las decisiones de todos los módulos están en [`decisiones.md`](decisiones.md).

## 12. Notificaciones (disponible desde el 2026-10-25, primera etapa)

Las crea la base cuando pasa algo (te invitan, aceptan tu pedido, sale un resultado…). La API solo las lista, las cuenta y las marca como leídas. Solo en la web: ni Discord ni email.

| Endpoint | Para qué |
|---|---|
| `GET /api/v1/notifications` | **Menú de la campana**: las últimas 100 de la cuenta. Filtros `unread`, `actionable` (de aceptar o rechazar, sin resolver) y `category`; `sort`: **`created_at` desc** |
| `GET /api/v1/notifications/unread-count` | **Número de la campana**: `{ unread, actionable }`. Responde con `ETag`: con `If-None-Match`, `304` si no cambió |
| `POST /api/v1/notifications/read` | `{ ids: [..] }` (hasta 100) o `{ all: true }`. `204` |
| `PATCH /api/v1/me/profile` | `preferences.notifications`: `{ categoría: true \| false }`. `GET /me/profile` devuelve el mapa completo |

Todo con sesión (`401` sin ella).

### Cuándo consultar

- **Contador:** cada **30 segundos**, al **enfocar la pestaña** y **justo después de una acción propia** (aceptar, rechazar, marcar). Siempre con `If-None-Match`.
- **Lista:** al abrir el menú, no en segundo plano.
- Sin SSE ni WebSocket por ahora. Si algún día llega, los endpoints sirven igual: solo cambia quién avisa que hay algo nuevo.

### Cada notificación

```json
{
  "id": 7,
  "type": "team_invite",
  "category": "team",
  "data": { "invite_id": "…", "team": { "id": "…", "name": "Furia Sur", "tag": "FUR" } },
  "actionable": true,
  "resolution": null,
  "actor": { "id": "…", "alias": "Kova" },
  "created_at": "2026-10-25T12:00:00Z",
  "read": false
}
```

- **El texto lo arma el frontend** con `type` y `data`. `data` guarda los nombres del momento: si el equipo cambia de nombre después, la notificación vieja sigue diciendo el de antes.
- **`actor`:** quién la provocó (`null` si fue el sistema: el servidor, el cierre automático). A nadie le llega una notificación por algo que hizo él mismo, salvo el cambio de contraseña.
- **`actionable` y `resolution`:** la invitación a un equipo y el pedido para entrar se aceptan o rechazan desde la lista con sus endpoints de siempre (`POST /team-invites/{invite_id}/accept`, `/join-requests/{invite_id}/accept`, etc.). Al resolverse (desde donde sea) la notificación queda con `resolution`: `accepted`, `rejected`, `cancelled` o `expired`. Mostrar "Aceptada", "Rechazada", "Cancelada" o "Venció" en lugar de los botones.
- **Tope:** se guardan las últimas 100 por cuenta.

### Categorías y preferencias

| Categoría | Nombre en la web | Por defecto |
|---|---|---|
| `team` | Equipos | Prendida |
| `tournament` | Torneos | Prendida |
| `pcw` | PCW | Prendida |
| `elo` | Mixes y ELO | Prendida |
| `season` | Temporadas | Prendida |
| `account` | Cuenta | Prendida |
| `news` | Novedades (torneo nuevo y temporada nueva) | **Apagada** |
| `admin` | Administración (solo la ven los admins) | Prendida |

- **Obligatorias:** `team_invite`, `team_join_request` y `password_changed` llegan aunque su categoría esté apagada. En la pantalla de preferencias, aclararlo debajo de Equipos y de Cuenta.
- Una categoría apagada **no guarda** las notificaciones: prenderla de nuevo no trae las de antes.

### Tipos (primera etapa)

**Destinatarios:** líder = el capitán del equipo; roster = los miembros activos con cuenta (en un torneo, los inscritos).

#### Equipos (`team`)
| `type` | Le llega a | `data` | Texto sugerido | Link |
|---|---|---|---|---|
| `team_invite` | Invitado | `invite_id`, `team` | "{actor} te invitó a {team.name}" | Aceptar / Rechazar |
| `team_join_request` | Líder | `invite_id`, `team`, `player` | "{player.alias} quiere entrar a {team.name}" | Aceptar / Rechazar |
| `team_invite_answered` | Líder | `team`, `player`, `accepted` | "{player.alias} aceptó (o rechazó) tu invitación a {team.name}" | `/teams/{team.id}` |
| `team_join_answered` | Jugador | `team`, `accepted` | "{team.name} aceptó (o rechazó) tu pedido" | `/teams/{team.id}` |
| `team_captain` | Nuevo líder | `team` | "Ahora eres el líder de {team.name}" | `/teams/{team.id}` |
| `team_removed` | Jugador | `team` | "Te sacaron de {team.name}" | — |
| `team_member_left` | Líder | `team`, `player` | "{player.alias} dejó {team.name}" | `/teams/{team.id}` |
| `team_role_changed` | Jugador | `team`, `role` (`player`, `sub`, `coach`) | "Ahora eres Activo / Suplente / Coach en {team.name}" | `/teams/{team.id}` |
| `team_added` | Jugador | `team`, `role` | "Un admin te sumó a {team.name}" | `/teams/{team.id}` |
| `team_deleted` | Roster | `team` | "Se borró el equipo {team.name}" | — |
| `team_request_answered` | El que pidió | `name`, `tag`, `approved` | "Aprobaron (o rechazaron) tu equipo {name}" | `/myteam` |

#### Torneos (`tournament`)
`match`: `match_id`, `kind`, `team1`, `team2`, `event` (`id`, `name` o null) y `starts_at`, en todos los que hablan de una partida.

| `type` | Le llega a | `data` | Texto sugerido | Link |
|---|---|---|---|---|
| `event_registration` | Líder | `event`, `team`, `registered` | "El organizador inscribió (o dio de baja) a {team.name} en {event.name}" | `/events/{event.id}` |
| `event_fixture` | Roster inscrito | `event`, `team`, `match_id`, `opponent` | "Fixture listo en {event.name}: tu primer rival es {opponent.name}" | `/match/{match_id}` |
| `match_scheduled` | Roster de los dos | `match` + `previous` | "{team1} vs {team2}: nuevo horario {starts_at}" | `/match/{match_id}` |
| `veto_turn` | Líder al que le toca | `match` + `action` (`ban` o `pick`) y `last` (lo que hizo el rival) | "Te toca vetar: {action} un mapa" | `/match/{match_id}` |
| `veto_done` | Roster de los dos | `match` + `maps` (`map`, `version`) | "Veto terminado: {maps}" | `/match/{match_id}` |
| `veto_reset` | Los dos líderes | `match` | "El organizador reinició el veto" | `/match/{match_id}` |
| `match_result` | Roster de los dos | `match` + `score1`, `score2`, `winner`, `walkover`, `corrected` | "Resultado: {team1} {score1}-{score2} {team2}" ("corregido" o "W.O.") | `/match/{match_id}` |
| `event_progress` | Roster | `event`, `team`, `result` (`champion` o `runner_up`) | "¡{team.name} es campeón de {event.name}!" | `/events/{event.id}` |
| `event_cancelled` | Roster inscrito | `event` | "Se canceló {event.name}" | — |

#### PCW (`pcw`)
| `type` | Le llega a | `data` | Texto sugerido | Link |
|---|---|---|---|---|
| `pcw_accepted` | Quien publicó y su roster | `match` + `rival` | "{rival.name} aceptó tu PCW" | `/match/{match_id}` |
| `pcw_cancelled` | Los dos rosters | `match` | "Se canceló la PCW {team1} vs {team2}" | — |
| `pcw_result` | Los dos rosters | como `match_result` | "Resultado de la PCW: …" | `/match/{match_id}` |

#### Mixes y ELO (`elo`)
| `type` | Le llega a | `data` | Texto sugerido | Link |
|---|---|---|---|---|
| `level_changed` | Jugador | `from`, `to`, `elo` | "Subiste (o bajaste) a nivel {to}" | Perfil |
| `mix_review_resolved` | Los que jugaron | `match_id`, `map`, `applied` | "El mix interrumpido en {map}: el admin aprobó (o descartó) el ELO" | `/match/{match_id}` |
| `mix_deleted` | Los que jugaron | `map`, `played_at`, `elo_mode` (`keep`, `revert`, `none`) | "Se borró el mix en {map}: se mantuvo (o se revirtió) tu ELO" | — |
| `elo_adjusted` | Jugador | `delta`, `set_elo`, `reason`, `removed` | "Un admin te ajustó el ELO: {±delta} · {reason}" (o "Fijado en {set_elo}"; `removed`: "se deshizo") | Perfil |
| `clip_ready` | El de la jugada | `clip_id`, `match_id`, `round`, `kills`, `clutch_vs` | "Tu jugada de la ronda {round} ya tiene video" | `/match/{match_id}` |

#### Temporadas (`season`)
| `type` | Le llega a | `data` | Texto sugerido | Link |
|---|---|---|---|---|
| `season_ranked` | Jugador | `season`, `min_matches` | "Ya tienes puesto en la temporada {season.name}" | `/ranking` |
| `season_closed` | Los que jugaron la temporada | `season`, `rank`, `eligible`, `elo`, `elo_after`, `medal` (`name`, `icon` o null) | "Cerró {season.name}: terminaste {rank}.º" + medalla; si `elo_after` ≠ `elo`, "empiezas la próxima con {elo_after}" | Perfil |
| `medal_granted` | Jugador | `title`, `icon` | "Nueva medalla: {title}" | Perfil |

#### Cuenta (`account`)
| `type` | Le llega a | `data` | Texto sugerido | Link |
|---|---|---|---|---|
| `steam_claimed` | Usuario | `player`, `nick` | "Tu SteamID quedó vinculado con !claim" | `/profile/link` |
| `steam_request_answered` | Usuario | `kind` (`add` o `remove`), `approved`, `reason` | "Aprobaron (o rechazaron) tu pedido de {vincular / desvincular} un SteamID" | `/profile/link` |
| `alias_changed` | Usuario | `alias` | "Un admin cambió tu alias a {alias}" | `/profile` |
| `role_changed` | Usuario | `role` | "Ahora eres {organizador / admin / usuario}" | — |
| `password_changed` | Usuario (obligatoria) | `at` | "Se cambió la contraseña de tu cuenta. Si no fuiste tú, avísale a un admin" | `/profile/account` |

#### Novedades (`news`, apagada por defecto)
| `type` | `data` | Texto sugerido | Link |
|---|---|---|---|
| `event_new` | `event`, `starts_on` | "Nuevo torneo: {event.name}" | `/events/{event.id}` |
| `season_started` | `season`, `ends_at` | "Empezó la temporada {season.name}" | `/ranking` |

#### Administración (`admin`, solo admins)
| `type` | `data` | Texto sugerido | Link |
|---|---|---|---|
| `admin_steam_request` | `kind`, `player` | "Pedido de {kind} un SteamID de {player.alias}" | Admin → Jugadores |
| `admin_team_request` | `name`, `tag`, `user` | "{user.alias} pidió crear el equipo {name}" | Admin → Equipos |
| `admin_mix_review` | `match_id`, `map` | "Mix interrumpido en {map}: falta decidir el ELO" | `/match/{match_id}` |
| `admin_demo_failed` | `match_id`, `map` | "No se pudo subir la demo del mix en {map}" | Admin → Demos |
| `admin_season_delayed` | `season_id` | "El cierre de la temporada espera a que termine un mix en vivo" | Admin → Temporadas |

### Segunda etapa (todavía no)

Necesitan una tarea programada: partida de torneo o PCW en 1 hora, PCW vencida sin rival, temporada por terminar y partida de torneo sin resultado después de su horario.

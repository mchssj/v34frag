# Contrato para el frontend

Fecha: 2026-10-19. Reúne **todas las decisiones de diseño que afectan al frontend nuevo**, de todas las fases del backend: base y Auth, Mi perfil, replanteo del modelo de datos, `!match`, formatos de PCW, jugadores y equipos, partidas, torneos, PCW, ELO, listados, admin de servidores, configuración del ELO, demos, perfiles sin reclamar, `!claim`, mixes en vivo e interrumpidos la plantilla de grupos de doble eliminación con sorteo las preferencias de la cuenta, el cambio de contraseña, mis partidas y el estado de los servidores. El registro de todas las decisiones, con su fecha y su origen, está en [`decisiones.md`](decisiones.md). Reemplaza como referencia única a [`2026-10-14-decisiones-para-frontend.md`](../2026-10-14-decisiones-para-frontend.md), que queda como historia.

**La API de dominio está completa** (2026-10-16): todos los endpoints de este documento están **disponibles** en la rama `feat/backend-api-fase-1`, probados contra la Supabase local con el esquema nuevo (migraciones del replanteo 01 a 19).

Los nombres exactos de endpoints, campos y tipos son los de la OpenAPI (`GET /api/openapi.json`). Si este documento y la OpenAPI no coinciden en un detalle, manda la OpenAPI. Las decisiones de diseño (qué se muestra, a quién y con qué reglas) mandan acá.

**Estado de cada parte:**

| Marca | Significa |
|---|---|
| **Disponible** | Implementado y probado en el backend (rama `feat/backend-api-fase-1`), sobre la Supabase local |
| **En implementación** | Aprobado; se está construyendo |
| **Pendiente** | Decidido a grandes rasgos, sin plan de endpoints todavía |

Nada está en producción: el backend y el esquema nuevo se publican juntos en el corte.

## Módulos

Cada archivo conserva el número de sus secciones, así las referencias de la bitácora ("sección 5b") siguen sirviendo.

| Archivo | Secciones | Qué tiene |
|---|---|---|
| [`api.md`](api.md) | 1 | Cómo se consume la API: URL, sesión, errores, listados (paginación, filtros y orden) |
| [`cuenta.md`](cuenta.md) | 2 y 4 | Cuenta, Mi perfil, preferencias, contraseña, mis partidas y alias |
| [`modelo-datos.md`](modelo-datos.md) | 3 | Qué cambia respecto de la web vieja |
| [`jugadores.md`](jugadores.md) | 5, 5b y 5c | Jugadores, perfiles sin reclamar, `!claim`, varios SteamID por cuenta, ranking de jugadores y comparador |
| [`equipos.md`](equipos.md) | 6 y 7 | Equipos, plantel y ranking de equipos |
| [`partidas.md`](partidas.md) | 8, 8c, 8d, 8e, 8g y 8h | Partidas, `!match`, PCW, ELO, mixes en vivo, estado de los servidores, clips y estadísticas estilo HLTV |
| [`torneos.md`](torneos.md) | 8b | Torneos, plantillas y sorteo |
| [`temporadas.md`](temporadas.md) | 8f | Temporadas: ranking por temporada, medallas y reinicio del nivel 10 |
| [`admin.md`](admin.md) | 9 | Admin |
| [`notificaciones.md`](notificaciones.md) | 12 | Notificaciones: lista, contador con ETag, marcar como leídas, tipos, categorías y preferencias |
| [`decisiones.md`](decisiones.md) | 11 | Registro de todas las decisiones, con fecha y origen |

**Al cambiar algo del backend:** se actualiza el archivo de su módulo, las novedades de abajo y [`decisiones.md`](decisiones.md).

## 0. Novedades desde la entrega del 2026-10-15

Lo que cambió o se sumó. Los puntos marcados **(rompe)** cambian algo que ya existía: revisar el código que lo use.

| Tema | Qué cambió | Dónde |
|---|---|---|
| **Listados (rompe)** | Todo `GET` de lista pagina, filtra y ordena en el servidor y responde `{ items, total, page, per, sort, order }`. `sort` fuera de la lista cerrada da `400` | Sección [1](api.md), "Listados" |
| **Detalles sin listas (rompe)** | La ficha del jugador, el equipo y el torneo ya no traen sus listas: van en sub-endpoints (`/players/{id}/map-stats`, `/medals`, `/teams`; `/teams/{id}/members`; `/events/{id}/registrations`, `/matches`, `/standings`) | Secciones [5](jugadores.md), [6](equipos.md) y [8b](torneos.md) |
| **Chat de partida (rompe)** | Pagina por cursor: `before`, `after`, `limit`; responde `{ items, has_more, limit }` | Sección [8](partidas.md) |
| **Mis PCW (rompe)** | `GET /api/v1/me/pcw` se dividió en `/me/pcw/post` (el anuncio abierto) y `/me/pcw/matches` (las prácticas) | Sección [8](partidas.md) |
| **Ranking (rompe)** | `points` pasó a `points_per_win` en la respuesta (los puntos de cada fila siguen en `points`) | Sección [7](equipos.md) |
| **Reclamos de perfil (rompe)** | Se borraron `/api/v1/me/profile-requests` y `/api/v1/admin/profile-requests`. El vínculo con el juego es `!claim` | Sección [5b](jugadores.md) |
| **Perfil sin reclamar** (nuevo) | Página pública por SteamID para quien jugó sin ficha; no va al ranking. El detalle de partida trae `steam_id` de los jugadores sin ficha para enlazarla | Sección [5b](jugadores.md) |
| **`!claim`** (nuevo) | Código en Mi perfil, `!claim <código>` en el servidor, varios SteamID por ficha con aprobación del admin. La ficha trae `steam_ids` | Secciones [5b](jugadores.md) y [9](admin.md) |
| **Admin de servidores** (nuevo) | Alta con token y cfg, licencia, IP permitida, revocar, borrar | Sección [9](admin.md) |
| **Configuración del ELO** (nuevo) | Lectura pública y vista previa (la simulación y el recálculo se borraron el 2026-10-21) | Secciones [8c](partidas.md) y [9](admin.md) |
| **Demos** (nuevo) | Resumen, listado, reintentar una demo perdida, tokens del Worker | Sección [9](admin.md) |
| **Doble confirmación** (nuevo) | Generar un token nuevo del Worker (y desde el 2026-10-21 deshacer un ajuste de ELO y terminar una temporada; recalcular ya no existe) piden escribir "estoy seguro"; la API exige `confirm` | Sección [9](admin.md) |
| **Sesión** (aclaración) | El `refresh_token` rota pero no es estrictamente de un solo uso: guardar siempre el último | Sección [1](api.md), "Sesión" |
| **Mixes en vivo** (nuevo, 2026-10-17) | `GET /api/v1/mixes/live` y su detalle: marcador, rondas y stats parciales de los mixes que se están jugando. El detalle de una partida de torneo o PCW trae `live` con el mapa en juego | Sección [8d](partidas.md) |
| **Preferencias de la cuenta** (nuevo, 2026-10-18) | `GET`/`PATCH /api/v1/me/profile` con `preferences.theme_fx` (efectos al cambiar de tema), guardado en la cuenta | Sección [2](cuenta.md) |
| **Grupos de doble eliminación** (nuevo, 2026-10-18) | Plantilla `groups_double`: cada grupo juega una doble eliminación (1.º gana la final del upper, 2.º y 3.º salen de la final del lower) y los clasificados van a playoffs. La tabla del grupo llega con `stage: "group_double"` | Sección [8b](torneos.md) |
| **Sorteo** (nuevo, 2026-10-18) | `POST /api/v1/events/{id}/draw` mezcla la siembra al azar; el detalle del torneo trae `draw` (cuándo y quién) | Sección [8b](torneos.md) |
| **Contrato por módulos** (2026-10-19) | Este contrato pasó de un solo archivo (`contract.md`) a uno por módulo. El contenido es el mismo y los números de sección se mantienen | Este índice |
| **Cambiar la contraseña** (nuevo, 2026-10-19) | `POST /api/v1/me/password`: pide la actual, cierra las demás sesiones y devuelve una sesión nueva | Sección [2](cuenta.md) |
| **Mis partidas** (nuevo, 2026-10-19) | `GET /api/v1/me/matches`: el historial de la cuenta con sesión, sin buscar el id de la ficha | Secciones [1](api.md) y [2](cuenta.md) |
| **Estado de los servidores** (nuevo, 2026-10-19) | `GET /api/v1/servers/status` (público): prendidos, mapa y jugadores de cada servidor, más totales. `GET /api/v1/matches` suma el filtro `server` | Secciones [1](api.md) y [8e](partidas.md) |
| **Ping, modo, región y mixes en vivo de los servidores** (nuevo, 2026-10-19) | `GET /api/v1/servers/status` suma `mode`, `region`, `ping_ms` (latencia desde el backend, no el ping del jugador) y `live_matches` en cada servidor, y `totals.live_matches`. El admin de servidores carga el modo y la región | Secciones [8e](partidas.md) y [9](admin.md) |
| **Desvincular un SteamID y elegir el principal** (nuevo, 2026-10-19) | Desde Mi perfil: `POST /api/v1/me/steam/{steamid}/unlink` (pedido que aprueba un admin en la misma bandeja, `kind: "remove"`) y `POST /api/v1/me/steam/{steamid}/primary` (sin aprobación, una vez cada 24 horas). `GET /api/v1/me/claim-code` suma `added_at` (cuándo se vinculó) y `unlink_pending` en cada SteamID; los pedidos suman `kind` y `note` | Secciones [5b](jugadores.md) y [9](admin.md) |
| **Cancelar el pedido de desvincular y fecha del cambio de contraseña** (nuevo, 2026-10-19) | `DELETE /api/v1/me/steam/{steamid}/unlink` cancela el pedido pendiente (queda `status: "cancelled"`, un estado nuevo de los pedidos de SteamID). El usuario (`/auth/me`, sesiones y `GET /api/v1/me/profile`) suma `password_changed_at`. `/auth/me` con una sesión cerrada (por ejemplo, después de cambiar la contraseña en otro dispositivo) ahora responde `401` y no `500` | Secciones [1](api.md), [2](cuenta.md), [5b](jugadores.md) y [9](admin.md) |
| **Sin recalcular el ELO (rompe)** (2026-10-21) | Se borraron `POST /api/v1/admin/elo/recompute` y `POST /api/v1/admin/elo/simulate`. `PUT /api/v1/admin/elo/config` recibe solo `{ config }`, vale para los mixes nuevos y responde `{ config }` (sin `recomputed`) | Sección [9](admin.md) |
| **Ajustes manuales de ELO** (nuevo, 2026-10-21) | El admin suma, resta o fija el ELO de hasta 10 jugadores con un motivo (`/api/v1/admin/elo/adjustments`) y puede deshacerlo (doble confirmación). El jugador los ve en su ficha: `GET /api/v1/players/{id}/elo-adjustments` | Secciones [5](jugadores.md), [8c](partidas.md) y [9](admin.md) |
| **Temporadas** (nuevo, 2026-10-21) | `GET /api/v1/seasons`, `/seasons/current` (cuenta regresiva) y `/seasons/{id}/standings` (en vivo o la foto del cierre); `GET /api/v1/players/{id}/seasons`. Las medallas suman `season` y `rank`. Admin: configuración, abrir, cambiar la activa, vista previa del cierre y "Terminar temporada" con doble confirmación. `peak_elo` pasa a ser el pico de la temporada | Secciones [5](jugadores.md), [8f](temporadas.md) y [9](admin.md) |
| **Varios SteamID** (aclaración, 2026-10-19) | Resumen en la sección 5b y fila en el modelo de datos; Mi perfil aclara que `player.steam_id` es el principal | Secciones [3](modelo-datos.md) y [5b](jugadores.md) |
| **Mixes interrumpidos** (nuevo, 2026-10-17) | Un mix cortado por una caída queda cancelado con `cancel_reason: "crash"` y `review: "pending"`; un admin aplica el ELO (con doble confirmación) o lo descarta. El resumen de partida suma `cancel_reason` y `review`; el detalle, `review_detail` | Secciones [8d](partidas.md) y [9](admin.md) |
| **Video de los clips** (nuevo, 2026-10-23) | Cada clip de `GET /api/v1/matches/{id}/clips` suma `video`: `status`, `url` (el `.mp4`, los primeros 15 días), `embed_url` (el reproductor de Google Drive, para siempre) y `seconds` | Sección [8g](partidas.md) |
| **Clips: jugadas destacadas** (nuevo, 2026-10-23) | `GET /api/v1/matches/{id}/clips`: ace, 4k, 3k y clutches ganados de la partida, ya ordenados y con los topes aplicados, con la ronda y el segundo de la demo. Escala y topes en `GET`/`PATCH /api/v1/admin/clips/config` | Secciones [8g](partidas.md) y [9](admin.md) |

| **Mixes: listado único** (nuevo, 2026-10-24) | `GET /api/v1/mixes`: en vivo, terminados y cancelados juntos, los en vivo primero. Cada fila con MVP (nivel, nick y rating), ronda actual, estado de la demo y `tv`. Atajos `mine=true` (pide sesión) y `hide_cancelled=true`. `GET /api/v1/mixes/stats`: en vivo ahora, jugadores, mapa más jugado y promedio de rondas de los últimos 30 días | Sección [8d](partidas.md) |
| **"Ver en TV"** (nuevo, 2026-10-24) | Los mixes en vivo (`/mixes`, `/mixes/live` y su detalle) traen `tv: { host, port }` para `steam://connect/{host}:{port}`; `GET /api/v1/servers/status` suma `tv_address`. El admin carga el puerto de SourceTV (`tv_port`) en cada servidor | Secciones [8d](partidas.md), [8e](partidas.md) y [9](admin.md) |
| **Borrar un mix** (nuevo, 2026-10-24) | `DELETE /api/v1/admin/mixes/{id}` con `{ elo: "keep" \| "revert", confirm }`: el admin elige si el ELO que dio el mix se mantiene o se revierte. Nunca recalcula la historia. El detalle de partida suma `demo_size` (bytes) | Secciones [8d](partidas.md) y [9](admin.md) |
| **Perfil por nick** (nuevo, 2026-10-24) | Todas las rutas públicas `/api/v1/players/{id}/…` aceptan el id o el nick (sin distinguir mayúsculas): la URL puede ser `/player/{nick}`. El nick es único en todas las fichas | Sección [5](jugadores.md) |
| **SteamID ocultos (rompe)** (2026-10-24) | `GET /api/v1/players/{id}` devuelve `steam_id: null` y `steam_ids: []` salvo al dueño y a los admins. "Verificado" es `has_steam` | Sección [5](jugadores.md) |
| **Jugador inexistente (rompe)** (2026-10-24) | Las sub-rutas de un jugador (`/matches`, `/map-stats`, `/medals`, `/teams`, `/seasons`, `/elo-adjustments`) responden `404` si el id o el nick no existe (antes, una lista vacía) | Sección [5](jugadores.md) |
| **Perfil: historial de ELO, palmarés y logros** (nuevo, 2026-10-24) | `GET /api/v1/players/{id}/elo-history` (gráfico), `/titles` (campeón y subcampeón de torneos, con equipo y fecha) y `/medals/summary` (medallas agrupadas con `count`). Las partidas del jugador suman `event` y `label` (fase) para armar el título y el subtítulo | Sección [5](jugadores.md) |
| **Ranking de jugadores y comparador** (nuevo, 2026-10-24) | `GET /api/v1/ranking/players`: posición global (no cambia al filtrar), filtro `level` (`10`, `7-9`, `1-6`) y `elo_trend` (últimos 30 mixes). `GET /api/v1/players/compare?a=&b=`: stats de dos jugadores, su ELO en los últimos 30 mixes y los mixes juntos y como rivales | Sección [5c](jugadores.md) |
| **Estadísticas de partida estilo HLTV** (2026-10-25) | `PlayerLine` (detalle del mix) suma `k2`–`k5`, `first_kills`, `first_deaths`, `plants`, `defuses` y `clutches`; la partida, `clutch_data`. La foto en vivo suma lo mismo sin `clutches`. `stats` de la ficha suma los totales y `clutches` | Secciones [8h](partidas.md) y [5](jugadores.md) |
| **Notificaciones** (nuevo, 2026-10-25) | `GET /api/v1/notifications` (lista), `/notifications/unread-count` (contador con ETag: consultarlo cada 30 s, al enfocar y tras una acción) y `POST /notifications/read`. Las crea la base; el texto lo arma el front con `type` y `data`. Preferencias por categoría en `preferences.notifications` de `/me/profile` (`news` apagada por defecto; tres obligatorias) | Sección [12](notificaciones.md) |
| **Líder en el historial de equipos y orden de los sin puesto** (2026-10-24) | `GET /api/v1/players/{id}/teams` suma `is_captain` en cada fila. En `GET /api/v1/seasons/{id}/standings` y en la vista previa del cierre, los que no llegan al mínimo van al final por ELO de mayor a menor (antes, de menor a mayor) | Secciones [5](jugadores.md) y [8f](temporadas.md) |
| **Ranking de equipos** (2026-10-24) | Cada fila suma `win_rate`, `trend` (puestos que subió o bajó desde hace 30 días) y `form` (últimos 5 resultados) | Sección [7](equipos.md) |
| **Catálogo de mapas y pools propios** (2026-10-25) | `GET /api/v1/maps` es el catálogo de todos los mapas: cada uno suma `mixes` (sale en el select de Mixes), `veto_default` (pool por defecto del veto) e `image_url` (foto, para todas sus versiones); `active` pasa a ser "disponible" (`false` = retirado). Filtros `mixes` y `veto_default`. `PUT /api/v1/admin/maps` **ya no borra (rompe)**: tiene que traer todos los mapas. Foto: `POST`/`DELETE /api/v1/admin/maps/{name}/image` (hasta 2 MB). Torneos (`EventCreate`, `EventPatch`, detalle) y anuncios de PCW suman `map_pool` (null = pool por defecto); el veto de cada partida usa el suyo | Secciones [8b](torneos.md), [8h](partidas.md) y [9](admin.md) |
| **Rating, K/D y equipos en el ranking de una temporada** (2026-10-25) | `GET /api/v1/seasons/{id}/standings` suma `teams` (equipos oficiales actuales), `rating` y `kd` (de los mixes de la temporada; guardados en la foto del cierre), los filtros `level` (`10`, `7-9`, `1-6`) y `team`, y el orden por `rating` y `kd` | Sección [8f](temporadas.md) |
| **Aviso de `!claim` (aclaración)** (2026-10-25) | La ficha sin cuenta ya no muestra "¿Sos vos? Vinculala con `!claim`". El perfil sin reclamar muestra "¿Este SteamID es tuyo? Vincúlalo desde tu cuenta" con un botón a `/profile/link`. Sin cambios en la API | Sección [5b](jugadores.md) |
| **Pedidos de Mixes** (2026-10-25) | `GET /api/v1/mixes/live/{uid}`: el `404` de un mix que ya terminó trae `error.details.match_id`. `PlayerLine` y `LivePlayerLine` suman `elo` y `level` (ELO actual). `MixItem` suma `review` (chip "ELO pendiente"). Sin cambios que rompan | Sección [8](partidas.md) |

El chat de texto del servidor (vivos y muertos leen todo) y la voz por fases son cosas del servidor de juego: no afectan a la web.

## 10. Lo que todavía no está definido

- El dominio y las URLs de producción.

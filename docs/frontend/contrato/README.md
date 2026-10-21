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
| [`jugadores.md`](jugadores.md) | 5 y 5b | Jugadores, perfiles sin reclamar, `!claim` y varios SteamID por cuenta |
| [`equipos.md`](equipos.md) | 6 y 7 | Equipos, plantel y ranking de equipos |
| [`partidas.md`](partidas.md) | 8, 8c, 8d y 8e | Partidas, `!match`, PCW, ELO, mixes en vivo y estado de los servidores |
| [`torneos.md`](torneos.md) | 8b | Torneos, plantillas y sorteo |
| [`temporadas.md`](temporadas.md) | 8f | Temporadas: ranking por temporada, medallas y reinicio del nivel 10 |
| [`admin.md`](admin.md) | 9 | Admin |
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
| **Configuración del ELO** (nuevo) | Lectura pública, vista previa, simulación y recálculo | Secciones [8c](partidas.md) y [9](admin.md) |
| **Demos** (nuevo) | Resumen, listado, reintentar una demo perdida, tokens del Worker | Sección [9](admin.md) |
| **Doble confirmación** (nuevo) | Recalcular el ELO y generar un token nuevo del Worker piden escribir "estoy seguro"; la API exige `confirm` | Sección [9](admin.md) |
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
| **Temporadas** (nuevo, 2026-10-21) | `GET /api/v1/seasons`, `/seasons/current` (cuenta regresiva) y `/seasons/{id}/standings` (en vivo o la foto del cierre); `GET /api/v1/players/{id}/seasons`. Las medallas suman `season` y `rank`. Admin: configuración, abrir, cambiar la activa, vista previa del cierre y "Terminar temporada" con doble confirmación. `peak_elo` pasa a ser el pico de la temporada | Secciones [5](jugadores.md), [8f](temporadas.md) y [9](admin.md) |
| **Varios SteamID** (aclaración, 2026-10-19) | Resumen en la sección 5b y fila en el modelo de datos; Mi perfil aclara que `player.steam_id` es el principal | Secciones [3](modelo-datos.md) y [5b](jugadores.md) |
| **Mixes interrumpidos** (nuevo, 2026-10-17) | Un mix cortado por una caída queda cancelado con `cancel_reason: "crash"` y `review: "pending"`; un admin aplica el ELO (con doble confirmación) o lo descarta. El resumen de partida suma `cancel_reason` y `review`; el detalle, `review_detail` | Secciones [8d](partidas.md) y [9](admin.md) |

El chat de texto del servidor (vivos y muertos leen todo) y la voz por fases son cosas del servidor de juego: no afectan a la web.

## 10. Lo que todavía no está definido

- El dominio y las URLs de producción.

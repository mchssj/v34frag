# Contrato para el frontend: Jugadores, perfiles sin reclamar y `!claim`

> Parte del contrato para el frontend. Índice, estado y novedades: [`README.md`](README.md). Las decisiones de todos los módulos están en [`decisiones.md`](decisiones.md).

## 5. Jugadores (disponible)

- **URLs por nick o por id:** todas las rutas públicas `/api/v1/players/{id}/…` aceptan el id o el nick, sin distinguir mayúsculas (desde el 2026-10-24; el nick es único en todas las fichas). La página puede ser `/player/<nick>`. Ojo: el alias cambia (cada 15 días como mucho), así que para un enlace que tiene que durar conviene el id. Un id o nick que no existe da `404` en la ficha y en todas sus sub-rutas.
- **Nivel:** lo manda la API ya calculado (1 a 10). Tramos de ELO: 0, 501, 751, 901, 1051, 1201, 1351, 1531, 1751 y 2001. El frontend solo elige el ícono.

| Endpoint | Pantalla |
|---|---|
| `GET /api/v1/players` | **Jugadores** y **ranking de jugadores** (por defecto, ordenado por ELO): avatar, alias, nivel, ELO, partidas, equipos actuales, rating, K/D |
| `GET /api/v1/players/{id}` | **Ficha:** datos, ELO (actual, pico, partidas), nivel, stats, equipos actuales y datos personales. **Los SteamID nunca se muestran en el perfil público:** `steam_id` y `steam_ids` vienen solo para el dueño y los admins (para los demás, `null` y `[]`). La insignia "Verificado" sale de `has_steam` (tiene al menos un SteamID vinculado). El link de Steam de "Redes" es `details.steam` (el perfil que cargó el usuario), no el SteamID. Una ficha con SteamID pero sin cuenta (`has_account: false`) muestra "¿Sos vos? Vinculala con `!claim`". Si el perfil es privado y el usuario no puede verlos: `details: null` y `private: true` (mostrar "Perfil privado" en esa sección, no en toda la ficha) |
| `GET /api/v1/players/{id}/map-stats` · `/medals` · `/teams` | Pestañas de la ficha: stats por mapa, medallas e historial de equipos. Cada medalla trae `season` y `rank` si es de una temporada (`null` si la dio el admin a mano) |
| `GET /api/v1/players/{id}/medals/summary` | **Logros** del resumen: una fila por medalla distinta (`title`, `icon`) con `count` ("×3") y `last_at`. `sort`: **`count` desc** (también `last_at` y `title`). Sin medallas: "Todavía sin medallas." |
| `GET /api/v1/players/{id}/elo-history` | **Evolución de ELO** (gráfico con 10, 20 o 30 partidas): `match_id`, `map`, `at`, `elo_before`, `elo_after` y `elo_delta` de cada mix que movió su ELO. Por defecto `per=30`, **`at` desc** (el más nuevo primero): darlo vuelta para dibujar. Para 10 o 20, `per=10` o `per=20` |
| `GET /api/v1/players/{id}/titles` | **Palmarés** (pestaña "Bio y palmarés"): `event` (`id`, `name`), `result` (`champion` o `runner_up`), `team` con el que estaba inscrito y `at` (fecha de la final). Filtro `result`; `sort`: **`at` desc**. Texto sugerido: "Campeón Copa Invierno 2025 · Subcampeón Copa Aniversario" |
| `GET /api/v1/players/{id}/elo-adjustments` | **Ajustes de ELO** que le hizo un admin: `kind` (`delta`: sumó o restó; `set`: fijó el ELO en `set_elo`), `delta`, `reason` y `applied_at`. Mostrarlos en el historial de ELO de la ficha ("+20 · mix caído", "Fijado en 1500 · corrección"). `sort`: **`applied_at` desc** |
| `GET /api/v1/players/{id}/seasons` | Pestaña **Temporadas**: puesto, ELO, pico, mixes y medalla en cada temporada cerrada (sección [8f](temporadas.md)) |
| `GET /api/v1/players/{id}/matches` | **Partidas del jugador:** fecha, mapa, tipo, bandos, resultado, si ganó, sus stats, su cambio de ELO y el nombre que usó en el juego. Desde el 2026-10-24 también `event` (`id`, `name`; en un mapa jugado con `!match`, el torneo de su partida) y `label` (la fase: "Final", "Cuartos de final"…). **Título y subtítulo los arma el front:** en un mix, "Mix · {mapa}" y "{fecha} · {marcador}"; en un torneo, "{bando 1} vs {bando 2}" y "{event.name} · {label}" |

**ELO pico:** `peak_elo` es el pico de la **temporada activa** (al empezar cada temporada arranca en el ELO actual). El de cada temporada cerrada queda en `/players/{id}/seasons`.

## 5c. Ranking de jugadores y comparador (disponible desde el 2026-10-24)

| Endpoint | Pantalla |
|---|---|
| `GET /api/v1/ranking/players` | **Ranking → Jugadores**: `position` (global por ELO: **no cambia al filtrar**; empatados comparten posición), `player` (`id`, `alias`, `photo_url`), `level`, `elo`, `teams` (todos sus equipos oficiales: mostrar el primero y "+1" con un tooltip con los demás), `rating`, `kd`, `matches` (partidas terminadas), `elo_matches` (mixes), `country` y `game_role` (null si el perfil es privado o no tiene cuenta) y `elo_trend` (ELO después de cada uno de sus últimos 30 mixes, del más viejo al más nuevo, para el sparkline). Filtros: `q` (alias o equipo), `level` (`10`, `7-9` o `1-6`) y `team`. `sort`: **`position` asc** (también `rating`, `kd`, `matches`). Solo aparecen los que tienen ELO (jugaron al menos un mix en el servidor). El podio son los 3 primeros de la página 1 sin filtros |
| `GET /api/v1/players/compare?a=&b=` | **Comparar jugadores**: `a` y `b` aceptan id o nick (el front puede poner al usuario logueado como A por defecto). Cada lado: `player`, `teams`, `game_role`, `level`, `elo`, `rating`, `kd`, `hs` (%), `adr`, `win_rate` (%), `matches`, `elo_matches` y `elo_history` (últimos 30 mixes, del más viejo al más nuevo). `together`: `same_team` (`matches`, `wins`: mixes en el mismo bando y cuántos ganaron) y `against` (`matches`, `a_wins`: como rivales y cuántos ganó A). Texto sugerido: "Mixes jugados juntos: 7 · ganaron 4" o "Como rivales: 3 · {A} ganó 2". El mismo jugador dos veces da `400`; uno que no existe, `404` |

- **Nivel por chips:** `level=10` es 2001 o más; `7-9`, de 1351 a 2000; `1-6`, menos de 1351.
- **Mixes en "Mixes" del comparador:** usar `elo_matches` (mixes) y no `matches` (que suma PCW y torneos).

## 5b. Perfiles sin reclamar y `!claim` (disponible en la API; el comando del servidor sale con el plugin 2.2.0)

**Tres cosas distintas:** la **cuenta** (email, alias), la **ficha** de jugador (la página del jugador, va al ranking) y el **SteamID** (con el que el servidor registra cada partida). La ficha une una cuenta con sus SteamID.

**Una cuenta puede tener varios SteamID** (por ejemplo, juega desde dos PCs o en otro servidor que le da otro SteamID). El primero se vincula al instante con `!claim`; cada adicional se pide con `!claim` desde esa PC o ese servidor y lo aprueba un admin. Tope configurable (`max_steam_ids`, de 1 a 4, 3 por defecto). Un SteamID es de una sola cuenta, y la cuenta tiene **un solo ELO** que suma las partidas de todos sus SteamID. `!match` la reconoce desde cualquiera. La ficha (`steam_ids`) y `GET /api/v1/me/claim-code` traen la lista, con el principal primero.

**Perfil sin reclamar:** un SteamID que jugó y no es de ninguna ficha. **No es una ficha** y **no aparece en el ranking ni en la lista de jugadores**.

| Endpoint | Pantalla |
|---|---|
| `GET /api/v1/players/steam/{steamid}` | **Perfil sin reclamar:** último nombre que usó y los anteriores, ELO, nivel, stats, primera y última partida, y el cartel "Perfil sin reclamar: ¿sos vos? Registrate y usá `!claim` en el servidor". Si ese SteamID ya es de una ficha, responde `claimed: true` y `player_id`: redirigir a la ficha |
| `GET /api/v1/players/steam/{steamid}/matches` · `/map-stats` | Sus pestañas, igual que en la ficha |
| `GET /api/v1/players/unclaimed` | Buscar perfiles sin reclamar (aparte del ranking) |
| Detalle de partida | Cada jugador sin ficha trae `steam_id`: su nombre enlaza al perfil sin reclamar |

**Vincular el SteamID con `!claim`** (Mi perfil, tarjeta "Vincular con el servidor"):

| Endpoint | Qué hace |
|---|---|
| `POST /api/v1/me/claim-code` | Código de 6 caracteres, válido 10 minutos (hasta 5 por hora): `{ code, expires_at, command }`. El anterior sin usar deja de valer |
| `GET /api/v1/me/claim-code` | `steam_ids` (el principal primero; cada uno con `is_primary`, `added_at`: cuándo se vinculó, y `unlink_pending`), `max_steam_ids`, `last_code` (`status`: `pending`, `used` o `expired`, y `result`: el mensaje que vio el jugador) y `pending_requests` (los dos tipos de pedido). Consultarlo cada 5 segundos mientras el código está `pending` |
| `GET /api/v1/me/steam-requests` | Mis pedidos de SteamID: `kind` (`add`: adicional con `!claim`; `remove`: desvincular), `status` (`pending`, `approved`, `rejected` con `reason`, o `expired`) y `note` (mi motivo, en `remove`). Filtros `status` y `kind` |
| `POST /api/v1/me/steam/{steamid}/unlink` | **Pedir desvincular** un SteamID de mi ficha. Body opcional `{ reason }` (hasta 200 caracteres; lo ve el admin). `201` con el pedido. Lo aprueba un admin |
| `DELETE /api/v1/me/steam/{steamid}/unlink` | **Cancelar el pedido de desvincular** mientras siga pendiente. `204`. El pedido queda con `status: cancelled` y el SteamID sigue en la ficha |
| `POST /api/v1/me/steam/{steamid}/primary` | **Hacer principal** uno de mis SteamID adicionales, sin aprobación. `204`. Una vez cada 24 horas |

**Mis SteamID** (Mi perfil, lista de `steam_ids`):
- Cada SteamID muestra **cuándo se vinculó** (`added_at`, fecha y hora ISO). La fecha es del SteamID: no cambia al hacerlo principal. Si es `null` (SteamID que vinculó un admin antes de que se guardara la fecha), mostrar "Fecha desconocida".
- Cada SteamID adicional tiene "Hacer principal" y cada uno, "Desvincular", salvo que sea el único (la ficha no puede quedar sin SteamID: sin él no puede estar en un equipo).
- **Desvincular** abre una confirmación con un campo opcional "¿Por qué?". Queda **pendiente** hasta que un admin lo apruebe (vence a los 30 días): mostrar "Pedido para desvincular: falta que lo apruebe un admin" en el SteamID con `unlink_pending: true`, ocultar sus otros botones y mostrar **"Cancelar pedido"** (`DELETE /api/v1/me/steam/{steamid}/unlink`; después se puede volver a pedir). Al aprobarlo, las partidas de ese SteamID vuelven a quedar sin ficha (perfil sin reclamar) y el ELO de la ficha se recalcula sin ellas. Si era el principal, el adicional más viejo pasa a serlo.
- **Hacer principal** no cambia el ELO ni las partidas: solo cuál SteamID se muestra como principal. Si ya lo cambió en las últimas 24 horas, falla (`400`) con "Ya cambiaste tu SteamID principal en las últimas 24 horas…".
- Errores (`400`, mostrar `error.message`): "Ese SteamID no es de tu ficha", "Ya pediste desvincular ese SteamID…", "Es tu único SteamID: no se puede desvincular", "Ese SteamID tiene un pedido para desvincularlo: no puede ser el principal", "No tenés un pedido pendiente para desvincular ese SteamID" (al cancelar uno que ya resolvió un admin o que venció).
- Historial de pedidos (`GET /api/v1/me/steam-requests`): `status` puede ser `pending`, `approved`, `rejected` (con `reason`), `expired` (30 días) o `cancelled` (lo canceló el jugador).

1. El usuario genera el código y la tarjeta muestra el código grande, la cuenta regresiva y "Entrá al servidor y escribí `!claim K7P2QX`".
2. En el servidor escribe el comando. El servidor responde en el chat.
3. **Primer SteamID:** se vincula al instante. Si la cuenta no tenía ficha, se crea con su alias y todo el historial de ese SteamID. Funciona aunque nunca haya jugado (la ficha nace vacía y ya puede entrar a un equipo).
4. **SteamID adicional** (otra PC u otro servidor): queda **pendiente** hasta que lo apruebe un admin. Mostrar "Pedido enviado: un admin lo tiene que aprobar" y la lista de pedidos, con el aviso: "Hasta que un admin lo apruebe, `!match` no te reconoce desde esa PC" (en un torneo no puede jugar con su equipo desde ahí; en una PCW entra como stand-in).
5. Todos los SteamID de una ficha suman a **un solo ELO**.

Mensajes que puede ver el jugador en el servidor (`result`): "Listo: tu cuenta quedó vinculada", "Pedido enviado: un admin lo tiene que aprobar", "Tu cuenta ya está vinculada a este SteamID", "Ya pediste este SteamID…", "Llegaste al máximo de SteamID…", "Ese SteamID pertenece a otra cuenta", "Ese SteamID es de otra ficha…", "Ese SteamID tiene un pedido pendiente de otra cuenta", "Código inválido o vencido…", "Demasiados intentos…".

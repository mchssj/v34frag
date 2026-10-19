# Contrato para el frontend: Jugadores, perfiles sin reclamar y `!claim`

> Parte del contrato para el frontend. Índice, estado y novedades: [`README.md`](README.md). Las decisiones de todos los módulos están en [`decisiones.md`](decisiones.md).

## 5. Jugadores (disponible)

- **URLs por id:** `#jugador/<id>` (o la ruta equivalente). El alias cambia, así que no sirve como enlace permanente.
- **Nivel:** lo manda la API ya calculado (1 a 10). Tramos de ELO: 0, 501, 751, 901, 1051, 1201, 1351, 1531, 1751 y 2001. El frontend solo elige el ícono.

| Endpoint | Pantalla |
|---|---|
| `GET /api/v1/players` | **Jugadores** y **ranking de jugadores** (por defecto, ordenado por ELO): avatar, alias, nivel, ELO, partidas, equipos actuales, rating, K/D |
| `GET /api/v1/players/{id}` | **Ficha:** datos, ELO (actual, pico, partidas), nivel, stats, equipos actuales, `steam_ids` (todos sus SteamID, el principal primero) y datos personales. Una ficha con SteamID pero sin cuenta (`has_account: false`) muestra "¿Sos vos? Vinculala con `!claim`". Si el perfil es privado y el usuario no puede verlos: `details: null` y `private: true` (mostrar "Perfil privado" en esa sección, no en toda la ficha) |
| `GET /api/v1/players/{id}/map-stats` · `/medals` · `/teams` | Pestañas de la ficha: stats por mapa, medallas e historial de equipos |
| `GET /api/v1/players/{id}/matches` | **Partidas del jugador:** fecha, mapa, tipo, bandos, resultado, si ganó, sus stats, su cambio de ELO y el nombre que usó en el juego |
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
| `POST /api/v1/me/steam/{steamid}/primary` | **Hacer principal** uno de mis SteamID adicionales, sin aprobación. `204`. Una vez cada 24 horas |

**Mis SteamID** (Mi perfil, lista de `steam_ids`):
- Cada SteamID muestra **cuándo se vinculó** (`added_at`, fecha y hora ISO). La fecha es del SteamID: no cambia al hacerlo principal. Si es `null` (SteamID que vinculó un admin antes de que se guardara la fecha), mostrar "Fecha desconocida".
- Cada SteamID adicional tiene "Hacer principal" y cada uno, "Desvincular", salvo que sea el único (la ficha no puede quedar sin SteamID: sin él no puede estar en un equipo).
- **Desvincular** abre una confirmación con un campo opcional "¿Por qué?". Queda **pendiente** hasta que un admin lo apruebe (vence a los 30 días): mostrar "Pedido para desvincular: falta que lo apruebe un admin" en el SteamID con `unlink_pending: true` y ocultar sus botones. Al aprobarlo, las partidas de ese SteamID vuelven a quedar sin ficha (perfil sin reclamar) y el ELO de la ficha se recalcula sin ellas. Si era el principal, el adicional más viejo pasa a serlo.
- **Hacer principal** no cambia el ELO ni las partidas: solo cuál SteamID se muestra como principal. Si ya lo cambió en las últimas 24 horas, falla (`400`) con "Ya cambiaste tu SteamID principal en las últimas 24 horas…".
- Errores (`400`, mostrar `error.message`): "Ese SteamID no es de tu ficha", "Ya pediste desvincular ese SteamID…", "Es tu único SteamID: no se puede desvincular", "Ese SteamID tiene un pedido para desvincularlo: no puede ser el principal".

1. El usuario genera el código y la tarjeta muestra el código grande, la cuenta regresiva y "Entrá al servidor y escribí `!claim K7P2QX`".
2. En el servidor escribe el comando. El servidor responde en el chat.
3. **Primer SteamID:** se vincula al instante. Si la cuenta no tenía ficha, se crea con su alias y todo el historial de ese SteamID. Funciona aunque nunca haya jugado (la ficha nace vacía y ya puede entrar a un equipo).
4. **SteamID adicional** (otra PC u otro servidor): queda **pendiente** hasta que lo apruebe un admin. Mostrar "Pedido enviado: un admin lo tiene que aprobar" y la lista de pedidos, con el aviso: "Hasta que un admin lo apruebe, `!match` no te reconoce desde esa PC" (en un torneo no puede jugar con su equipo desde ahí; en una PCW entra como stand-in).
5. Todos los SteamID de una ficha suman a **un solo ELO**.

Mensajes que puede ver el jugador en el servidor (`result`): "Listo: tu cuenta quedó vinculada", "Pedido enviado: un admin lo tiene que aprobar", "Tu cuenta ya está vinculada a este SteamID", "Ya pediste este SteamID…", "Llegaste al máximo de SteamID…", "Ese SteamID pertenece a otra cuenta", "Ese SteamID es de otra ficha…", "Ese SteamID tiene un pedido pendiente de otra cuenta", "Código inválido o vencido…", "Demasiados intentos…".

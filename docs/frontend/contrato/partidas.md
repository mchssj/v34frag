# Contrato para el frontend: Partidas, `!match`, PCW, ELO y mixes en vivo

> Parte del contrato para el frontend. Índice, estado y novedades: [`README.md`](README.md). Las decisiones de todos los módulos están en [`decisiones.md`](decisiones.md).

## 8. Partidas, `!match` y PCW (disponible)

### Partidas

| Endpoint | Pantalla |
|---|---|
| `GET /api/v1/matches` | **Partidas, Resultados y Mixes** (filtros en la sección 1): `kind` `official` (torneo), `pcw` o `mix`. Cada una trae `label` con la fase ("Semifinal", "Grupo A · fecha 2", "Suizo · fase 1 · ronda 3"…), los dos bandos con equipo y marcador, y `parent_match_id` si es un mapa vinculado con `!match` |
| `GET /api/v1/matches/{id}` | **Detalle**: serie (`maps_detail`) y mapas jugados (`games`, cada uno es un mix con su propio detalle), roster de cada lado (en torneo, los inscritos; en PCW, el roster con invitados), servidor (para el botón "Conectar"), `demo_url` (mix), stats y MVP (mix), veto, código de `!match` y `viewer` (`can_veto`, `can_chat`, `can_manage`, `is_participant`) |
| `GET /api/v1/matches/{id}/chat` | Chat **por cursor**: sin parámetros, los últimos `limit` (50 por defecto, máximo 100); con `before=<id>`, los anteriores (historial); con `after=<id>`, los nuevos. Responde `{ items, has_more, limit }`, del más viejo al más nuevo |
| `POST /api/v1/matches/{id}/chat` · `DELETE /api/v1/chat/{id}` | Escribir (en torneos y PCW: los dos equipos, el organizador y los admins; en mixes, cualquiera con sesión) y borrar el propio |
| `POST /api/v1/matches/{id}/veto` (`{ map, version? }`) | Veto del capitán en su turno |
| `GET /api/v1/maps` | Pool del veto con versiones (`include_inactive=true` para el admin) |

- **Actualización en vivo:**
  - El detalle de partida y de torneo, y las partidas y tablas de un torneo, responden con `ETag`. Conviene consultar cada 3 a 5 segundos mandando `If-None-Match` con el último `ETag`.
  - Si no cambió, la API responde `304` sin cuerpo.
  - Para el chat se usa `after` con el id del último mensaje.
- **Veto:**
  - `veto.sequence` es la secuencia de bans y picks según el BO; `veto.next` dice a qué equipo y qué acción le toca (null si terminó).
  - `veto.maps_to_play` trae los mapas en orden con su versión, el decisivo al final.
  - Si el mapa tiene más de una versión (Inferno: `de_inferno` o `de_inferno_classic`), el pick pide elegirla. La versión del decisivo la fija el organizador (en PCW, la normal).
- **Demo:** `demo_url` viene armado cuando la demo está subida; si no, mostrar el estado (`pending`, `missing`, `expired`).

### `!match`

- **Código:**
  - Cada partida de torneo y PCW tiene un **código de 5 caracteres**, que viene en `link_code` del detalle **solo** para los integrantes de los dos equipos, el organizador y los admins.
  - En el servidor, un jugador de un equipo escribe `!match <código>` y alguien del otro lo confirma.
- **Resultado automático:**
  - Cada mapa terminado suma a la serie.
  - Cuando un equipo gana la serie, la partida se cierra sola y el torneo avanza solo: la llave, la ronda siguiente del suizo, los playoffs y el campeón.
  - **No hay pantalla para que los capitanes carguen el resultado.**
- **Si no se pudo jugar en el servidor:** en torneos, el organizador o el admin cargan el resultado (`POST /api/v1/matches/{id}/result`). Una PCW sin `!match` no tiene resultado; solo el admin puede cargarle uno.
- **Overtime:** no hay mapas empatados, el servidor juega overtime.

### Reglas para jugar

| Tipo | Regla |
|---|---|
| Torneo | En el servidor juegan **solo los jugadores inscritos** de cada equipo (sin stand-ins); el mínimo por lado es `players_min` del torneo |
| PCW | Para publicarla o aceptarla hacen falta **4 jugadores con cuenta** (roster de 1 a 7 entre cuentas e invitados). En el servidor cada lado puede sumar hasta **2 stand-ins**; al menos 3 del roster por lado para que cuente |

### PCW

| Endpoint | Pantalla |
|---|---|
| `GET /api/v1/pcw/posts` | Anuncios abiertos: formato, mapas, hora, nota, roster y, si juega como un equipo, cuál |
| `POST /api/v1/pcw/posts` | Publicar: `best_of` (de `GET /api/v1/pcw/formats`), `players`, `guests`, `team_id` opcional, `starts_at`, `maps`, `note`, `name` |
| `POST /api/v1/pcw/posts/{id}/accept` | Aceptar con el roster propio (`team_id` opcional). Devuelve el id de la partida: abrir su detalle |
| `GET /api/v1/me/pcw/post` · `GET /api/v1/me/pcw/matches` | **Mis PCW**: mi anuncio abierto (o `null`) y mis prácticas (`status` para ver las pendientes) |
| `DELETE /api/v1/pcw/posts/{id}` · `POST /api/v1/pcw/matches/{id}/cancel` | Cancelar mi anuncio o una práctica sin mapas jugados |

- **"Jugar como equipo":** el capitán o dueño de un equipo oficial puede elegirlo al publicar o aceptar. Todo el roster con cuenta tiene que ser de ese plantel y la PCW ganada suma al ranking del equipo (con `pcw=1`). El formulario puede cargar el plantel del equipo elegido.
- **Vencimiento:** una PCW que no se jugó a las 48 h de su hora se cancela sola.

### Formatos de PCW

| Endpoint | Notas |
|---|---|
| `GET /api/v1/pcw/formats` | Sin sesión. `{ formats: [1, 3, 5] }`. El formulario de publicar una PCW ofrece solo esos |
| `PUT /api/v1/admin/pcw/formats` | Solo admin. `{ formats: [1, 3] }`, al menos uno. Pantalla Admin → PCW con tres casillas (BO1, BO3, BO5) que no deja desmarcar la última |
## 8c. ELO y stats

| Tema | Decisión |
|---|---|
| A quién se le calcula | A cada **SteamID** que juega un mix en el servidor, tenga o no cuenta o ficha. Al vincular el SteamID a un jugador, su ELO y su historial aparecen completos en la ficha (no se recalcula: ya estaba al día) |
| Valor inicial | 1000 |
| Participación | Quien juega menos del **35 %** de las rondas no recibe ELO; desde el 90 % cuenta completo. Entre medio, proporcional. Valores configurables por el admin |
| Nivel | 1 a 10, calculado por la API con los tramos de la sección 5 |
| Stats | Solo de partidas terminadas en el servidor (mixes, y PCW y torneos con `!match`). Una partida cancelada no cuenta |
| Ranking de jugadores | Es el listado de jugadores ordenado por ELO (`GET /api/v1/players`) |
| Configuración | `GET /api/v1/elo/config`, sin sesión: los valores vigentes, para una página "Cómo se calcula el ELO". Un cambio vale para los mixes nuevos: no se recalcula el historial |
| Ajustes manuales | Un admin puede sumar, restar o fijar el ELO de un jugador, con un motivo. El jugador los ve en su ficha (`GET /api/v1/players/{id}/elo-adjustments`). Admin: sección [9](admin.md) |
## 8d. Mixes en vivo e interrumpidos (disponible)

El servidor manda una foto del mix al final de cada ronda. Si el servidor se cae (o se reinicia) con un mix en curso, al volver lo guarda como **interrumpido** con la última ronda, y un admin decide si cuenta para el ELO.

| Endpoint | Pantalla |
|---|---|
| `GET /api/v1/mixes/live` | **Mixes → En vivo**, arriba de la lista. Filtros: `server`, `player`, `map`, `stale`, `q`; orden `updated_at` (por defecto, desc) o `started_at`. Cada uno: servidor, mapa, bandos con marcador, `rounds_played` de `max_rounds`, `updated_at` (última ronda), `stale` y `parent_match_id` si se juega con `!match` |
| `GET /api/v1/mixes/live/{uid}` | **Detalle en vivo**: lo mismo, más `seq`, `rounds` (ganador y lado del bando 1 en cada ronda) y `players` (stats parciales por bando, con `alias` si tiene ficha o `steam_id` para el perfil sin reclamar). `404` cuando terminó: ir al detalle de la partida |
| `GET /api/v1/matches?review=pending` | Mixes interrumpidos pendientes de revisión (también `applied` y `discarded`) |
| `GET /api/v1/matches/{id}` | `review_detail` en un interrumpido; `live` en una partida de torneo o PCW con un mapa en juego |

- **Refresco:** consultar el listado cada 20 segundos y el detalle con `If-None-Match` (responde `304` hasta la próxima ronda). Cuando un mix desaparece del listado, terminó: su resultado está en `GET /api/v1/matches?kind=mix`.
- **`stale: true`:** más de 10 minutos sin fotos. Mostrarlo atenuado ("sin novedades del servidor"). Al admin, ofrecer "Cerrar como interrumpido".
- **Marcador del mapa en juego de una serie** (`live` del detalle de partida): ya viene en el orden de los bandos de la partida (`score1` es el del equipo 1).
- **Un interrumpido en las listas:**
  - Cancelado con `cancel_reason: "crash"`: etiqueta "Interrumpida", más "ELO pendiente" mientras `review` sea `pending`.
  - Aprobado: queda terminado con `end_reason: "crash"` y su ganador. Etiqueta "Interrumpida".
- **Reglas para aprobar** (las valida la API; `review_detail` las trae calculadas):
  - Mínimo **35 %** de las rondas del mix (`min_rounds`), redondeado hacia arriba. Sin empate.
  - Gana el bando que iba adelante, y cuenta para el ELO, las victorias y las stats como cualquier mix terminado.
  - Si se jugaba con `!match`, al aprobarlo se vincula a su partida de torneo o PCW y suma el mapa. Si no se aprueba, el organizador puede cargar el resultado a mano.

## 8e. Estado de los servidores (disponible desde el 2026-10-19)

`GET /api/v1/servers/status`, **público** (sin sesión). Para la portada o un widget: cuántos servidores hay prendidos, cuántos jugadores y mixes en vivo tiene cada uno, su modo, su región y su latencia.

```json
{
  "servers": [
    { "id": "…", "name": "v34frag #1", "address": "ip:27062", "mode": "mix", "region": "Argentina",
      "online": true, "ping_ms": 18, "map": "de_inferno", "players": 10, "max_players": 12, "bots": 1, "live_matches": 1 }
  ],
  "totals": { "servers": 2, "online": 2, "players": 14, "live_matches": 1 },
  "checked_at": "2026-10-19T03:10:00Z"
}
```

- **Línea de totales** ("N partidas en vivo · N jugadores en el servidor"): `totals.live_matches` y `totals.players`.
- **`live_matches`:** mixes en vivo con foto en los últimos 10 minutos, los mismos que `GET /api/v1/mixes/live` muestra en curso (sección 8d). El total suma los de los servidores de la lista.
- **`mode`:** `mix`, `competitive` (torneos y PCW), `public`, `deathmatch`, `retakes` o `practice`. El frontend los traduce ("Mix", "Competitivo", "Público", "Deathmatch", "Retakes", "Práctica"). `null` si el admin no lo cargó: no mostrarlo.
- **`region`:** texto libre que carga el admin (por ejemplo "Argentina"). Se muestra tal cual. `null` si no está cargada.
- **`ping_ms`:** **no es el ping del jugador** (el navegador no puede medirlo: el juego usa UDP). Es la latencia de la consulta desde el backend hasta el servidor, en milisegundos. Sirve como indicador de que responde bien; si se muestra, que diga "latencia" o lleve un tooltip que lo aclare. `null` si no respondió.

- **Qué servidores:** los activos con licencia vigente.
- **Cómo lo sabe:** el backend le pregunta a cada uno con la consulta del navegador de servidores del juego (A2S).
- **`players`:** jugadores conectados, **sin bots ni SourceTV**.
- **Servidor que no responde en 1,5 s:** `online: false` y `ping_ms`, `map`, `players`, `max_players` y `bots` en `null` (`mode`, `region` y `live_matches` vienen igual). Mostrarlo como "Apagado" o "Sin respuesta".
- **Refresco:** la respuesta se guarda 20 s en el backend, así que no sirve consultar más seguido. Con `If-None-Match` responde `304` si no cambió.
- **`address`:** para el botón "Conectar" (`steam://connect/<address>`).
- **Filtro por servidor:** `GET /api/v1/matches?server=<id>` lista las partidas jugadas en ese servidor (el `id` sale de acá).
- **`501 NOT_AVAILABLE`:** solo si la API corre fuera de Node. En el VPS siempre está disponible.

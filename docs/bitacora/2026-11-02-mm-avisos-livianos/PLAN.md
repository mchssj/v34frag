# Plan: matchmaking con avisos que traen el dato y un estado liviano

> Planeación original. Estado: **aprobado por Daniel el 2026-11-02** (los cuatro puntos).

## Por qué

La medición del 2026-11-02 (desde la PC de Daniel contra staging):

| Qué | Resultado |
|---|---|
| Socket: de la base a la PC (20 avisos de prueba) | 20 de 20, **mediana 177 ms**, p90 569 ms |
| `mm_my_state()` en la base | ~40 ms (110 ms con la ida y vuelta) |
| `GET /api/v1/mm/state` (logs de la API, una hora, 235 pedidos) | **mediana 1 s · p90 13,9 s · máximo 42 s** |
| Otras rutas en la misma hora | `/seasons/current` promedio 6,8 s; `/ranking/players` promedio 2 s, máximo 32 s |

El socket anda bien. Lo lento es lo que pasa después de cada aviso: **la web vuelve a pedir el estado completo**. Y `queue.changed` va **a todos los que tienen abierta la pantalla de Jugar** cada vez que alguien entra o sale de la cola. Con 30 personas en Jugar, un jugador que entra a la cola genera 30 pedidos del estado completo (ELO, últimas partidas, amigos, sonidos, servidores, la sala con sus estadísticas…) solo para actualizar el contador. La carga crece con el cuadrado de la gente, y los picos frenan también otras rutas.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Alcance | Los cuatro puntos: avisos con el dato, "Partida encontrada" sin esperar a la API, estado liviano y pesado separados, y cada uno pide solo lo que le toca (Daniel, 2026-11-02) | El primero saca la mayor parte de la carga; los otros, lo que queda |
| Compatibilidad | Se mantiene `mm_my_state()` y `GET /api/v1/mm/state` mientras convivan la web vieja y la nueva | El despliegue no es atómico: primero la API, después la web |
| Seguridad | Ningún aviso lleva contraseñas, IP ni datos de otros que hoy no ve el destinatario | Los `NOTIFY` no son privados dentro de la base (regla de la `48`) |
| Red de seguridad | Con el socket caído, se reconecta o llega `resync`: estado completo como hoy. Mientras se está en la cola o en una sala, el estado liviano se vuelve a pedir cada 30 s | Un aviso perdido no puede dejar la pantalla trabada |
| El plugin | No cambia | Solo cambian la base, la API y la web |

## 1. Avisos que traen el dato

El aviso pasa de `{ t, lobby }` a `{ t, lobby, d }`. `d` es un objeto chico; `pg_notify` admite 8000 bytes y ninguno se acerca.

| Aviso | Hoy va a | `d` nuevo | La web, con `d` |
|---|---|---|---|
| `queue.changed` | **todos** | `{ size, by_mode: { "5v5": 7, … }, active }` | Actualiza el contador **sin pedir nada** |
| `lobby.found` | los de la sala | `{ mode, size, accept_deadline }` | Abre "Partida encontrada" en el acto (punto 2) |
| `lobby.accept` | los de la sala | `{ accepted, total, user_id }` | Marca quién aceptó, sin pedir nada |
| `lobby.veto` | los de la sala | `{ map, action, side, turn, deadline, done }` | Tacha el mapa y mueve el turno; si `done`, pide el estado liviano |
| `lobby.player` | los de la sala | `{ user_id, left_at, abandoned }` | Marca al jugador, sin pedir nada |
| `lobby.update`, `lobby.server`, `lobby.cancelled`, `lobby.finished` | los de la sala | `{ status }` | Pide el estado liviano (cambia la etapa) |
| `lobby.chat` | los de la sala (o del equipo) | igual que hoy | Pide solo el chat, como hoy |
| `party.*`, `friend.searching`, `mm.config` | los que corresponda | igual que hoy | `party.*`: estado liviano; `mm.config`: estado completo |

- **Base:** `mm_emit(p_type, p_lobby, p_users, p_data jsonb default null)`. El trigger de `mm_queue` calcula los tamaños de la cola en el mismo momento (una consulta chica por cambio).
- **API (`mm/socket.ts`):** `dispatch` reenvía `d` además de `t` y `lobby`.

## 2. "Partida encontrada" sin esperar a la API

Con `lobby.found` y su `d`, la web arma una sala mínima (modo, tamaño y plazo para aceptar) y abre la ventana con su sonido y su cuenta regresiva **en lo que tarda el socket** (~0,2 s). El detalle (los jugadores, el ELO) llega después con el estado liviano. El botón "Aceptar" funciona desde el primer momento: `POST /api/v1/mm/lobby/accept` no necesita nada más.

## 3. Estado liviano y estado pesado

La base separa `mm_my_state()` en dos (y `mm_my_state()` las junta, por compatibilidad):

| | `mm_my_live()` → `GET /api/v1/mm/state/live` | `mm_my_profile()` → `GET /api/v1/mm/profile` |
|---|---|---|
| Qué trae | La cola (puesto, ventana de ELO, espera estimada), el grupo, las invitaciones, la sanción y el bloqueo, los servidores libres, los contadores, y la sala **sin** las estadísticas ni los clips | Mi ELO y nivel, las últimas partidas, los modos y las regiones, la preferencia de invitaciones, los amigos con su estado, el catálogo de sonidos |
| Cuándo se pide | Al entrar a Jugar, con los avisos que la cambian y cada 30 s mientras se está en la cola o en una sala | Al entrar a Jugar, cada 2 minutos y después de una partida (`lobby.finished`) |

- **Las estadísticas y los clips de una partida terminada** salen de `GET /api/v1/mm/lobbies/{id}/match`, que se pide solo al abrir la pestaña Estadísticas o el resumen final (hoy van en cada pedido del estado).
- `server_now` va en los dos.

## 4. Cada uno pide solo lo que le toca

La web decide por el tipo de aviso (tabla del punto 1), en lugar de volver a pedir todo el matchmaking con cualquier aviso:

- Un aviso de **otra sala** no hace nada (hoy invalida todo).
- `queue.changed` solo toca el contador.
- Los avisos de la propia sala aplican el cambio y, si cambia la etapa, piden el estado liviano.
- El panel de Administración › Matchmaking deja de recargarse con los avisos de los jugadores; se refresca con sus propios intervalos.

## 5. Cómo se mide

Antes y después, con lo mismo del 2026-11-02:

- `ws_probe2.mjs` (eventos de prueba por el socket) y una prueba nueva: de la base armando la sala a la ventana abierta (con la hora del servidor).
- Los logs de la API: pedidos por hora a `/api/v1/mm/state*` y sus percentiles, y los de `/ranking/players` y `/seasons/current`.
- **Lo que se espera:** "Partida encontrada" en menos de 0,5 s en el 90 % de los casos, y los pedidos del estado bajando mucho. Si después siguen los picos de varios segundos en otras rutas, se revisa la base de staging (consultas más lentas, conexiones), que queda como siguiente paso.

## 6. Pruebas

- **Base:** que cada aviso lleve su `d` (con un `LISTEN` en la prueba), que `mm_my_live()` y `mm_my_profile()` juntas den lo mismo que `mm_my_state()`, y que ningún `d` lleve contraseñas.
- **API:** `dispatch` con `d`; las rutas nuevas.
- **Web:** el contador sin pedidos; la ventana abierta solo con `lobby.found`; el veto aplicado desde el aviso; un aviso de otra sala no pide nada; `resync` pide todo.

## 7. Orden de implementación

1. Replanteo `59`: `mm_emit` con `p_data`, los `d` de cada aviso, `mm_my_live()`, `mm_my_profile()` y el estado de la partida terminada por separado. Inversa y pruebas.
2. API: el socket con `d`, `GET /api/v1/mm/state/live`, `GET /api/v1/mm/profile` y `GET /api/v1/mm/lobbies/{id}/match`. Pruebas.
3. Web: la tabla de avisos, la ventana desde `lobby.found`, las dos consultas y la red de seguridad. Pruebas.
4. Staging: la `59`, la API y después la web. Medir de nuevo y comparar.
5. Producción, con el corte.

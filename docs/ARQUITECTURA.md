# Arquitectura

## Visión general

```
Navegador ──► index.html (HTML + CSS + JS vanilla)
                 │  supabase-js v2 (CDN)
                 ▼
            Supabase
            ├─ Auth      (email + contraseña)
            ├─ Postgres  (tablas, vistas, funciones RPC, RLS)
            └─ Storage   (buckets avatars, photos, proofs)
```

No existe backend propio. Toda la lógica de negocio que corre en el navegador (generación de fixtures, avance de brackets, cálculo de tablas y ranking) se persiste escribiendo directamente en las tablas; las reglas que deben ser confiables (permisos, PCW, cambio de capitán, tag de usuario) se delegan en **RLS** y **funciones RPC** de Postgres.

## Organización de `index.html`

| Líneas aprox. | Bloque |
|---|---|
| 1–180 | CSS. Variables de tema en `:root` (oscuro por defecto, claro por `prefers-color-scheme`, forzable con `data-theme`). |
| 182–467 | Markup: `<header>` con navegación y un `<main id="...">` por vista. |
| 469–482 | Botón de tema y diálogos `#rdl` (cargar resultado) y `#pcwdlg` (aceptar práctica). |
| 483 | Carga de `config.js`. |
| 484–1491 | Aplicación JS dentro de una IIFE. |

### Módulos lógicos del JS

Todo vive en un mismo ámbito; estas son las agrupaciones funcionales:

| Área | Funciones principales |
|---|---|
| Utilidades DOM | `$`, `el`, `btn`, `say`, `put`, `tbl`, `none`, `showToast`, `ok` (desenvuelve `{data,error}` de Supabase y lanza si hay error) |
| Motor de torneos (puro, sin I/O) | `genKO`, `genDE`, `genGroups`, `rrPairs`, `seedOrder`, `computeDead`, `settle`, `applyRes`, `routeOne`, `unroute`, `blocked`, `standings`, `genPlayoffs`, `champOf` |
| Ruteo y vistas | `V` (lista de vistas), `show`, `handleRoute`, `render`, `shown` |
| Carga de datos | `load` / `loadImpl`, `soft`, `setS` (sesión) |
| Vistas públicas | `rHome`, `rViews`, `rEvents`, `rED`, `rPalmares`, `rPub`, `rProfile`/`ppDraw`, `rPcw` |
| Detalle de partida | `rMatchDetail`, `rVeto`, `vetoAct`, `rResult`, `repForm`, `sendReport`, `drawChat`, `pollMatch` |
| Perfil propio | `rProfileView`, `prepAvatar`, handler de `#prof-save` |
| Administración | `rPA` (jugadores/medallas/stats/verificaciones), `rTA` (equipos), `rC`/`rEM`/`rPend` (torneos, partidas, pendientes), `adminApply`, `finishE` |
| Componentes reutilizables | `pager` (lista paginada con búsqueda), `enhanceSelect` (select con filtro), `rosterPicker` (armado de roster con invitados) |

## Ruteo

Ruteo por *hash* (`location.hash`), manejado por `handleRoute()`:

| Hash | Vista |
|---|---|
| `#home`, `#matches`, `#results`, `#events`, `#pcw`, `#palmares`, `#ranking`, `#teams`, `#players` | Secciones públicas |
| `#profile` | Mi perfil (requiere sesión) |
| `#jugador/<nick>` | Perfil público de un jugador (busca por nick o id) |
| `#match-detail` | Detalle de la partida seleccionada (`selMatchId` en memoria; no sobrevive a un recargo) |
| `#cadm`, `#padm`, `#tadm`, `#vadm` | Paneles de administración (se ocultan si el usuario no es admin) |

`show(v, pushState, hash)` oculta todos los `<main>` salvo el elegido, actualiza la navegación, hace `history.pushState` y llama a `render()`. `window.onpopstate` reutiliza `handleRoute()` para que funcione el botón Atrás.

## Estado

El estado es un conjunto de variables globales dentro de la IIFE, reemplazadas completas en cada carga:

- Datos: `teams`, `pcwTeams`, `players`, `matches`, `events`, `registrations`, `medals`, `mapStats`, `profileReqs`, `matchVetos`, `pcwPosts`, `reports`, `userProfiles` (id → tag), `reqs`, `mine`.
- Sesión: `sb` (cliente Supabase), `me` (user id), `meEmail`, `admin`.
- Selección de UI: `selEv`, `selMatchId`, `selPlayerId`, `sel`, `selE`, más ids de edición `ep`, `et`, `eeid`, `emid`.
- Paginación: `PG[clave] = {page, per, q}` persiste página/búsqueda por lista.

## Ciclo de carga y render

1. Al iniciar se crea el cliente (`supabase.createClient`) y se suscribe `onAuthStateChange` → `setS(session)`.
2. `setS` determina `me`, consulta `profiles.role` para saber si es admin, ajusta el header y llama `load()`.
3. `load()` evita cargas concurrentes (si llega otra mientras corre, repite una vez al terminar) y ejecuta `loadImpl()`, que trae **todas las tablas completas** en paralelo con `Promise.all`.
   - `teams` y `players` son obligatorias (`ok`): si fallan, se aborta.
   - El resto usa `soft()`: si falla, muestra un toast una sola vez y sigue con lista vacía.
4. Tras cargar, `handleRoute()` → `show()` → `render()`, que sólo dibuja las vistas visibles.

Después de casi cualquier escritura se vuelve a llamar `load()` (recarga completa).

### Actualización "en vivo"

No se usa Supabase Realtime. En el detalle de partida, `pollMatch()` corre cada **5 s** (`setInterval`) y sólo si la pestaña está visible: trae la partida, vetos, reportes y los últimos 50 mensajes de chat, compara una firma y redibuja únicamente lo que cambió.

## Motor de torneos

Representación: cada partida (`matches`) conoce su posición (`stage`, `grp`, `round`, `pos`) y a dónde avanzan ganador y perdedor (`next_win`/`next_win_slot`, `next_lose`/`next_lose_slot`). Los huecos sin equipo se marcan con `dead1`/`dead2`.

- **Eliminación simple** (`genKO`): llave de tamaño potencia de 2 con siembra estándar (`seedOrder`: 1 vs N, 2 vs N-1…). Los *byes* se resuelven solos con `settle()`.
- **Doble eliminación** (`genDE`): upper, lower (2k-2 rondas) y gran final (`stage='grand'`). Los perdedores de upper caen a lower.
- **Todos contra todos / Grupos** (`genGroups` + `rrPairs`): método del círculo; los equipos se reparten en "serpentina" entre grupos. Opción ida y vuelta (`double_rr`).
- **Playoffs desde grupos** (`genPlayoffs`): toma los `advance` primeros de cada grupo y elige la siembra que minimiza cruces entre equipos del mismo grupo en primera ronda.

Cargar un resultado (`applyRes`):
1. Calcula la serie a partir de los mapas (`[{map, r1, r2}]`).
2. En eliminación no se permite empate.
3. Si se modifica un resultado ya cerrado, verifica con `blocked()` que las partidas siguientes no se hayan jugado y, si se puede, deshace el avance (`unroute`).
4. Avanza ganador/perdedor (`routeOne`) y vuelve a resolver byes (`settle`).
5. Devuelve el conjunto de partidas modificadas, que se guardan con un único `upsert`.

`finishE()` recalcula campeón (`champOf`) y el estado del torneo (`En curso` / `Finalizado`).

Tabla de posiciones (`standings`): 3 pts victoria, 1 empate; desempate por diferencia de rondas, rondas a favor y orden de siembra.

## Dependencias externas

| Recurso | Uso |
|---|---|
| `cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4` | Cliente Supabase |
| `flagcdn.com` | Banderas de país en perfiles |
| `steam://connect/<ip>` | Botón para conectarse al servidor de juego |

# Comparador de hasta 5 jugadores (prototipo VIP)

Prototipo de Kyan para que lo terminen Daniel (backend) y Esteban (frontend). Está en el frontend nuevo (`repo-mm-ejemplo`, rama `kyan/ejemplo-matchmaking`), en `/demo/comparador`, solo con `pnpm dev`.

## Qué hace

Es **el mismo comparador de `/players/compare`** (`features/ranking/Compare.tsx`), con tarjetas de jugador que se pueden sumar y sacar. Kyan lo pidió así el 2026-10-29: una primera versión con una tabla distinta no se parecía al actual.

| Parte | Como el actual | Lo que cambia |
|---|---|---|
| Tarjetas de jugador | Avatar, nick, equipo, insignia de nivel y ELO, con la raya de color arriba | Tienen una X para sacar al jugador y hay una tarjeta punteada **Agregar jugador** con el buscador por alias |
| Stats | ELO, Rating, K/D, HS %, ADR, % Victorias y Mixes, con el ganador en blanco y su barra de color | Con 2 jugadores son las filas de dos lados de siempre. Con 3 a 5, una columna por jugador con su valor y su barra |
| Gráfico | ELO de los últimos 30 mixes, tres valores en el eje, el punto final y la leyenda arriba | Una línea por jugador |
| Mixes juntos | "Mixes jugados juntos" y "Como rivales" | Con 3 o más, una línea por cada jugador contra el primero ("Con X: …") |

- **Límites:** sin VIP se comparan 2. La tarjeta de agregar muestra la corona y "Con VIP, hasta 5". Con VIP se comparan hasta 5.
- **URL:** los jugadores van en la URL (`?p=fako99,daook,…`).
- **Link de más:** si el link trae más jugadores de los que permite el VIP, se comparan los primeros y aparece un aviso.

## Colores

Los dos primeros son los del comparador actual: `--primary` (naranja) y `--chart-2` (gris). Los otros tres salen de la paleta categórica de la skill de dataviz: azul, aqua y violeta. Se eligieron con su validador para que se distingan con los dos primeros, también con daltonismo, en claro y en oscuro.

El validador marca dos cosas que vienen del comparador actual y no se tocaron:

- El gris no tiene color.
- El naranja en oscuro es más claro que la banda recomendada.

Por eso cada color va siempre con el nick, en la tarjeta, en la leyenda y en la columna.

El color **sigue al jugador**: si sacás a uno, los demás no cambian de color, y el que entra toma el color libre más bajo.

## Archivos (en `web/frontend/src/`)

- `features/compare5/demo.ts`: los jugadores del buscador más ADR, victorias, ELO máximo, historial y `together()` (mixes juntos por par).
- `features/compare5/MultiCompare.tsx`: tarjetas, stats, gráfico y "mixes juntos". Reusa `PlayerAvatar` y `barPct` del ranking.
- `routes/demo.comparador.tsx`

## Lo que falta para la versión real

- **Daniel:** que `GET /api/v1/players/compare` acepte hasta 5 jugadores (hoy recibe `a` y `b`) y devuelva `together` de cada uno contra el primero, con el VIP chequeado del lado del servidor.
- **Esteban:** pasar estos cambios a `features/ranking/Compare.tsx`. La estructura es la misma, así que alcanza con generalizar `CompareView` y `EloCompareChart` de 2 jugadores a N.

## Pruebas (2026-10-29)

- Con 2 jugadores (lo que abre la demo) se ve igual que el comparador actual.
- Con **Comparar el top 5** se ven las 5 tarjetas, las 5 columnas de stats, las 5 líneas y 4 líneas de "Con X".
- No hubo errores en la consola.
- No se revisó en modo claro.

# Stats avanzadas post-torneo (prototipo VIP)

Está en `/demo/torneo-stats` del frontend nuevo (`repo-mm-ejemplo`, rama `kyan/ejemplo-matchmaking`), solo con `pnpm dev`.

## Qué hace

Es un torneo de ejemplo ("Copa CM League · Octubre") con 20 jugadores en 4 equipos.

- **Aviso de arriba:** cambia según quién mira y cuándo.
  - **VIP antes de las 24 h:** "Las estás viendo antes que nadie: se publican para todos en N h".
  - **Sin VIP antes de las 24 h:** todo queda borroso, con un cartel y la cuenta de horas.
  - **Pasadas las 24 h:** todos ven las stats.
- **Contenido:**
  - La tarjeta del MVP del torneo, el de mejor rating.
  - Cuatro premios: más daño por ronda, más entradas ganadas, más clutches y mejor puntería.
  - La tabla de todos los jugadores, ordenable por cualquier stat y filtrable por equipo.
- **Barra Demo:** "Ser VIP" y dos momentos, "Recién terminó" y "Pasaron 30 h".

## Archivos (en `web/frontend/src/`)

- `features/vip/TournamentStats.tsx`
- `routes/demo.torneo-stats.tsx`

## Lo que falta para la versión real

- **Daniel:**
  - Una ruta con las stats de cada jugador en el torneo, sumando todos sus mapas.
  - **Entradas y clutches:** las entradas ya las manda el plugin 1.8 (`first_kills`), igual que los multikills (`k3`, `k4`, `k5`). Los clutches no: llegan con el schema 2 (`MEDALLAS_DATOS_REPORTER.md`). Hasta entonces, la columna Clutches y el premio "Más clutches" no se muestran.
  - **Chequeo de VIP:** la ruta tiene que hacerlo del lado del servidor y no devolver nada sin VIP hasta las 24 h desde el cierre de la final.
- **Esteban:** la pestaña en `/events/$id`.
- **Reloj:** la hora de corte tiene que salir del servidor. El componente recibe `now` para no depender del reloj de la PC del jugador.

## Pruebas (2026-10-29)

- Sin VIP, recién terminado: todo borroso con "Se publican para todos en 23 h".
- Con VIP: el aviso dorado y todas las stats.
- No hubo errores en la consola.

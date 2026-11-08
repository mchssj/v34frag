# Para ti: guía de implementación

## Estado

Implementado y probado en local el 2026-11-03 en `feat/frontend-fase-1` (`25c4517b` y `9f8d3dae`). Typecheck, lint, unitarias y la e2e de "Para ti" en verde, y revisado en el navegador (claro, oscuro, 1440 y 375 px, tooltip de la gráfica).

**Desplegado el 2026-11-05:** los dos commits pasaron a `main` con cherry-pick (`3c768726` y `06c2da7b`, sin conflictos; typecheck, lint y 608 pruebas en verde) y Daniel desplegó la web `06c2da7b` desde `v34frag-deploy` con `desplegar.sh web --sin-pruebas`. `https://cmleague.lat` sirve el bundle nuevo (`index-EOKaxRgg.js`; antes `b3bdc2f9ffcb`).

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/features/home/api/queries.ts` | Nuevo: en vivo de torneos y PCW, próximas partidas, torneos activos y top 5 de equipos |
| `web/frontend/src/features/home/lib/home.ts` y `home.test.ts` | Nuevos: saludo, fecha, cambio semanal, avance de nivel, % de victorias y orden de pendientes |
| `web/frontend/src/features/home/lib/useMmState.ts` | Nuevo: estado del matchmaking con el socket compartido |
| `web/frontend/src/features/home/components/*` | Nuevos: un componente por bloque; `PendingCard.test.tsx` |
| `web/frontend/src/features/home/pages/HomePage.tsx` | Nuevo: arma la página |
| `web/frontend/src/routes/_app/home.tsx` | Monta `HomePage` en lugar del saludo provisorio, dentro de `MmSourceContext` (como `/play`) |
| `web/frontend/src/components/brand/LevelBadge.tsx` | Suma el tamaño de 48 px |
| `web/frontend/e2e/home.spec.ts` | Nueva |
| `web/frontend/e2e/helpers.ts`, `e2e/shell.spec.ts` | El saludo pasa de "Hola, …" a "Buenos días/tardes/noches, …" |
| `docs/manual/jugador/para-ti.md` | Nueva página del manual |

## Despliegue (hecho el 2026-11-05, web `06c2da7b`)

No toca la base, la API ni los servidores. Solo la web, desde `main`.

- Dos corridas de `desplegar.sh web` con pruebas se frenaron por una prueba de Jugar que pasó el límite de 5 s con toda la suite corriendo (`PlayPage.test.tsx` › "en la sala: chat, reportar y desconexión de un compañero"). Sola pasa, y la suite completa del mismo commit había pasado una vez. Por eso Daniel desplegó con `--sin-pruebas`.
- El primer intento de Daniel no llegó a correr el script: la terminal mostraba el registro de VS Code. Se corrió en una ventana de Git Bash, con `VPS_HOST` tomado del `.env` de `v34frag` (`v34frag-deploy` no tiene `.env`).

## Pruebas

### Unitarias

- 9 nuevas en `features/home`: el saludo por hora, la fecha, el cambio semanal (filtra por 7 días), el avance de nivel (incluido el 10), el % de victorias sin partidas y el orden de los pendientes.
- `PendingCard` con el matchmaking simulado y las notificaciones por MSW: el orden completo, "Aceptar" llama al matchmaking, y "Todo al día" sin pendientes.
- Toda la suite: 566 en verde (92 archivos).

### e2e

- **En verde.** `home.spec.ts` revisa con la cuenta compartida:
  - el saludo;
  - "Todavía no tienes nivel" con **Vincular**;
  - Pendientes, con tareas o con "Todo al día";
  - la tarjeta Jugar;
  - el top 5 de jugadores y los links del ranking de equipos;
  - que **Jugar** lleve a `/play`.
- `helpers.ts` (`expectHome`) y `shell.spec.ts` buscan el saludo nuevo.

### Suite e2e completa

71 de 79 en verde. Las 7 que fallan no tocan "Para ti":

- **Dependen de los datos de la copia de producción del 2026-10-16:**
  - Partidas espera un partido de torneo;
  - el ranking espera una temporada abierta;
  - el perfil espera contadores en Mapas.
- **Quedaron viejas por cambios anteriores en la rama:**
  - Mi equipo espera el nombre bloqueado, pero ahora se edita (replanteo 68);
  - ⌘K busca "Palmarés", que salió del menú;
  - el registro espera el código de la vinculación vieja (ahora es el `!claim` de la primera partida);
  - el menú de cuenta espera la URL de `juanma^.^` sin codificar.

### Entorno local

Para probar se recargó la base local con la copia de producción y los replanteos `01` a `69` (scripts del ensayo del corte), quitando los CR de los `.sql`: con CRLF el replanteo `04` no encuentra el texto que reemplaza.

### En el navegador

Con el perfil simulado como el de un jugador real ("honzzq"), se revisaron la gráfica, el tooltip, los últimos 5, las cifras, Pendientes vacío, Jugar con el motivo de bloqueo, tus últimas partidas y los rankings, en claro y oscuro, en 1440 y 375 px.

## En qué se apartó del plan

- **Prueba de la página:** no hay una de la página completa con MSW. Se probó `PendingCard`, que tiene la lógica, y el resto queda para la e2e.
- **Últimas partidas:** salen de `/players/{nick}/matches` (la consulta que ya existía), no de `/me/matches`. Traen los mismos campos.
- **Cabecera:** no lleva el resumen de lo próximo que había en el artifact ("Tu grupo te invitó…"). Eso ya lo cubre Pendientes, justo debajo.

## Incidentes durante las pruebas

- **La página reventaba al abrirla** ("Falta MmSourceContext"): el contexto del matchmaking del layout solo envuelve el aviso de reconexión, no las páginas. La prueba unitaria simulaba el estado y no lo vio. Arreglo: la ruta envuelve la página en `MmSourceContext`, como `/play`.
- **El primer link de "Ranking de equipos"** en la e2e era "Tabla": la prueba busca ahora el link de la primera fila.

## Cómo revertir

Se vuelve `src/routes/_app/home.tsx` al saludo provisorio y se borra `src/features/home/`. Para las e2e, se vuelven `helpers.ts` y `shell.spec.ts` al saludo "Hola, …" y se borra `home.spec.ts`. También se borra `docs/manual/jugador/para-ti.md`.

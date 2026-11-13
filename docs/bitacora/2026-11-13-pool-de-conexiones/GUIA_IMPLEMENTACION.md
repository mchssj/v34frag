# La base sin conexiones libres en las horas pico: guía de implementación

## Estado

Implementado, probado y **desplegado el 2026-11-13** (commit `ccafae66`): la `115`, y la API y la web `ccafae6600f1`.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/115_mm_ultima_sala_aparte.sql` | `mm_lobby_rev`, `mm_my_last_lobby` y `mm_my_live` con `last_lobby_ref` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/115_mm_ultima_sala_aparte.sql` | Inversa |
| `pruebas/probar_115.sql`, `pruebas/probar_115.sh` | Prueba en una transacción que se deshace |
| `web/backend/src/routes/mm.ts` | `GET /api/v1/mm/last-lobby` |
| `web/backend/src/lib/errors.ts` | `UNAVAILABLE` (503) para `PGRST003` y `57014` |
| `web/backend/test/unit/errors.test.ts`, `test/unit/mm-live-state.test.ts` | Pruebas |
| `web/frontend/src/api/errors.ts` (y su prueba) | `UNAVAILABLE`, también para 502, 503 y 504 sin cuerpo; mensaje y `isRetryable` |
| `web/frontend/src/features/matchmaking/{queries,source,demo,types,PlayPage}.ts(x)` | `lastLobbyOptions`, `useLastLobby` y `source.lastLobby()` |
| `web/frontend/src/features/matchmaking/queries.test.tsx` | Prueba de `useLastLobby` |
| `web/frontend/src/features/matchmaking/PlayPage.test.tsx` | 15 s para las dos pruebas más pesadas (ver "Incidentes") |

`src/api/schema.d.ts` no se regeneró: las rutas del matchmaking responden `Any` y la web las llama sin tipos generados, y el archivo tenía sin commit los cambios de las medallas.

## Despliegue (hecho el 2026-11-13, 17:55 a 18:01 UTC)

Ninguna parte toca los servidores de juego. Se cambió el orden del plan: la web y la API nuevas funcionan con la base de antes (sin `last_lobby_ref`, la web usa el `last_lobby` de siempre), así que fueron primero y nadie vio vacía "Tu última partida".

1. **Prueba en producción:** `pruebas/probar_115.sql` (se deshace sola): 6 de 6.
2. **Web:** `deploy/vps/desplegar.sh web` (749 pruebas), `ccafae6600f1`.
3. **API:** `deploy/vps/desplegar.sh api` (600 pruebas), `ccafae6600f1`. No había salas armándose: una en vivo, que sigue en el servidor de juego.
4. **Base:** foto de `pg_stat_statements` en `pruebas/pg_stat_statements_antes.md`; la `115`, `notify pgrst, 'reload schema'` y `pg_stat_statements_reset()`.
5. La web y la API, desde un worktree limpio en `ccafae66` (después se borró).
6. Comprobado: `/api/health` con `ccafae6600f1` y `GET /api/v1/mm/last-lobby` sin sesión da 401 (antes 404). La medición de después está en "Pruebas › Producción".
7. Pendiente: medir de nuevo en un pico (20:00 a 06:00 UTC) y buscar `PGRST003` en `docker logs supabase-rest`.

Vuelta atrás: primero la web y la API de antes, después la inversa de la `115`.

## Pruebas

### Producción

- `probar_115.sql`: 6 de 6.
- Medición a los 5 minutos de la `115` (18:01 a 18:06 UTC, fuera del pico, con una sala en vivo):
  - `mm_my_live`: 51 llamadas, 119 ms de media y 502 de máximo (antes, acumulado desde el 3/11: 811 ms de media).
  - `mm_my_last_lobby`: 3 llamadas, 159 ms de media. La web la pidió 3 veces contra 72 del estado liviano: la caché por `rev` funciona.
  - La API: 72 `GET /mm/state/live` y 3 `GET /mm/last-lobby` con 200, y ninguna respuesta 5xx.
  - No alcanza para medir la mejora: con tan poca gente, casi todas las llamadas son de los 10 de la sala en vivo, que siguen armando su sala abierta (eso no cambió). Hay que medir en un pico.

### Base (local, copia de producción del 2026-11-13)

`sh pruebas/probar_115.sh`: 6 de 6.

1. `mm_my_live` sin `last_lobby`, con `last_lobby_ref`; `mm_my_last_lobby` igual a la `last_lobby` de antes.
2. `rev` cambia al recomendar a alguien de la sala, y la sala lo muestra.
3. `rev` no cambia si no pasa nada.
4. `mm_my_state` trae `last_lobby_ref`.
5. `anon` no llama a `mm_my_last_lobby` ni a `mm_lobby_rev`.
6. La inversa devuelve la `last_lobby` de antes.

Tiempo de `mm_my_live` para el jugador de la última sala terminada: de 84, 51 y 49 ms a 11, 3 y 3 ms.

### API

`pnpm typecheck` y `pnpm test`: 43 archivos, 600 pruebas (4 nuevas: `PGRST003` y `57014` a 503, `GET /api/v1/mm/last-lobby` y un `PGRST003` de punta a punta con `Retry-After`).

### Web

`pnpm typecheck`, `pnpm lint` y `pnpm test`: 124 archivos, 749 pruebas (2 nuevas: `UNAVAILABLE` y `useLastLobby`, que pide una vez por `rev`).

No se probó en el navegador: la API y el Vite locales que estaban corriendo eran los del worktree `v34frag-mainwt`.

## En qué se apartó del plan

- La web también trata como `UNAVAILABLE` un 502, 503 o 504 sin el cuerpo de la API (Caddy o Kong).

## Incidentes durante las pruebas

- Con la suite completa en paralelo, dos pruebas de `PlayPage.test.tsx` ("en la sala: chat, reportar…" y "sala terminada: estadísticas…") pasaban de los 5 s por defecto (5,1 a 5,2 s). Pasaba igual con el `PlayPage.tsx` de antes del cambio; solas tardan 2,4 s y 1,1 s. Se les dio 15 s.

## Cómo revertir

Primero la web y la API de antes (`ln -sfn` a la versión anterior, ver `deploy/vps/README.md`), después la inversa de la `115`.

# La base sin conexiones libres en las horas pico: guía de implementación

## Estado

Implementado y probado en local el 2026-11-13. Despliegue: ver abajo.

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

## Despliegue

Ninguna parte toca los servidores de juego.

1. **Base:** `pruebas/probar_115.sql` contra producción (se deshace solo). Después, aplicar la `115` y `notify pgrst, 'reload schema'`. Desde ese momento, quien tenga la web vieja abierta ve vacía "Tu última partida" hasta recargar.
2. **API:** `deploy/vps/desplegar.sh api`, sin salas del matchmaking armándose.
3. **Web:** `deploy/vps/desplegar.sh web`.
4. Los dos desde un worktree limpio en el commit: `v34frag` tiene sin commit lo de las medallas (que necesita la `114`) y el script arma con lo que haya en la carpeta.
5. Comprobar: `/api/health` con el commit, y en **Jugar** › **Tu última partida** la sala. Al día siguiente, `pg_stat_statements` (reiniciado al desplegar) y `docker logs supabase-rest | grep PGRST003`.

Vuelta atrás: primero la web y la API de antes, después la inversa de la `115`.

## Pruebas

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

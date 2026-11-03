# Salir de la cola del matchmaking al cerrar la web o la sesión: guía de implementación

## Estado

**En staging desde el 2026-11-02, con commit** (base, API y web). El plugin no cambia: no hay nada que subir a los servidores #1, #2 (flow) ni #3.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/63_mm_salir_cola_al_cerrar.sql` | Nuevo |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/63_mm_salir_cola_al_cerrar.sql` | Nuevo: la inversa |
| `supabase/replanteo/README.md` | Fila de la `63` |
| `web/backend/src/mm/socket.ts` | Presencia en el hub (`MmPresence`, `polled`, `online`, `sweep`), `mmSql` y `sqlPresence`. `listenMm` recibe la conexión en lugar de la URL |
| `web/backend/src/node.ts` | Una sola conexión `mm_listener` para el LISTEN y la presencia, `mmPolled` en `createApp` y la red de seguridad |
| `web/backend/src/app.ts` y `src/lib/types.ts` | La opción y la variable `mmPolled` |
| `web/backend/src/routes/mm.ts` | `GET /mm/state/live` cuenta como presencia |
| `web/backend/src/routes/auth.ts` | `POST /auth/logout` llama a `mm_logout` |
| `web/backend/test/unit/mm-presence.test.ts` | Nuevo: 7 pruebas |
| `web/backend/test/unit/auth-routes.test.ts` | 2 pruebas del cierre de sesión |
| `web/frontend/src/features/matchmaking/socket.ts` y `socket.test.ts` | Reconexión con `online` (2 pruebas, archivo nuevo) |
| `web/frontend/src/features/matchmaking/PlayPage.tsx` y `PlayPage.test.tsx` | El aviso de Jugar (1 prueba) |
| `web/frontend/src/features/matchmaking/types.ts`, `demo.ts` y `src/routes/demo.matchmaking.tsx` | `queue_dropped_at` y el botón de la demo |
| `docs/manual/jugador/buscar-partida.md` | Un párrafo en "1. Buscar" |

## Pruebas (2026-11-02)

- **Base:** `bash pruebas/correr_local.sh "E:/Css V34 Web/v34frag"`, en una transacción que se deshace. Resultado: 27 comprobaciones y la inversa:
  - en pausa no entra en una sala, pausar dos veces no hace nada, al volver conserva su `joined_at` y entra;
  - dentro de la gracia no sale; pasada la gracia sale con `disconnected` y sin sanción;
  - `queue_dropped_at` aparece y desaparece al volver a buscar;
  - con un grupo, uno en pausa pausa al grupo; salen los dos, el compañero con `left` y con `party.changed`;
  - la red de seguridad hace volver, pausa y saca;
  - `mm_logout` saca de la cola y no toca una sala que está aceptando ni sanciona;
  - permisos: las de presencia no son de `authenticated` ni de `anon`, y `mm_logout` es solo de `authenticated`.
- **API:** 446 pruebas y typecheck.
  - Hub, con timers falsos: pausa y salida a los 10 s, dos pestañas, vuelta dentro de la gracia, el `shutdown`, el polling como presencia y su vencimiento, la red de seguridad y el hub sin presencia.
  - Cierre de sesión: llama a `mm_logout` antes que a Supabase Auth, y cierra igual si falla.
- **Web:** 537 pruebas, typecheck y lint.
- **No se probó** contra la base real con el rol `mm_listener`, ni con navegadores de verdad.

## En qué se apartó del plan

- **Cerrar sesión usa `mm_logout()` y no `mm_leave()`:** `mm_leave` rechaza la sala si el jugador está aceptando, y eso le pondría una sanción. El plan decía que en una sala no cambia nada.
- **`listenMm` recibe la conexión:** la presencia usa la misma conexión del rol `mm_listener` que el LISTEN (`mmSql`). Así no hace falta una credencial nueva.
- **El replanteo se probó en `feat/frontend-fase-1`.** Por la regla del `CLAUDE.md`, la base y la API también van en `feat/mm-claim-en-sala` al commitear.

## Despliegue en staging (hecho el 2026-11-02)

Commits: `6a7f0ae1` (base y API) y `bafc6aaf` (web) en `feat/frontend-fase-1`, y `d20477ac` (base y API) en `feat/mm-claim-en-sala`.
- `d20477ac` se armó con un índice aparte y el mismo parche.
- En `app.ts`, `types.ts` y `node.ts` del worktree `v34frag-mmclaim` había cambios sin commit del manual de usuario. Se combinaron a mano y quedaron sin commit, como estaban.
- Ahí pasaron 457 pruebas.

Pasos, con la cola y las salas vacías:

1. **Base:** `63` aplicada con `psql -v ON_ERROR_STOP=1`. Verificado:
   - existe `mm_queue.away_since` y `mm_try_build` usa `mm_unit_away`;
   - `mm_listener` puede ejecutar las funciones de presencia y `authenticated` no;
   - `mm_logout` es de `authenticated` y no de `anon`.
2. **API `030260b1bf64`:** merge temporal "tmp: API de staging" de `d20477ac` con `feat/backend-api-fase-1` (`240e2694`), en `v34frag-deploy`. Los conflictos, todos fuera de `web/backend`, se tomaron como en `7e5ab1c4`. Comparada con la desplegada, `web/backend` cambia solo en lo de este requerimiento. Pasaron 446 pruebas.
3. **Web `bafc6aaf8c02`:** desde un checkout limpio en `v34frag-deploy`. Pasaron 522 pruebas.
4. **Prueba de punta a punta** con `kyan` y un script de Node (socket real, API y base de staging):
   - buscando con la web abierta: en la cola, sin pausa;
   - recién cerrada: en pausa al instante;
   - vuelve a los 2,5 s, como una recarga: sigue buscando, sin pausa, y 10 s después sigue igual;
   - cerrada 12 s: fuera de la cola, con salida `disconnected`;
   - al volver, `GET /mm/state/live` trae `queue_dropped_at`;
   - buscando otra vez y `POST /auth/logout` (204): fuera de la cola en el acto, con salida `left`.
   - Al terminar, `kyan` quedó fuera de la cola.
5. **No se probó:** con un grupo, con dos pestañas en un navegador de verdad, un despliegue con alguien buscando, ni en el celular. Están cubiertos por las pruebas unitarias y SQL; quedan para la prueba con jugadores.

## Cómo revertir

1. **Base:** la inversa `63`. Las salidas `disconnected` pasan a `left`.
2. **API y web:** revertir los commits y volver a desplegar. La API vieja con la base nueva funciona igual que antes: nadie llama a las funciones de presencia y `away_since` queda en `null`.

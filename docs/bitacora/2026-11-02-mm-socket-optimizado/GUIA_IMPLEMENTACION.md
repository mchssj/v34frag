# Socket del matchmaking sin errores y sin esperas de más: guía de implementación

## Estado

**En staging desde el 2026-11-03, con commit** (base, API y web). El plugin no cambia: no hay nada que subir a los servidores #1, #2 (flow) ni #3.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/64_mm_pasos_en_el_acto.sql` | Nuevo |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/64_mm_pasos_en_el_acto.sql` | Nuevo: la inversa |
| `supabase/replanteo/README.md` | Fila de la `64` |
| `web/backend/src/mm/socket.ts` | Error 1 (`polled`), error 2 (`heartbeat`, `seen`), mejora C (agrupado), envío protegido y mejora D (`claimsVerifier`) |
| `web/backend/src/node.ts` | El latido cada 15 s y la validación con `claimsVerifier` |
| `web/backend/src/routes/mm.ts` | `liveState` y `action(…, 'live')` en la cola, la sala y el grupo |
| `web/backend/test/unit/mm-presence.test.ts` | 9 pruebas nuevas: error 1, latido, agrupado, envío protegido y validación. La de "pedir el estado" cambió de sentido |
| `web/backend/test/unit/mm-live-state.test.ts` | 2 pruebas de la respuesta liviana. La de `dispatch` espera el agrupado |
| `web/frontend/src/features/matchmaking/socket.ts` y `socket.test.ts` | `pong`, `MM_SILENCE_MS` y 2 pruebas |
| `web/frontend/src/features/matchmaking/queries.ts` y `queries.test.tsx` | Socket compartido, combinación de la respuesta liviana y 2 pruebas |

## Pruebas (2026-11-02)

- **Base:** `bash pruebas/correr_local.sh "E:/Css V34 Web/v34frag"`, en una transacción que se deshace. Resultado: 14 comprobaciones y la inversa:
  - el segundo en entrar al 1v1 arma la sala sin tick, con `lobby.found`, y los dos salen de la cola;
  - con uno solo no arma;
  - el último en aceptar deja la sala en veto, y con uno solo no;
  - el último ban deja la sala `assigned` con su servidor y `lobby.server`;
  - sin un servidor que responda, la sala queda en `waiting_server` para el tick;
  - con la cola cerrada no arma;
  - `mm_try_build` bloquea las filas;
  - las funciones nuevas no son de `authenticated`.
- **No se probó la carrera de verdad** (cancelar en el mismo instante, con dos conexiones). En la base local el matchmaking se aplica dentro de la transacción de prueba, así que no se pueden abrir dos sesiones sobre él. Queda para staging.
- **API:** 457 pruebas y typecheck.
- **Web:** 541 pruebas, typecheck y lint.

## En qué se apartó del plan

- **El valor inicial del hook compartido** se pasa en un `queueMicrotask`: el lint (`react-hooks/set-state-in-effect`) no deja llamar a `setState` en el cuerpo del efecto.
- **`mm_assign_server` también revisa el estado de la sala** (`waiting_server`) y devuelve si asignó, para poder llamarla sin riesgo desde el tick más adelante. Hoy solo la llama `mm_ban_map`.

## Despliegue en staging (hecho el 2026-11-03)

Commits: `f01dabe5` (base y API) y `c6dd7ce8` (web) en `feat/frontend-fase-1`, y `232521e6` (base y API) en `feat/mm-claim-en-sala`.
- `232521e6` se armó con un índice aparte y el mismo parche.
- `node.ts` del worktree `v34frag-mmclaim` se combinó a mano con los cambios del manual, que siguen sin commit.
- Ahí pasaron 468 pruebas.

Pasos, con la cola y las salas vacías:

1. **Base:** `64` aplicada con `psql -v ON_ERROR_STOP=1`. Verificado:
   - existen las dos funciones nuevas, y no son de `authenticated`;
   - `mm_join`, `mm_accept` y `mm_ban_map` las llaman;
   - `mm_try_build` bloquea las filas.
2. **API `f5f6d7b98bf2`:** merge temporal "tmp: API de staging" de `232521e6` con `feat/backend-api-fase-1` (`240e2694`), en `v34frag-deploy`. Los conflictos, todos fuera de `web/backend`, se tomaron como en `030260b1`. Comparada con la desplegada, `web/backend` cambia solo en lo de este requerimiento. Pasaron 457 pruebas.
3. **Web `c6dd7ce8cb01`:** desplegada enseguida, desde un checkout limpio en `v34frag-deploy`. Pasaron 526 pruebas.

## Antes y después en staging

Medido desde la PC de Daniel con `pruebas/medir_mm.mjs` (dos corridas de 12 vueltas cada una) y `pruebas/medir_flujo.mjs` (5 salas de 1v1 entre `kyan` y `daniloev`, canceladas al arrancar el veto). Los datos crudos están en `pruebas/mediciones.txt`. La red sola (`/api/health`) cuesta unos 100 ms en las dos.

| Qué (mediana) | Antes | Después | Cambio |
|---|---|---|---|
| "Buscar" del segundo jugador → "Partida encontrada" | 2046 ms (467 a 2874) | **185 ms** (171 a 200) | −91 % |
| "Aceptar" del segundo → aviso del veto | 1497 ms (1020 a 2242) | **157 ms** (141 a 197) | −90 % |
| `POST /mm/queue` (buscar) | 395 a 445 ms (p90 1041 a 1047) | 241 a 255 ms (p90 287 a 502) | −40 % |
| `DELETE /mm/queue` (cancelar) | 687 a 724 ms | 223 a 244 ms | −67 % |
| Socket: abrir hasta `ready` | 451 a 454 ms | 374 a 387 ms | −16 % |
| `GET /mm/state/live` | 248 a 263 ms (p90 hasta 564) | 177 a 193 ms (p90 196 a 220) | −27 % |
| `GET /mm/profile` | 243 a 256 ms | 160 a 171 ms | −34 % |
| Aviso `queue.changed` desde "Buscar" | 197 a 227 ms | 302 a 304 ms | **+80 ms** |

- **Lo grande son las dos primeras filas:** ya no se espera al tick. La variación entre 0,5 y 2,9 s (dependía de en qué momento del ciclo de 2 s caía el pedido) desapareció.
- **El aviso de la cola llega más tarde a propósito:** es el agrupado de 150 ms (mejora C). Ese aviso solo actualiza los contadores. El que busca ve su propio estado en la respuesta de "Buscar", y "Partida encontrada" va por otro aviso, que sale en el acto.
- **`state/live` y `profile` no cambiaron de código.** La mejora puede venir de una base menos cargada, porque las acciones ya no llaman a `mm_my_state`, o de la variación normal entre corridas. No se puede separar con estas mediciones.

## Otras pruebas en staging (2026-11-03)

- **Ping:** un socket abierto 32 s recibió 4, cada 14 a 15 s.
- **Cancelar mientras se arma la sala** (`pruebas/carrera.mjs`): 10 rondas en las que `kyan` cancela en el mismo instante en que entra `daniloev`. En las 10 llegó primero cancelar, y en ninguna quedó `kyan` en la sala después de cancelar. El orden exacto no se puede forzar desde afuera: **no es una prueba completa de la carrera**, que también tiene la comprobación de la prueba SQL.
- Al terminar no quedaron salas abiertas, ni nadie en la cola, ni sanciones. Quedaron 15 salas canceladas de prueba ("Prueba de rendimiento (Claude)" y "Prueba de la carrera (Claude)").
- **No se probó:** con un navegador real, el corte por silencio (wifi caído) ni las dos pestañas en Jugar. Lo cubren las pruebas unitarias.

## Cómo revertir

1. **Base:** la inversa `64`. Todo vuelve a pasar en el tick.
2. **API y web:** revertir los commits y volver a desplegar las dos juntas.

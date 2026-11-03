# El flujo de la sala del matchmaking: guía de implementación

## Estado

**En staging desde el 2026-11-02, con commit** (base y web). Commits: `b2900c3a` en `feat/mm-claim-en-sala` (base) y `8049dc99` en `feat/frontend-fase-1` (web). La API no cambia. El plugin tampoco: no hay nada que subir a los servidores #1, #2 (flow) ni #3.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/60_mm_flujo_sala.sql` | Nuevo: `mm_accept`/`mm_decline` con bloqueo y plazo, `mm_tick` con `for update`, `mm_queue.ready_at`, `mm_cancel_lobby` (3 s de pausa y `d` con el motivo), `mm_try_build` (respeta `ready_at`), `mm_my_live` con `last_lobby` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/60_mm_flujo_sala.sql` | Nueva |
| `supabase/replanteo/README.md` | Fila de la `60` |
| `web/frontend/src/features/matchmaking/queries.ts` | `normalizeState`, estado sin pedir la partida terminada, `lastOwnAction` con la hora de inicio |
| `web/frontend/src/features/matchmaking/PlayPage.tsx` | Pestañas Jugar / "Tu última partida", `LastMatch`, aviso de cancelación, `AcceptDialog` con `key` por sala |
| `web/frontend/src/features/matchmaking/types.ts` | `last_lobby` |
| `web/frontend/src/features/matchmaking/demo.ts` | Última sala terminada y `d` en `lobby.cancelled` |
| `web/frontend/src/features/matchmaking/{queries,PlayPage}.test.tsx` | 7 pruebas nuevas y 3 ajustadas |

## Pruebas (2026-11-02)

- **Base:** `bash pruebas/correr_local.sh "E:/Css V34 Web/v34frag-mmclaim"` → 17 comprobaciones y la inversa, en una transacción que se deshace:
  - aceptar antes del plazo cuenta; después, error y no se guarda; rechazar después del plazo, error;
  - el tick bloquea;
  - la cancelación lleva el motivo, quien aceptó vuelve con su lugar y `ready_at` a 3 s, y quien no aceptó no vuelve;
  - con la pausa no se arma sala y pasada sí;
  - `lobby` y `last_lobby`, y `mm_my_state()` igual que antes.
- **La carrera con dos sesiones en paralelo no se probó**: la base local no tiene el matchmaking confirmado (se aplica dentro de la transacción de prueba) y en staging el tick corre solo. El bloqueo es `select … for update` de Postgres; queda para la prueba con jugadores.
- **Web:** 530 pruebas, typecheck y lint.

## Despliegue en staging (hecho el 2026-11-02)

Sin salas abiertas ni nadie en la cola.

1. **Base:** `60` aplicada sin errores. Verificado:
   - existe `mm_queue.ready_at`;
   - aceptar y rechazar bloquean la sala y miran el plazo, el tick bloquea, `mm_try_build` respeta `ready_at` y `lobby.cancelled` lleva `requeue`;
   - `mm_accept` es de `authenticated` y no de `anon`;
   - con `daniloev`: `lobby` vacío, `last_lobby` terminada, y `mm_my_state()` sigue siendo la suma de las dos partes;
   - `cmleague-mm` sigue activo, sin errores, y `mm_tick()` a mano responde `{"built": 0}`.
2. **Web `8049dc993a51`:** desde una carpeta limpia de `feat/frontend-fase-1`. 515 pruebas.
3. **API:** sin cambios (`4225068507f9`). Con `daniloev`, `GET /api/v1/mm/state/live` trae `last_lobby` sin estadísticas y `GET /api/v1/mm/lobbies/{id}/match` las trae (2 filas).

## Producción

Con el corte, junto con el resto del matchmaking.

## Falta

- Probarlo con jugadores: un "Aceptar" en el último segundo, una cancelación con la sala nueva enseguida y entrar a Jugar después de una partida.
- Actualizar `docs/manual/jugador/buscar-partida.md` ("Tu última partida" y la pausa de 3 s) cuando la sesión del manual lo suba.

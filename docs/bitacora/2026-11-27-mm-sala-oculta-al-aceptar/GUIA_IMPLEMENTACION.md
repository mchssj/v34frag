# La sala oculta mientras se acepta la partida: guía de implementación

## Estado

Desplegado el 2026-11-27 (UTC): replanteo `155` (19:58), web `0edafa650c47` (20:03) y API `f7c32ce41dae` (20:07, el manual de `/help`).

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/155_mm_sala_oculta_al_aceptar.sql` e inversa | `mm_lobby_hidden`, `mm_hidden_card`, `mm_lobby_json` y `mm_trg_notify` |
| `pruebas/prueba_155.sql` | Prueba de la base, con `rollback` |
| `web/frontend/src/features/matchmaking/AcceptDialog.tsx` | Sin el nick en el `title` de los cuadros |
| `docs/manual/jugador/buscar-partida.md` | Mientras se acepta no se ve quién te tocó |

## Cómo se encontró

- En la web, el `title` de cada cuadro de `AcceptDialog` era el nick del jugador.
- En producción (`pg_get_functiondef`), `mm_lobby_json` armaba `players` con `mm_player_card` sin mirar el estado: en `accepting` mandaba los 10 completos. La web escondía la sala (`PlayPage`: `room` es nulo en `accepting`), pero la respuesta de `GET /api/v1/mm/state` la tenía.
- El aviso `lobby.accept` del socket llevaba el `user_id` de quien aceptó. La web no lo lee (`applyMmEvent` vuelve a pedir el estado).
- Las otras funciones que usan `mm_lobby_json` (`mm_replace_info`, `mm_game_room`, `mm_my_last_lobby`, `mm_lobby_match` y `mm_admin_lobby`) no ven salas en `accepting`, salvo la de Administración, que no es de la sala y sigue viendo todo.

## Pruebas

- Base: `prueba_155.sql` contra producción, con `rollback`, sobre la última sala terminada puesta en `accepting`. Resultado: 10 tarjetas, 1 con nick (la de quien mira), 9 `oculto-*`, ninguna con equipo salvo la propia, ningún nick de los demás en el JSON. De afuera: 10 con nick. En el veto y cancelada después del veto: 10. Cancelada antes del veto: 1. `mm_trg_notify` sin `user_id`. Después del `rollback`, `mm_lobby_hidden` no existía.
- Web: las 118 pruebas del matchmaking y el typecheck; `desplegar.sh web` corrió las pruebas completas.

## Despliegue (2026-11-27)

1. 19:57 UTC: una sola sala, en `live` (empezada), y 1 jugador en la cola. Ninguna en `accepting`, `veto`, `waiting_server`, `assigned` ni `connecting`.
2. `155` como `supabase_admin`, con un control antes que cortaba si había una sala sin empezar. Solo reemplaza funciones: no bloquea tablas ni corta el mix en vivo.
3. Commit `0edafa65` en `main` y `desplegar.sh web` (`0edafa650c47`). Es estática y no reinicia nada.
4. Ramas: `b033fcc5` en `feat/frontend-fase-1` (replanteo, bitácora y ventana) y `919d6bcd` en `feat/mm-claim-en-sala` (replanteo y bitácora). Solo esos archivos: el worktree de `feat/frontend-fase-1` tiene otros cambios sin commit, que no se tocaron.
5. 20:07: `desplegar.sh api` (`f7c32ce41dae`) con el mix en vivo, que siguió sin cortes. El plugin le manda a Supabase (`ingest_server_chunk`) y el HUD al relay, no a la API; el despliegue reinicia solo `cmleague-api` (no `cmleague-mm`). Lo único que se corta unos segundos es el socket de la web, que se reconecta solo.

## Cómo revertir

1. Base: la inversa (`reversas/155_mm_sala_oculta_al_aceptar.sql`) como `supabase_admin`.
2. Web: la versión anterior (`c23e71b6226d`) con `desplegar.sh`; no hace falta, porque la ventana funciona igual con la sala completa.

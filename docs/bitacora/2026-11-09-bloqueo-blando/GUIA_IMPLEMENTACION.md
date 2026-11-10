# El bloqueo de los VIP no puede desarmar una partida: guía de implementación

## Cambios respecto del plan

- El aviso va en la categoría `elo` ("Mixes y ELO"), no en una del matchmaking: la base admite `mm`, pero la API valida las notificaciones contra una lista cerrada que no la tiene, y el listado se habría roto.
- La fecha del próximo cambio viaja en el `detail` del error (como `V3901` y `V5701`), y la API lo devuelve como `409 CONFLICT` con `details.next_change_at`.
- Volver a bloquear al que ya tenías bloqueado no gasta un cambio.
- El detalle de una sala en Administración no muestra los bloqueos ignorados: quedan en `mm_lobby_block_ignored` para revisarlos por SQL.
- Se trabajó en el worktree `v34frag-bloqueo` (rama `feat/bloqueo-blando`, desde `main`): en `v34frag-mainwt` otra sesión tenía sin commit cambios en los mismos archivos (el grupo máximo, replanteo `105`).

## Convive con la `105`

La `105` (grupo máximo, otra sesión) también cambia `mm_set_config` y `mm_tick`, en otros puntos y entre marcas propias. Se pueden aplicar en cualquier orden. La inversa de la `104` restaura esas dos funciones enteras desde su respaldo: si la `105` se aplicó después, hay que deshacer primero la `105`.

## Pruebas

### Base (local, con rollback)

| # | Prueba | Resultado |
|---|---|---|
| 1 | La sala del mirage (10 ELO de armado, dúo y 3 bloqueos): ignora solo kyan → kobassj, de 190 a 40. Con margen 2000 respeta los tres (190) | ok |
| 2 | Un bloqueo barato se respeta | ok |
| 3 | Con dos opciones, rompe el bloqueo más reciente | ok |
| 4 | El grupo no se separa aunque haya que romper el bloqueo; `mm_best_split` da los mismos lados | ok |
| 5 | `mm_try_build`, `mm_tick`, `notification_category` (`elo`) y `manual_valores` | ok |
| 6 | 5 bloqueos en 7 días; el 6.º falla con `V8904` y se libera a los 7 días; el log guarda bloqueos y desbloqueos | ok |
| 7 | La inversa deja las 9 funciones idénticas y saca lo nuevo | ok |

Rendimiento: 2,4 ms por reparto de 10 jugadores (antes 2,9 ms).

No se probó el armado completo de una sala con jugadores en la cola: el reparto se probó aparte y `mm_try_build` se probó en que compila con el registro y el aviso.

### API

`pnpm test`: 596 pruebas (con `V8904` y los marcadores nuevos del manual); `pnpm typecheck` sin errores.

### Web

`pnpm typecheck`, `pnpm test` (711, con el aviso nuevo en el modelo de notificaciones), `eslint` y `prettier` sin errores en lo que se tocó.

## Despliegue

1. Sin salas armándose en ese momento.
2. Base: aplicar la `104` en el VPS y `notify pgrst, 'reload schema';`. Comprobar `select block_margin, block_changes_week from mm_config;` (100 y 5) y `select count(*) from mm_block_log;` (los bloqueos vigentes).
3. API y web desde `main`, cuando `feat/bloqueo-blando` esté integrada.
4. En el navegador: Jugar › Bloqueo (con una cuenta VIP) y Administración › Matchmaking › General.

**Estado: desplegado el 2026-11-10 (UTC)** desde la rama `feat/bloqueo-blando` (`17e2b2c8`), sin integrar todavía en `main`: `main` estaba abierto en `v34frag-mainwt` con cambios sin commit de otra sesión (la `105`) en los mismos archivos.

- **Base (03:16 UTC):** la `104` aplicada con 9 jugadores en la cola; PostgREST recargado. `block_margin` 100, `block_changes_week` 5, `mm_block_log` con los 6 bloqueos vigentes, `notification_category('mm_block_ignored')` = `elo`. Una sala que se armó a las 03:15:55 (antes del cambio) siguió su curso.
- **API y web:** `17e2b2c8dcbf` (596 y 711 pruebas). Se sirven los textos nuevos del aviso, del panel Bloqueo y de Administración › Matchmaking.
- **Integrada en `main` el 2026-11-10** (merge `38ccae12`, después del commit de la `105`): web 713 y API 596 pruebas sobre el merge; la web desplegada desde `main` (`38ccae12e3db`). La base copiada en `feat/frontend-fase-1` y `feat/mm-claim-en-sala`.
- **Falta:** probar en el navegador (Jugar › Bloqueo con una cuenta VIP y Administración › Matchmaking).

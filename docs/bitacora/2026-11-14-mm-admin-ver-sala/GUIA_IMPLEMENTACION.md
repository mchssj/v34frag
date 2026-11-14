# Ver una sala del matchmaking como admin: guía de implementación

## Estado

**Desplegado el 2026-11-14** (Daniel, con Claude) desde `main`: commit `e8dbe496`, que es el `268eee8f` de `kyan/pruebas` llevado sobre `main` (`9b316e0a`). Ver "Despliegue".

Probado el 2026-11-14 (Kyan):

- **Base:** la `116` está aplicada en la copia local de producción (`cmleague-copia-prod`). Ver "Pruebas en la copia".
- **API:** `test/unit/mm-admin-lobby.test.ts`, con PostgREST simulado (4 casos). Las 573 pruebas unitarias pasan.
- **Web:** Vitest (103 pruebas del matchmaking, una nueva), la fuente demo en el navegador (`/demo/matchmaking` › Administración › Salas) y una prueba temporal (borrada) que renderizó "Ver sala" con el JSON real de una sala activa y una terminada de la copia.
- **No probado de punta a punta** (web → API → base): la Supabase local de la API (`127.0.0.1:54321`) tiene otros datos y ninguna sala, y la copia es solo Postgres, sin PostgREST ni Auth.

## Pruebas en la copia

Simulando la sesión con `set role authenticated` y `request.jwt.claims`:

| Caso | Resultado |
|---|---|
| Admin, sala activa (`connecting`) | 10 jugadores, `server` con contraseña, `veto`; sin `reported`, `commended` ni `elo_stake`; ningún `is_me` |
| Admin, sala terminada | `server` nulo, `match` con `game_id` y 10 filas de `stats` |
| Admin, sala que no existe | `null` |
| Jugador común | `Solo admins` (42501) |
| `anon` | `permission denied for function mm_admin_lobby` |

## Cambios respecto del plan

- La lista de Salas también se actualiza sola (cada 10 s) mientras no hay una sala abierta.
- "Cancelar sala" dentro de la sala pide confirmación (`ConfirmDialog`); el "Cancelar" de la lista sigue como estaba.

## Pasos para desplegar

1. Aplicar `supabase/replanteo/116_mm_admin_sala.sql` en la base del VPS (Daniel o Kyan), por el túnel:

   ```bash
   psql "host=$PG_HOST port=$PG_PORT user=$PG_USER dbname=$PG_DATABASE" -f supabase/replanteo/116_mm_admin_sala.sql
   ```

   Sin la `116`, "Ver sala" muestra "No se pudo abrir la sala" (la función no existe); el resto de la pestaña sigue igual.
2. Desplegar la API (`web/backend`) con la ruta nueva.
3. Desplegar la web (`web/frontend`).

## Despliegue (hecho el 2026-11-14, 04:15 a 04:23 UTC)

No toca los servidores de juego. Había una sala en vivo, que siguió en su servidor.

1. **Cherry-pick a `main`:** conflictos en `MatchRoom.tsx` y `RoomOverview.tsx` porque en `kyan/pruebas` ya está la pestaña Repetición 2D (`MatchReplay`, `trackUrl`): se dejó lo de `main` sin la repetición, más `playerExtra`. En los README y `PENDIENTES.md`, solo las filas de este requerimiento. API: 604 pruebas; web: typecheck, lint y 750 pruebas.
2. **Prueba en producción**, en una transacción que se deshizo (`mm_admin_lobby` no quedó): admin con la sala en vivo (10 jugadores, `server` con contraseña, sin `reported`, `commended` ni `elo_stake`), admin con una terminada (`match.game_id`, sin `server`), sala que no existe (`null`), jugador común (`Solo admins`) y `anon` (sin permiso). 5 de 5.
3. **Base:** la `116` y `notify pgrst, 'reload schema'`.
4. **API:** `deploy/vps/desplegar.sh api`, `e8dbe4968ef9` (`/api/health` con esa versión).
5. **Web:** `deploy/vps/desplegar.sh web`, `e8dbe4968ef9`.
6. Comprobado: `GET /api/v1/admin/mm/lobbies/{id}` sin sesión da 401. Falta abrirla como admin.

Vuelta atrás: la web y la API `ccafae6600f1` (`ln -sfn`, ver `deploy/vps/README.md`) y la inversa de la `116`.

## Ramas

Es del matchmaking: según `CLAUDE.md`, la base y la API van también en `feat/frontend-fase-1` y `feat/mm-claim-en-sala`, y la web solo en `feat/frontend-fase-1`. **Preguntar antes** de llevarlo a esas ramas. El número `116` se eligió porque `main` usa hasta la `115`.

## Cómo probar de punta a punta

Con una base que tenga PostgREST y Auth y alguna sala del matchmaking: aplicar la `116`, levantar la API y la web contra ella y entrar como admin a Administración › Matchmaking › Salas › Ver sala.

## Vuelta atrás

`docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/116_mm_admin_sala.sql` (borra la función) y revertir los archivos de la web y la API.

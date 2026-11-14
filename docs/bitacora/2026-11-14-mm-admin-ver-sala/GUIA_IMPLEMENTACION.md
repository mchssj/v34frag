# Ver una sala del matchmaking como admin: guía de implementación

## Estado

Commiteado en `kyan/pruebas`, **sin desplegar**. Probado el 2026-11-14:

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

## Ramas

Es del matchmaking: según `CLAUDE.md`, la base y la API van también en `feat/frontend-fase-1` y `feat/mm-claim-en-sala`, y la web solo en `feat/frontend-fase-1`. **Preguntar antes** de llevarlo a esas ramas. El número `116` se eligió porque `main` usa hasta la `115`.

## Cómo probar de punta a punta

Con una base que tenga PostgREST y Auth y alguna sala del matchmaking: aplicar la `116`, levantar la API y la web contra ella y entrar como admin a Administración › Matchmaking › Salas › Ver sala.

## Vuelta atrás

`docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/116_mm_admin_sala.sql` (borra la función) y revertir los archivos de la web y la API.

# Una notificación por partida con jugadas, la sección Juega del inicio y equipos más parejos: guía de implementación

## Estado

Hecho y probado en local el 2026-11-07. Commiteado en `feat/frontend-fase-1` (`0da727e7`), en `main` (`4480fbc4`, fast-forward que hizo la otra sesión desde `v34frag-mainwt`, porque tenía ahí trabajo sin commit de la `84`) y, solo la base, en `feat/mm-claim-en-sala` (`4d9deabe`). **Desplegado el 2026-11-07 (19:03-19:17 UTC)** desde `main` (`4480fbc4cd92`). No se recorrió en el navegador.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/83_jugadas_inicio_emparejamiento.sql` | Nuevo: `clips_detected`, `clips_notify_detected`, `csstv_clips_save` la llama, `tg_notify_match_clips` solo con el clip aprobado, `game_servers.internal_name` y `listed`, las dos vistas, `mm_public_counts`, los valores del armado |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/83_jugadas_inicio_emparejamiento.sql` | Nueva: inversa |
| `pruebas/prueba_83.sql`, `probar_83.sh` | Pruebas de la base |
| `pruebas/nombres_publicos_produccion.sql` | Los nombres públicos de producción (con los id del VPS) |
| `pruebas/backtest_armado.py` | La comparación del armado con todos los mixes (los datos que lee no van al repo) |
| `web/backend/src/routes/servers.ts`, `services/servers.ts` | `listed`, `totals.in_queue` y `mm_open` en el estado; `GET /api/v1/community/discord` |
| `web/backend/src/services/discord.ts` | Nuevo: los números de la invitación, con caché |
| `web/backend/src/routes/admin-servers.ts`, `schemas/servers.ts` | `internal_name` y `listed` en Administración |
| `web/backend/src/env.ts` | `DISCORD_INVITE_CODE` (opcional, por defecto `bn5Yxsh9tc`) |
| `web/backend/src/db/types.ts` | Regenerado con la `83` |
| `web/backend/test/unit/servers-status.test.ts`, `servers-routes.test.ts`, `test/integration/servers.test.ts` | Pruebas nuevas y el mensaje del nombre repetido |
| `web/frontend/src/api/schema.d.ts` | Regenerado desde la OpenAPI del código nuevo (archivo, no la API corriendo) |
| `web/frontend/src/features/landing/components/ServersSection.tsx` (+ `.test.tsx`) | La sección Juega |
| `web/frontend/src/features/public/api/queries.ts`, `src/config/site.ts` | La consulta de Discord; fuera los números fijos |
| `web/frontend/src/features/shell/notifications/...` | El texto de `clips_detected`, `clipsSummary` y el link con `search` |
| `web/frontend/src/features/mixes/lib/search.ts`, `pages/MixRoomPages.tsx`, `matchmaking/room/MatchRoom.tsx`, `routes/_app/match.$id.tsx` | `view=stats` abre la sala en Estadísticas |
| `web/frontend/src/features/admin/servers/components/ServersTab.tsx` (+ fixtures de prueba) | Nombre público, nombre interno y "Mostrar en el inicio" |
| `docs/manual/jugador/clips-y-demos.md`, `notificaciones.md`, `buscar-partida.md`, `admin/servidores.md`, `admin/matchmaking.md` | Manual |
| `CHANGELOG_DISCORD.txt` | 2.9.23 |

## Commit (cuando Daniel lo pida)

- `feat/frontend-fase-1`: todo.
- `feat/mm-claim-en-sala` (worktree `v34frag-mmclaim`): la base y la API, porque la `83` cambia `mm_config` (regla de las ramas del matchmaking). La web no.

## Despliegue (hecho el 2026-11-07, salvo el paso 6)

Cómo quedó:

- Sin mixes en vivo ni salas. Había 2 personas en la cola, que siguieron ahí. La única partida `live` es la `0d42d09a…` del #1, colgada desde el 2026-11-06.
- Respaldo `20261107T190306Z` (también en R2).
- `probar_83.sh` contra producción: el primer intento chocó en un deadlock con otro proceso y Postgres lo canceló sin cambiar nada. Con `cmleague-mm` parado unos segundos (el worker solo llama a `mm_tick`; la presencia de la cola es de la API, así que nadie salió de la cola): 8 de 8 y la inversa igual a antes.
- La `83` desde el archivo commiteado, con `cmleague-mm` parado de nuevo unos segundos, y los nombres públicos (los cinco servidores como se esperaba). El armado quedó en 400, 200 y 3.
- La API `4480fbc4cd92` (555 pruebas, `/api/health` con el commit). El estado devuelve `CM League #1`, `#2` y `#3`, con `in_queue` y `mm_open`. `/api/v1/community/discord` da 37 en línea y 140 miembros: los números fijos decían 214 y 1386.
- La web `4480fbc4cd92`, con `--sin-pruebas`: en la corrida del script fallaron 3 pruebas de `PlayPage.test.tsx` por tiempo (la máquina estaba cargada con otra sesión). Solas pasan las 32, y la suite completa ya había pasado sobre el mismo commit. Producción sirve el mismo `index.html` que el build.
- Se desplegó desde un worktree limpio en `main` (`deploy/jugadas-83`) y no desde `v34frag-mainwt`, que tiene cambios sin commit de otro requerimiento.

Los pasos:

Sin un mix en curso. No toca el plugin ni los servidores del juego.

1. **Respaldo** de la base del VPS.
2. **Base del VPS** (por el túnel): `probar_83.sh "<conexión>"` (8 comprobaciones y la inversa, con rollback) y después la `83` desde el archivo commiteado (LF). Antes de la prueba, parar `cmleague-mm` para que `mm_tick` no espere los bloqueos.
3. **Nombres públicos:** `pruebas/nombres_publicos_produccion.sql`. Deja `CM League #1`, `#2` y `#3` en el inicio, y los dos históricos como `CM League (anterior)` y `(anterior 2)`, ocultos. Revisar la tabla que muestra al final.
4. **API y web juntas.** La web nueva lee `totals.in_queue`, `mm_open` y `/api/v1/community/discord`. Con la API vieja, la sección muestra la cola vacía y el Discord sin números: no rompe. Con la API nueva y la web vieja, no cambia nada visible salvo que los ocultos dejan de salir. `DISCORD_INVITE_CODE` no hace falta (el valor por defecto es el de la comunidad).
5. Comprobar en `https://cmleague.lat` que la sección Juega muestra la cola y los nombres genéricos, y en Administración › Matchmaking que el armado quedó en 400, 200 y 3.
6. Publicar el `CHANGELOG_DISCORD.txt` (2.9.23).

## Pruebas

### Base (Supabase local con la copia de producción)

`probar_83.sh docker`: **8 de 8 comprobaciones** y la inversa igual a antes (estructura comparada con `estructura.sql`), en una transacción con rollback:

1. Dos jugadas de un jugador (4 kills y un clutch 1v2) y una de una ficha sin cuenta: un solo aviso, con su `ref`, `count` 2, `kills` [4], `clutches` [2], el mapa y la categoría `elo`.
2. La reingesta del mismo resultado no repite el aviso.
3. El video terminado ya no avisa.
4. El clip reprocesado aprobado sí avisa (`clip_ready`).
5. Una partida sin jugadas no avisa.
6. Nombre interno copiado en los servidores de antes, `listed` por defecto, las dos vistas, el buscador y el nombre interno único.
7. `mm_public_counts` cuenta la cola y la puede usar `anon`; `clips_notify_detected` no.
8. `mm_config` en 400, 200 y 3, y el valor por defecto.

El script de nombres de producción también se corrió en local con rollback (la copia tiene los mismos id): deja los cinco servidores como se esperaba.

### API

- `pnpm typecheck` y `pnpm test`: **555 pruebas** (antes 548). Nuevas: el filtro `listed`, la cola en el estado (abierta y cerrada), Discord (los números, sin números con 429, la caché de 10 minutos y de 1 minuto si falla), el alta con nombre interno y `listed` (segundo paso a `game_servers`) y sin ellos (un solo paso), el esquema del nombre interno y los valores por defecto del detalle.
- Integración contra la base local con la `83`: `servers`, `mixes-perfil-ranking`, `clips` y `clips-vip` pasan (29). `hud.test.ts` falla en "el admin configura el HUD de un servidor" (espera 400 y recibe 409): la prueba elige el puerto siguiente al primero libre y en la copia de producción ese puerto (27501) ya lo usa el servidor #2. No tiene que ver con este cambio.

### Web

- `pnpm typecheck`, `pnpm test`: **641 pruebas** en 106 archivos (antes 636). Nuevas: `ServersSection.test.tsx` (la cola, los nombres públicos, sin Conectar, los links, el Discord con y sin números) y `clips_detected` en `model.test.ts` (texto, link con `view=stats`, una sola jugada y el resumen por tipo).
- `eslint` y `prettier --check` sin avisos en los archivos tocados.

## Cambios respecto del plan

- "Buscar partida" lleva siempre a `/register` y el segundo botón es **"Ya tengo cuenta"** (`/login?redirect=/play`): el inicio solo lo ven visitantes (con sesión se va a `/home`), así que la rama "con sesión → `/play`" del plan no existe.
- Los servidores históricos también reciben un nombre público genérico (`CM League (anterior)`), porque siguen apareciendo en sus partidas viejas.
- Se sacó del diseño "espera media 2 min": no hay ese dato.

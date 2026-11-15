# Límites configurables para los baneos del soporte: guía de implementación

## Estado

**Desplegado el 2026-11-15** (Daniel, con Claude) desde `main`: commit `add29312`, hecho en la rama `feat/rol-soporte` (worktree `v34frag-soporte`) y pasado encima de `02ab2923`. Ver "Despliegue".

- **Base:** `pruebas/probar_121.sh` en la base local (copia de producción, con la `117`): aplica la `121`, prueba cada regla con cuentas de prueba y aplica la inversa, todo con rollback. 12 de 12 (del 1 al 10, con el 2 en tres partes). La inversa deja las funciones idénticas a las de la 117.
- **API:** typecheck y 627 pruebas unitarias, con 5 casos nuevos en `test/unit/support-routes.test.ts` (leer, guardar, rangos, permisos).
- **Web:** typecheck, lint y 758 pruebas.
- **Manual:** el build de la API lo valida (63 páginas).
- **Base local:** la `121` quedó aplicada en la copia local (`supabase_db_v34frag-api`), con 120, 3 y 7, para probar en el navegador.
- **En el navegador:** Daniel lo probó en local (la web y la API del worktree en los puertos 5174 y 8788, contra la copia local) el 2026-11-14: "Está perfecto".
- **Después del rebase sobre `origin/main`** (con la `118`, la `119` y la `120`), el 2026-11-15: typecheck y 654 pruebas de la API, typecheck, lint y 789 de la web, y el manual con 66 páginas.

## Cambios respecto del plan

- **El número:** es la `121`, no la `118`. Mientras se hacía, entraron a `main` la `118` (permisos), la `119` (tienda) y la `120` (portada). Ninguna toca `site_config` ni las funciones de los baneos del soporte.
- **Dónde está la tarjeta:** en Administración › Baneos, arriba de la pestaña **Actividad del soporte**, que es la que ven moderadores y admins. El plan decía "en Administración › Baneos" sin la pestaña.
- **Quién la cambió:** la API devuelve `updated_by: { id, alias }` y la base `updated_by_nick` (el nick de su ficha, o su tag si no tiene). El plan solo hablaba de guardar quién y cuándo.
- **Manual del admin:** una página nueva, `admin/limites-del-soporte.md`, en lugar de una sección en otra página (no había una página de baneos del admin).
- **El aviso del soporte** arriba de la lista de Baneos muestra los límites que valen, que el plan no nombraba.

## Pasos para desplegar

No toca los servidores de juego ni el plugin.

1. **Commit** en `feat/rol-soporte` y llevarlo a `main` (como el rol Soporte: `777a477b` fue a `origin/main` en avance directo).
2. **Prueba en producción, con rollback:** `probar_121.sql` contra la base del VPS, por el túnel (`ssh -L 5433:127.0.0.1:5432 ubuntu@<VPS>`).

   ```bash
   grep -v -E '^(begin|commit);$' supabase/replanteo/121_limites_baneo_soporte.sql > /tmp/r121.sql
   grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/121_limites_baneo_soporte.sql > /tmp/rev121.sql
   psql "host=$PG_HOST port=$PG_PORT user=$PG_USER dbname=$PG_DATABASE" -v ON_ERROR_STOP=1 \
     -v r121=/tmp/r121.sql -v rev121=/tmp/rev121.sql -f docs/bitacora/2026-11-14-limites-baneo-soporte/pruebas/probar_121.sql
   ```

3. **Base:** aplicar `supabase/replanteo/121_limites_baneo_soporte.sql` (termina con `notify pgrst, 'reload schema'`). Con la API vieja y la `121` aplicada no se rompe nada: los valores por defecto son los de la `117`, y el cupo solo suma campos.
4. **API:** `deploy/vps/desplegar.sh api`.
5. **Web:** `deploy/vps/desplegar.sh web`. Lleva también el cambio de `/terminos`.
6. **Comprobar:** `/api/health` con el commit, y que `GET /api/v1/admin/bans/limits` sin sesión dé 401. Con la cuenta de admin, la tarjeta en Baneos › Actividad del soporte.
7. **Publicar** `terms/terminos.html` donde se publique, y el `CHANGELOG_DISCORD.txt` en Discord.

## Despliegue (hecho el 2026-11-15, 05:20 a 05:36 UTC)

No toca los servidores de juego.

1. **Commit y push:** `add29312` a `origin/main` (avance directo desde `02ab2923`, después del rebase y de renumerar a `121`).
2. **Prueba en producción**, por el túnel y en una transacción que se deshizo: 12 de 12. Después no quedaban las columnas ni las cuentas de prueba.
   - El primer intento falló en la comprobación 10 (la inversa): en producción, `ban_create`, `ban_update` y `ban_support_quota` de la `117` tienen `\r\n` y los acentos rotos (ver "Incidentes"), y la inversa las deja bien. La prueba ahora compara sin `\r` y acepta esa única diferencia, con una nota.
3. **Base:** la `121`, a las 05:31 UTC, con `PGCLIENTENCODING=UTF8` y sin `\r` (`tr -d '\r'`). Comprobado: `site_config` en 120, 3 y 7; `site_ban_limits` y `site_admin_set_ban_limits` sin permiso para `anon`; y las cuatro funciones de los baneos sin `\r` y con los acentos bien.
4. **API:** `deploy/vps/desplegar.sh api`, `add29312b03b` (`/api/health` con esa versión; antes, `355f10ee714c`). Desde el worktree hace falta pasarle `VPS_HOST`, porque el `.env` está en `v34frag`.
5. **Web:** `deploy/vps/desplegar.sh web`, `add29312b03b`. Lleva el cambio de `/terminos`.
6. **Comprobado:** sin sesión, `GET /api/v1/admin/bans/limits` y `/admin/bans/support-quota` dan 401 (las rutas existen), y la web responde.

Vuelta atrás: la API y la web `355f10ee714c` (`ln -sfn`, ver `deploy/vps/README.md`) y la inversa de la `121`.

## Incidentes

- **La `117` quedó en producción con los acentos rotos.** Al aplicarla el 2026-11-14, el archivo se leyó como WIN1252 y no como UTF-8, y con `\r\n`. Diez funciones tienen textos como "ElegÃ­" en vez de "Elegí", y así le llegan al soporte los mensajes de error: `ban_create`, `ban_update`, `ban_support_quota`, `ban_lift`, `clip_reject`, `clip_reprocess`, `clip_review_ok`, `mm_admin_lists`, `profile_comment_delete` y `team_staff_remove_logo`. La `121` reescribió bien las tres primeras. Las otras siete siguen igual: es un arreglo aparte, pendiente de que Daniel lo pida.
- **CRLF en las pruebas:** con `core.autocrlf`, Git deja los `.sql` con CRLF y el psql del contenedor no lee `\i :r121`. `probar_121.sh` les quita los `\r` antes de copiarlos.

## Ramas

Como la `117`: no es del matchmaking, así que no va a `feat/frontend-fase-1` ni a `feat/mm-claim-en-sala`.

## Vuelta atrás

- **Base:** `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/121_limites_baneo_soporte.sql`. Vuelve a los 120 minutos, 3 baneos y 7 días fijos de la `117`, y se pierden los valores que haya puesto un admin.
- **API y web:** la versión anterior (`ln -sfn`, ver `deploy/vps/README.md`). Si se vuelve la base, hay que volver también la API y la web: la web nueva pide `/admin/bans/limits`, que sin la `121` falla, y el soporte no podría banear.

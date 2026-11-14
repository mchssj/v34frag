# Rol Soporte: guía de implementación

## Estado

Implementado en la rama `feat/rol-soporte` (worktree `v34frag-soporte`) y llevado a `main` el 2026-11-14. Ver "Despliegue".

Probado el 2026-11-14:

- **Base:** `pruebas/probar_117.sh` en la base local (copia de producción): aplica la `117`, prueba cada regla con cuentas de prueba y aplica la inversa, todo con rollback. 19 de 19 (del 1 al 18, más el 14b de Para revisar). La inversa deja las funciones idénticas a las de la 116.
- **API:** 622 pruebas unitarias, con `test/unit/support-routes.test.ts` (18 casos: cada ruta del soporte, los topes y los 403 en lo que no le toca).
- **Web:** typecheck, lint y 757 pruebas.
- **Manual:** el build de la API lo valida (62 páginas).
- **En el navegador:** Daniel lo probó en local (la web y la API del worktree contra la copia de producción). Salieron dos cosas:
  - Quiénes somos no mostraba al soporte. No era un error: la cuenta de prueba no tenía ficha de jugador, y la página solo muestra cuentas con ficha (desde la `87`, igual para moderadores y admins).
  - Pidió que el soporte también entre a **Para revisar** (ver "Cambios respecto del plan").

## Cambios respecto del plan

- **Para revisar** (Daniel, 2026-11-14): el soporte y el moderador ven la cola de clips regrabados y usan los tres botones (publicar, reprocesar otra vez y rechazar). `clip_review_ok` y `clip_reject` pasan a `is_support()` y anotan `clip_approve` y `clip_reject` en `support_actions`. La API abre `GET /admin/clips/review`, `POST /admin/clips/{id}/approve` y `POST /admin/clips/{id}/reject`. Siguen siendo del admin: la pestaña Reglas, rechazar varios (`POST /admin/clips/reject`), recuperar (`POST /admin/clips/restore`) y más de 10 por tanda. El plan decía que el soporte no aprobaba ni rechazaba.
- **El moderador entra a Clips:** reprocesa con el mismo tope de 10 y revisa Para revisar, porque el moderador puede todo lo del soporte. El plan no lo decía.
- **El tope de 10 clips** vale para todos menos el admin (el plan decía "si el rol es soporte").
- **Actividad del soporte:** el equipo viene con `name` y no con `alias`, porque `team_ref` devuelve `name`.
- **El aviso de cambio de rol** no nombraba al moderador: ahora tiene al moderador y al soporte.
- **Foto de perfil:** la función se llama `staff_remove_photo` (el plan decía `staff_remove_avatar`) y la ruta es `POST /api/v1/admin/players/{id}/photo/remove`. El logo, `POST /api/v1/admin/teams/{id}/logo/remove`.

## Pasos para desplegar

No toca los servidores de juego ni el plugin.

1. **Prueba en producción, con rollback:** `probar_117.sql` contra la base del VPS, por el túnel (`ssh -L 5433:127.0.0.1:5432 ubuntu@<VPS>`). Crea cuentas de prueba, aplica la `117` y la inversa dentro de una transacción que se deshace.

   ```bash
   grep -v -E '^(begin|commit);$' supabase/replanteo/117_rol_soporte.sql > /tmp/r117.sql
   grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/117_rol_soporte.sql > /tmp/rev117.sql
   psql "host=$PG_HOST port=$PG_PORT user=$PG_USER dbname=$PG_DATABASE" -v ON_ERROR_STOP=1 \
     -v r117=/tmp/r117.sql -v rev117=/tmp/rev117.sql -f docs/bitacora/2026-11-13-rol-soporte/pruebas/probar_117.sql
   ```

2. **Base:** aplicar `supabase/replanteo/117_rol_soporte.sql` (termina con `notify pgrst, 'reload schema'`).
3. **API:** `deploy/vps/desplegar.sh api`.
4. **Web:** `deploy/vps/desplegar.sh web`. Lleva también los cambios de `/privacidad` y `/terminos`.
5. **Comprobar:** `/api/health` con el commit, y que `GET /api/v1/admin/support-actions` sin sesión dé 401.
6. **Dar el rol:** un admin, desde Administración › Usuarios, a una cuenta con ficha (si no tiene ficha, no aparece en Quiénes somos).
7. **Publicar** `terms/terminos.html` y `terms/privacidad.html` donde se publiquen, y el `CHANGELOG_DISCORD.txt` en Discord.

## Ramas

`mm_admin_lift_penalty` y `mm_admin_lists` son del matchmaking, pero `feat/frontend-fase-1` y `feat/mm-claim-en-sala` siguen en la `105` y no reciben la `115` ni la `116` (Daniel, 2026-11-13). Por eso tampoco reciben la `117` hasta que Daniel diga lo contrario.

## Vuelta atrás

- **Base:** `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/117_rol_soporte.sql`. Las cuentas con el rol Soporte quedan como Jugador, sus acciones en `team_audit` quedan como `moderator`, y se pierden `support_actions`, `bans.created_by_role`, `match_clips.video_reprocessed_by` y los avisos `avatar_removed`.
- **API y web:** la versión anterior (`ln -sfn`, ver `deploy/vps/README.md`). Con la API vieja y la `117` aplicada no se rompe nada: el soporte solo no puede entrar a lo suyo.

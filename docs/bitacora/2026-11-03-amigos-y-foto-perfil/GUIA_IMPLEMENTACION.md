# Amigos al instante y la misma foto de perfil en toda la web: guía de implementación

## Estado

**Desplegado el 2026-11-03**: base en staging y en producción, y la web `507a9d528e2b` en el VPS (que desde el corte apunta a producción). Commit en las dos ramas. Falta la prueba con dos cuentas en el navegador.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/71_amigos_y_foto_perfil.sql` | Nuevo |
| `supabase/replanteo/README.md` | Fila de la `71` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/71_amigos_y_foto_perfil.sql` | Nuevo: la inversa |
| `docs/bitacora/2026-11-03-amigos-y-foto-perfil/pruebas/*` | Nuevos: las pruebas SQL y su script |
| `web/frontend/src/features/matchmaking/queries.ts` y `queries.test.tsx` | `friend.changed` pide solo el perfil |
| `web/frontend/src/features/profile/lib/photo.ts` y `photo.test.ts` | Nuevos: `myPhotoUrl` |
| `web/frontend/src/features/profile/api/queries.ts` | `useUploadAvatar` renueva todas las consultas |
| `web/frontend/src/features/profile/pages/ProfileSection.tsx` | El avatar de Mi perfil con `myPhotoUrl` |
| `web/frontend/src/features/shell/components/AccountMenu.tsx` | El menú de la cuenta con `myPhotoUrl` |
| `web/frontend/src/features/onboarding/pages/WelcomeFlow.tsx` | La foto de la Bienvenida con `myPhotoUrl` |
| `docs/manual/jugador/crear-cuenta.md` y `docs/manual/admin/usuarios-y-fichas.md` | Qué foto se ve |

## Despliegue

1. ~~**Commit en las dos ramas**~~ (`friend.changed` es del matchmaking): hecho el 2026-11-03. En `feat/frontend-fase-1`, `46145440` y el de la renumeración; en `feat/mm-claim-en-sala`, `582b8806` y `12cc7e6e`.
2. ~~**Staging**~~: hecho el 2026-11-03. 0 fichas para el arreglo de datos; las pruebas en staging dentro de una transacción que se deshace dieron todas `OK`; aplicada y verificada (trigger, avisos en las dos funciones, permisos de `authenticated` y respaldo vacío). **Se aplicó como `70`**, así que el respaldo se renombró a `replanteo71_fotos_ficha` con su `comment` (2026-11-03), para que la inversa lo encuentre. El `comment` con acentos pasado por `psql -c` desde Git Bash llega en Latin-1 y falla (`invalid byte sequence for encoding "UTF8"`): se armó con `chr()`. La consulta para contar las fichas:
   ```sql
   select count(*) from players p join profile_details d on d.user_id = p.user_id
   where p.photo_url is not null and d.avatar_url is not null and p.photo_url <> d.avatar_url;
   ```
   La API no cambia.
3. ~~**Producción**~~: hecho el 2026-11-03 (el corte ya tenía `01` a `70`). Aplicada sin CR con `psql -v ON_ERROR_STOP=1` y verificada: trigger, avisos en las dos funciones, permisos de `authenticated` y `respaldo: 2` (kyan y saiko, que pasan a mostrar la foto de su cuenta). Después, 0 fichas con dos fotos distintas.
4. ~~**Web**~~: hecho el 2026-11-03. `v34frag-deploy` en `507a9d52`, `pnpm install --frozen-lockfile` y `deploy/vps/desplegar.sh web`: 560 pruebas, build, `current` → `507a9d528e2b` (antes `e53200f83840`). `https://cmleague.lat` responde 200 y la API (`0d5732881cbe`, `env: production`) no cambió. Nada para los servidores de juego (#1, #2 y #3).

## Pruebas

### Base

`bash docs/bitacora/2026-11-03-amigos-y-foto-perfil/pruebas/correr_local.sh .` con la base local levantada. Corre como `supabase_admin` con `pg_safeupdate`, en una transacción que se deshace. Arma antes una cuenta con las dos fotos distintas, para probar el arreglo de datos y la inversa. Los avisos se capturan reemplazando `mm_emit` dentro de la transacción.

**Corrido el 2026-11-03:** "OK: el arreglo de datos de la 71", "OK: 11 pruebas del replanteo 71" y "OK: la inversa de la 71". Las pruebas cubren: aviso a los dos al sumar, sin aviso si no cambió nada, ficha sin cuenta (solo a quien lo hizo), sacar, la foto del jugador le gana a la de la ficha, la del admin puesta después gana, otro cambio del perfil o quitar la foto no tocan la de la ficha, y otra ficha no se toca.

### Web

`pnpm test` en `web/frontend`: 560 pruebas, todas bien (3 nuevas). `pnpm typecheck` y `pnpm lint` sin errores.

## En qué se apartó del plan

- **Pasó de `70` a `71`** (2026-11-03): Kyan aplicó en staging y en producción su propio `70_aviso_staff_equipos.sql` (`kyan/pruebas`, `fdeca5c2`). Se trajo a las dos ramas y este quedó después. El `PLAN.md` dice `70` y no se edita.
- Se sumó `mm_friend_users(ficha)`, para no repetir el armado de los destinatarios en las dos funciones.
- Se sumó un `CHANGELOG_DISCORD.txt` (2.9.10).

## Incidentes durante las pruebas

- `profile_details.avatar_url` tiene el check `avatar_url_propio` (URL del bucket `avatars`): las URL de prueba tuvieron que tener esa forma.
- El trigger `players_nick_alias` le cambia el nick a una ficha con cuenta: el caso previo se busca por `user_id`.
- Con `pg_safeupdate`, los `delete` de la tabla de avisos de prueba necesitan `where true`, y la tabla temporal necesita `grant` a `public` porque las funciones `security definer` corren como su dueño.

## Cómo revertir

1. Base: correr la inversa (`reversas/71_amigos_y_foto_perfil.sql`). Devuelve las fotos de ficha respaldadas si la ficha sigue sin foto.
2. Web: revertir el commit. Sin la `71`, `friend.changed` no llega y la web queda como antes.

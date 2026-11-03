# Amigos al instante y la misma foto de perfil en toda la web: guía de implementación

## Estado

Implementado y probado el 2026-11-03, con commit en las dos ramas. **Base aplicada en staging** el 2026-11-03 (cuando todavía se llamaba `70`, ver abajo). **Falta producción** (la base de producción ya tiene el corte, `01` a `70`) y desplegar la web. No se miró en el navegador.

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
2. ~~**Staging**~~: hecho el 2026-11-03. 0 fichas para el arreglo de datos; las pruebas en staging dentro de una transacción que se deshace dieron todas `OK`; aplicada y verificada (trigger, avisos en las dos funciones, permisos de `authenticated` y respaldo vacío). **Se aplicó como `70`**, así que en staging el respaldo se llama `replanteo70_fotos_ficha`: falta renombrarlo a `replanteo71_fotos_ficha` (`alter table public.replanteo70_fotos_ficha rename to replanteo71_fotos_ficha;` y su `comment`) para que la inversa lo encuentre. La consulta para contar las fichas:
   ```sql
   select count(*) from players p join profile_details d on d.user_id = p.user_id
   where p.photo_url is not null and d.avatar_url is not null and p.photo_url <> d.avatar_url;
   ```
   La API no cambia.
3. **Producción** (el corte ya se hizo, con los replanteos `01` a `70`): toca 2 fichas, kyan y saiko (lectura del 2026-11-03), que pasan a mostrar la foto de su cuenta; las de ficha quedan en el respaldo. Falta aplicarla (pide permiso).
4. **Web** en el VPS (`deploy/vps/desplegar.sh web` desde un checkout limpio en `v34frag-deploy`). Falta.

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

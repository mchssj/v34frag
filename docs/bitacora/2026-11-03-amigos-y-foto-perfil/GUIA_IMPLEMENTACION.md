# Amigos al instante y la misma foto de perfil en toda la web: guía de implementación

## Estado

Implementado y probado el 2026-11-03 en `feat/frontend-fase-1`, **sin commit y sin desplegar**: base (11 pruebas SQL, el arreglo de datos y la inversa, en local) y web (560 pruebas). No se miró en el navegador.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/70_amigos_y_foto_perfil.sql` | Nuevo |
| `supabase/replanteo/README.md` | Fila de la `70` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/70_amigos_y_foto_perfil.sql` | Nuevo: la inversa |
| `docs/bitacora/2026-11-03-amigos-y-foto-perfil/pruebas/*` | Nuevos: las pruebas SQL y su script |
| `web/frontend/src/features/matchmaking/queries.ts` y `queries.test.tsx` | `friend.changed` pide solo el perfil |
| `web/frontend/src/features/profile/lib/photo.ts` y `photo.test.ts` | Nuevos: `myPhotoUrl` |
| `web/frontend/src/features/profile/api/queries.ts` | `useUploadAvatar` renueva todas las consultas |
| `web/frontend/src/features/profile/pages/ProfileSection.tsx` | El avatar de Mi perfil con `myPhotoUrl` |
| `web/frontend/src/features/shell/components/AccountMenu.tsx` | El menú de la cuenta con `myPhotoUrl` |
| `web/frontend/src/features/onboarding/pages/WelcomeFlow.tsx` | La foto de la Bienvenida con `myPhotoUrl` |
| `docs/manual/jugador/crear-cuenta.md` y `docs/manual/admin/usuarios-y-fichas.md` | Qué foto se ve |

## Despliegue (pendiente)

1. **Commit en las dos ramas** (`friend.changed` es del matchmaking): la base (replanteo, inversa, pruebas y README de replanteos) en `feat/frontend-fase-1` y en `feat/mm-claim-en-sala`; la web, solo en `feat/frontend-fase-1`.
2. **Staging:** aplicar la `70` en `edaljnirzvisiaathitt`. Antes, mirar cuántas fichas va a tocar el arreglo de datos:
   ```sql
   select count(*) from players p join profile_details d on d.user_id = p.user_id
   where p.photo_url is not null and d.avatar_url is not null and p.photo_url <> d.avatar_url;
   ```
   La API no cambia. Desplegar la web.
3. **Producción**, con el corte.

## Pruebas

### Base

`bash docs/bitacora/2026-11-03-amigos-y-foto-perfil/pruebas/correr_local.sh .` con la base local levantada. Corre como `supabase_admin` con `pg_safeupdate`, en una transacción que se deshace. Arma antes una cuenta con las dos fotos distintas, para probar el arreglo de datos y la inversa. Los avisos se capturan reemplazando `mm_emit` dentro de la transacción.

**Corrido el 2026-11-03:** "OK: el arreglo de datos de la 70", "OK: 11 pruebas del replanteo 70" y "OK: la inversa de la 70". Las pruebas cubren: aviso a los dos al sumar, sin aviso si no cambió nada, ficha sin cuenta (solo a quien lo hizo), sacar, la foto del jugador le gana a la de la ficha, la del admin puesta después gana, otro cambio del perfil o quitar la foto no tocan la de la ficha, y otra ficha no se toca.

### Web

`pnpm test` en `web/frontend`: 560 pruebas, todas bien (3 nuevas). `pnpm typecheck` y `pnpm lint` sin errores.

## En qué se apartó del plan

- Se sumó `mm_friend_users(ficha)`, para no repetir el armado de los destinatarios en las dos funciones.
- Se sumó un `CHANGELOG_DISCORD.txt` (2.9.10).

## Incidentes durante las pruebas

- `profile_details.avatar_url` tiene el check `avatar_url_propio` (URL del bucket `avatars`): las URL de prueba tuvieron que tener esa forma.
- El trigger `players_nick_alias` le cambia el nick a una ficha con cuenta: el caso previo se busca por `user_id`.
- Con `pg_safeupdate`, los `delete` de la tabla de avisos de prueba necesitan `where true`, y la tabla temporal necesita `grant` a `public` porque las funciones `security definer` corren como su dueño.

## Cómo revertir

1. Base: correr la inversa (`reversas/70_amigos_y_foto_perfil.sql`). Devuelve las fotos de ficha respaldadas si la ficha sigue sin foto.
2. Web: revertir el commit. Sin la `70`, `friend.changed` no llega y la web queda como antes.

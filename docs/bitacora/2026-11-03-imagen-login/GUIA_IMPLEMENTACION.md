# Imagen del inicio de sesión configurable: guía de implementación

## Estado

Implementado y probado el 2026-11-03 en `feat/frontend-fase-1`, con commit el 2026-11-03 y **sin desplegar**: base (10 pruebas SQL e inversa, en local), API (466 pruebas) y web (553 pruebas).

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/67_imagen_login.sql` | Nuevo: `site_config`, `site_auth_image()` y `site_admin_set_auth_image(url)` |
| `supabase/replanteo/README.md` | Fila de la `67` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/67_imagen_login.sql` | Nuevo: la inversa |
| `docs/bitacora/2026-11-03-imagen-login/pruebas/67.sql` y `correr_local.sh` | Nuevos: 10 pruebas SQL y su script (con `pg_safeupdate` cargado) |
| `web/backend/src/routes/site.ts` | Nuevo: las tres rutas |
| `web/backend/src/app.ts` | Monta `site` |
| `web/backend/test/unit/site-auth-image.test.ts` | Nuevo: 9 pruebas (lectura con y sin sesión, subida, proporción y medidas, permisos, rechazo de la base y quitar) |
| `web/frontend/src/features/auth/api/authImage.ts` | Nuevo: consulta y mutaciones |
| `web/frontend/src/features/auth/components/AuthShell.tsx` | El panel muestra la imagen |
| `web/frontend/src/features/auth/components/AuthShell.test.tsx` | Nuevo: con imagen y sin imagen |
| `web/frontend/src/features/admin/users/components/AuthImageTab.tsx` | Nuevo: la pestaña de Administración |
| `web/frontend/src/features/admin/users/components/AuthImageTab.test.tsx` | Nuevo: subir sin imagen y quitar |
| `web/frontend/src/features/admin/users/pages/AdminUsersPage.tsx` | Pestaña "Inicio de sesión" (`login`) |
| `web/frontend/src/lib/image.ts` | `cropAuthImage` (1600 × 2000) |

## Despliegue (pendiente)

En staging, cuando Daniel lo pida:

1. **Base:** aplicar `67_imagen_login.sql` en staging (`edaljnirzvisiaathitt`). No necesita nada antes: el bucket `photos` ya existe y el admin escribe en cualquier carpeta (`supabase/schema/auth_storage.sql`).
2. **API:** desplegar `web/backend` con `site.ts`. **Ojo con la rama:** la API de staging del manual y de los últimos cambios del matchmaking salió de `feat/mm-claim-en-sala`. Si el próximo despliegue de la API sale de esa rama, hay que llevar ahí `site.ts`, el cambio de `app.ts`, la prueba, el replanteo y la inversa (no chocan: allá el último replanteo también es el `66`).
3. **Web:** desplegar `web/frontend`.
4. Subir una imagen en Administración › Usuarios › Inicio de sesión y mirarla en `/login` en 1440, 1920 y un teléfono.

En producción, con el corte.

## Pruebas

### Base

`bash docs/bitacora/2026-11-03-imagen-login/pruebas/correr_local.sh .` con la base local levantada (`web/backend`: `pnpm db:start`). Corre la `67`, las 10 pruebas y la inversa dentro de una transacción que se deshace, como `supabase_admin` y con `pg_safeupdate` cargado (como `postgres` da `access to library "safeupdate" is not allowed`).

**Corrido el 2026-11-03:** "OK: 10 pruebas del replanteo 67" y "OK: la inversa de la 67". Se verificó aparte que en esa sesión un `UPDATE` sin `WHERE` falla ("UPDATE requires a WHERE clause"), así que la prueba cubre el caso de staging. La base local quedó sin `site_config`.

### API

`pnpm test` en `web/backend`: 466 pruebas, todas bien, 9 de ellas nuevas.

### Web

`pnpm test` en `web/frontend`: 553 pruebas, todas bien, 4 de ellas nuevas. `pnpm typecheck` y `pnpm lint` sin errores. No se miró en el navegador.

## En qué se apartó del plan

- `schema.d.ts` no se regeneró: el que está en la rama está muy atrás de la API (regenerarlo trae unas 4.600 líneas de otros módulos). La web llama con `authFetch`, como la imagen del MVP. Al regenerarlo, `authImage.ts` puede pasar a `api.GET(...)` con `unwrap`.
- El recorte de la web pesa hasta 1,5 MB (el plan decía 1 MB): una foto con mucho detalle en 1600 × 2000 no siempre baja de 1 MB en JPEG al 70 %.

## Cómo revertir

1. Base: correr la inversa (`reversas/67_imagen_login.sql`). El archivo queda en `photos/site/`: borrarlo a mano.
2. API: quitar `site.ts` y su línea en `app.ts`.
3. Web: revertir `AuthShell.tsx` y `AdminUsersPage.tsx`, y borrar `authImage.ts`, `AuthImageTab.tsx` y `cropAuthImage`. Sin la ruta, la web también deja el panel gris (la consulta falla y no se reintenta).

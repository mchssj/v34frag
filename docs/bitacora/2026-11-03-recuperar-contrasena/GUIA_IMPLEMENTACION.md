# Recuperar la contraseña en la web nueva: guía de implementación

## Estado

Implementado y probado en local el 2026-11-03 (pruebas unitarias, de integración contra la Supabase local y a mano en el navegador). **Sin commit, sin desplegar y sin cargar la plantilla en producción.** Falta que lo revisen Daniel (API) y Esteban (diseño de las pantallas).

## Archivos

| Archivo | Cambio |
|---|---|
| `web/backend/src/routes/auth.ts` | Rutas `POST /auth/password/forgot` y `POST /auth/password/reset`. Helper `setPassword`, que ahora usan el cambio de contraseña y la recuperación (antes el código estaba dentro de `changePassword`). |
| `web/backend/src/schemas/auth.ts` | `ForgotPasswordBody`, `ForgotPasswordResult` y `ResetPasswordBody`. |
| `web/backend/src/lib/ratelimit.ts` | Regla `recovery` (5 por 60 s, binding `RL_RECOVERY`). |
| `web/backend/src/lib/errors.ts` | Código `INVALID_LINK`. |
| `web/backend/wrangler.toml` | `[[ratelimits]]` `RL_RECOVERY`, namespace `1005` y `1006` en `preview`. |
| `web/backend/test/unit/auth-routes.test.ts` | 13 casos nuevos (GoTrue simulado). |
| `web/backend/test/integration/auth.test.ts` | `describe('Recuperar la contraseña')`, 4 casos contra la Supabase local, con su propia app para no compartir el contador de intentos. |
| `web/frontend/src/api/schema.d.ts` | Regenerado desde la OpenAPI de este backend. El diff es grande porque el archivo de esta rama estaba atrasado respecto de su propio backend: trae también endpoints que otros agregaron antes. |
| `web/frontend/src/api/errors.ts` | `INVALID_LINK` y su mensaje. |
| `web/frontend/src/auth/schemas.ts` | `forgotPasswordSchema` y `resetPasswordSchema` (8 a 72 caracteres, como el registro, y las dos tienen que coincidir). |
| `web/frontend/src/auth/queries.ts` | `useForgotPassword` y `useResetPassword` (guarda la sesión con "Recordarme"). |
| `web/frontend/src/auth/callback.ts` y `callback.test.ts` | Links de recuperación viejos y `token_hash` en la raíz. |
| `web/frontend/src/features/auth/components/ui.tsx` | `AuthNotice`. |
| `web/frontend/src/features/auth/pages/ForgotPasswordForm.tsx` y `.test.tsx` | Nuevo. |
| `web/frontend/src/features/auth/pages/ResetPasswordForm.tsx` y `.test.tsx` | Nuevo. |
| `web/frontend/src/features/auth/pages/LoginForm.tsx` y `.test.tsx` | Link "¿Olvidaste tu contraseña?". |
| `web/frontend/src/routes/_auth/forgot-password.tsx` | Nuevo. |
| `web/frontend/src/routes/reset-password.tsx` | Nuevo (fuera de `_auth`). |
| `web/frontend/src/routeTree.gen.ts` | Regenerado por el plugin del router. |
| `deploy/auth/plantillas/recuperacion.html` | El botón y el link de texto van a `{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery`. |

## Qué le toca a cada uno

| Quién | Qué |
|---|---|
| **Daniel** (backend) | Revisar las dos rutas, el helper `setPassword`, la regla `recovery` y el binding de `wrangler.toml`. Pasar el cambio a la rama que se despliega y desplegar la API en el VPS. |
| **Killuaz (Esteban)** (frontend y diseño) | Revisar y ajustar el diseño de `/forgot-password`, `/reset-password`, el link del login y `AuthNotice`. Los textos y el layout son provisorios: se armaron con las piezas que ya tenía el login (`AuthShell`, `AuthHeading`, `AuthField`, `ErrorAlert`), sin handoff. El panel derecho de `AuthShell` va vacío (`side={null}`). |
| **Kyan** | Cargar la plantilla nueva en producción **después** de desplegar la API y el frontend, y probarla con una cuenta de prueba. |

**Ramas:** se implementó en `kyan/pruebas`. El código de la web también vive en `origin/feat/frontend-fase-1`, y las dos ramas se separaron (algunos archivos de auth no son iguales, por ejemplo `AuthShell` y `LoginForm`). Hay que pasarlo a la rama que se despliega con cuidado de no pisar esas diferencias.

## Despliegue (pendiente)

Todavía no se hizo. El orden es este:

1. API: desplegar `web/backend` en el VPS. Ahí el límite usa el contador en memoria, así que no hay nada que configurar. Si algún día corre como Worker, `wrangler deploy` crea el binding `RL_RECOVERY`.
2. Frontend: build y despliegue de `web/frontend`.
3. Comprobar que la configuración de Auth de producción tenga `site_url = https://cmleague.lat` y `https://cmleague.lat/**` en `uri_allow_list` (lo estaba aplicando Kyan con `configurar-auth.mjs`).
4. Plantilla: desde la raíz del repo, primero sin `--aplicar` para ver la diferencia y después con `--aplicar`:

   ```bash
   node deploy/auth/configurar-auth.mjs <VARIABLE_CON_LA_URL_DE_PRODUCCION>
   ```

   ```bash
   node deploy/auth/configurar-auth.mjs <VARIABLE_CON_LA_URL_DE_PRODUCCION> --aplicar
   ```

5. Probar con una cuenta de prueba: pedir el correo desde `/forgot-password`, abrir el link, poner una contraseña y entrar.

Mientras la plantilla vieja siga cargada, los correos llegan con tokens en el fragmento. El frontend los descarta y lleva a "pedir otro correo", así que el flujo completo recién funciona después del paso 4.

## Pruebas

### API (`web/backend`)

- `pnpm test`: 33 archivos y 449 pruebas, todas bien. Las nuevas cubren `forgot` (`202` igual con un error de Supabase, `redirect_to`, `400`, `429` al sexto pedido sin gastar el contador del login) y `reset` (sesión, `PUT` con el token de la recuperación, `logout?scope=others`, `INVALID_LINK` con `otp_expired`, `otp_disabled` y `validation_failed`, `429`, `SAME_PASSWORD`, `VALIDATION_ERROR`).
- `pnpm exec vitest run --project integration test/integration/auth.test.ts`: 18 pruebas, todas bien. Las nuevas usan `admin.generateLink({ type: 'recovery' })` y comprueban que `forgot` responde lo mismo con y sin cuenta, que `reset` cambia la contraseña, actualiza `password_changed_at` y deja sin servir los refresh tokens de antes, que el link no sirve dos veces, que un `token_hash` inventado da `INVALID_LINK` y que pedir un link nuevo invalida el anterior.
- El resto de la suite de integración no se corrió.
- `pnpm typecheck`: sin errores.

### Frontend (`web/frontend`)

- `pnpm test`: 79 archivos y 517 pruebas. Falla una: `src/features/shell/lib/nav.test.ts` espera "Usuarios" y recibe "Usuarios y moderación". Ya fallaba antes de este cambio y no toca ningún archivo de esta tarea. Las de auth (13 archivos y 123 pruebas) pasan.
- `pnpm typecheck`: sin errores. `eslint` sobre los archivos tocados: sin errores.

### A mano en local (2026-11-03)

API local (puerto 8790) y frontend (puerto 5175) contra la Supabase local, con una cuenta de prueba local (`recuperar-prueba@test.local`):

1. El login muestra "¿Olvidaste tu contraseña?" y lleva a `/forgot-password`.
2. Al pedir el correo aparece "Revisa tu correo" y el correo llega a Mailpit (con la plantilla por defecto de la Supabase local).
3. Con un link `/reset-password?token_hash=…&type=recovery` (sacado con `generateLink`), el token sale de la barra al cargar. Al guardar la contraseña nueva, la web entra a `/home`.
4. El mismo link otra vez, con la sesión abierta: la página abre igual y, al guardar, muestra "El enlace no es válido o venció" con "Pedir otro correo".
5. `/#access_token=…&type=recovery` lleva a `/forgot-password?aviso=enlace-viejo` con el aviso.

No hay capturas: el panel del navegador no dibujaba la página. No se probó con Resend ni con la plantilla nueva, que necesitan staging o producción.

## En qué se apartó del plan

- **`/reset-password` no está dentro de `_auth`.** `_auth` saca a `/home` a quien ya tiene sesión, y el link del correo tiene que funcionar aunque haya otra sesión abierta en ese navegador (por ejemplo, la de otra persona en una PC compartida). Al guardar, la sesión nueva reemplaza a la que hubiera.
- **El link del login no lleva el email ya escrito.** Habría que pasarlo en la URL (`?email=`), y los datos personales no van en la URL.
- **`SAME_PASSWORD` en la recuperación** también muestra el aviso de "pedir otro correo", porque el link ya quedó gastado.
- **Se agregó `AuthNotice`** (componente del aviso) para no copiar el JSX del aviso de `login.tsx`. `login.tsx` no se tocó.
- **`schema.d.ts` se regeneró completo** con `openapi-typescript` desde la OpenAPI del backend (no con `pnpm gen:api`, que necesita la API en el puerto 8787). Por eso trae también endpoints que faltaban en esta rama.
- **La regla `recovery` no tiene una prueba propia en `ratelimit.test.ts`.** Que no comparte el contador con `auth` se prueba en `auth-routes.test.ts`.

## Cómo revertir

- Antes del commit: `git checkout -- <archivo>` con los archivos de la tabla y borrar los archivos nuevos.
- Después del commit: `git revert <commit>`.
- Si la plantilla nueva ya se cargó en producción y hay que volver atrás: restaurar `{{ .ConfirmationURL }}` en `deploy/auth/plantillas/recuperacion.html` y correr `configurar-auth.mjs ... --aplicar`. Con la plantilla vieja, la web descarta los tokens y pide otro correo: la recuperación deja de funcionar, pero no se rompe nada más.

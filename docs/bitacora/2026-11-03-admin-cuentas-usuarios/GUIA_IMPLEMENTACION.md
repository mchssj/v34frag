# Acciones de cuenta en Administración › Usuarios: guía de implementación

## Estado

**Desplegado el 2026-11-04 (02:26 a 02:33 UTC).** API `0d5732881cbe-local11040226`, web `653c3f9cd7cb-local11040227`, replanteo `72` en staging y en producción, y la confirmación del correo **encendida**. Daniel probó el correo real: funcionó.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/72_admin_cuentas.sql` y `README.md` | Nuevo: registro y funciones |
| `web/backend/src/routes/admin-players.ts` | Cuatro rutas nuevas |
| `web/backend/src/lib/password.ts` | Nuevo: contraseña aleatoria |
| `web/backend/src/lib/supabase.ts` | `serviceClient` |
| `web/backend/src/schemas/admin.ts` y `db/types.ts` | Esquemas y tipos de las funciones |
| `web/backend/test/unit/admin-account.test.ts` | Nuevo: 11 pruebas |
| `web/frontend/src/features/admin/users/components/AccountSection.tsx` y `.test.tsx` | Nuevo: la sección Acceso, con 6 pruebas |
| `web/frontend/src/features/admin/users/api/queries.ts` y `components/AccountsTab.tsx` | Consultas y mutaciones; la sección en el panel |
| `web/frontend/src/api/schema.d.ts` | Regenerado |
| `deploy/supabase/instalar.sh` | `sb confirmar-correo` |
| `docs/manual/admin/usuarios-y-fichas.md` y `jugador/crear-cuenta.md` | Manual |
| `terms/privacidad.html` y `PrivacyPage.tsx` | Quién puede ver una contraseña |

## Despliegue (hecho el 2026-11-04)

Junto con [`2026-11-03-recuperar-contrasena`](../2026-11-03-recuperar-contrasena/), con 0 mix, salas y cola:

1. Respaldo (`20261104T022601Z`), con la primera subida real a R2.
2. `72_admin_cuentas.sql` en producción, sin CR.
3. `SUPABASE_SERVICE_KEY` en `/etc/cmleague/api.env` (el anterior, `api.env.antes-cuentas`).
4. API: `deploy/vps/desplegar.sh api` desde un worktree en `0d573288`, con estos cambios y el `docs/manual` de esta rama. **No se despliega desde `feat/frontend-fase-1`:** le faltan el manual y el anticheat. El código quedó en la rama local `deploy/api-produccion` y en `pruebas/api_desplegada_sobre_0d573288.patch`. `VPS_HOST` va por el entorno, porque el worktree no tiene `.env`.
5. Web: `deploy/vps/desplegar.sh web` desde `feat/frontend-fase-1`.
6. Plantillas en `/srv/supabase/plantillas`, `Caddyfile` (`/plantillas/*`; el anterior, `Caddyfile.antes-plantillas`) e `instalar.sh`, que recreó `auth` y `kong`.
7. Prueba de punta a punta (`pruebas/e2e_cuentas.py`).
8. `sudo sb confirmar-correo on`.

## Pruebas

### API
- `admin-account.test.ts`: 11 de 11. Solo admins, 409 con la cuenta confirmada, 429 con el límite de correos, 501 sin la clave y sesiones que no se pudieron cerrar.
- Suite completa sobre la base de despliegue (`0d573288`): 515 pruebas, 1 omitida.

### Web
- `AccountSection.test.tsx`: 6 de 6. `tsc` y ESLint sin errores.

### Base (staging, en una transacción que se deshace)
Con un admin y un usuario reales de staging, un segundo admin y una cuenta sin confirmar creados solo para la prueba:

| Caso | Resultado |
|---|---|
| Estado y reenvío de una cuenta sin confirmar | Correcto, devuelve el correo |
| Reenvío a una cuenta confirmada | `23505` |
| Aleatoria a un usuario | Se permite y queda registrada |
| Aleatoria a la propia cuenta y a otro admin | `42501` |
| Cuenta inexistente y acción desconocida | `P0002` y `P0001` |
| Cerrar sesiones | 0 sesiones después |
| Un usuario normal en las tres funciones | `42501` |
| Un usuario normal leyendo el registro | 0 filas; el admin ve las suyas |

### Punta a punta en producción (`pruebas/e2e_cuentas.py`, cuentas temporales ya borradas, correos a `delivered@resend.dev`)

- **Recuperar la contraseña:** pedir el correo, elegir la nueva con el link, entrar con ella, rechazar la vieja, y el link no sirve dos veces.
- **Acciones:** estado, 409 al reenviar a una confirmada, correo de contraseña sin invalidar la actual, aleatoria (16 caracteres, `no-store`, la anterior rechazada, el refresh viejo da 401 y entra con la nueva), 403 en la propia y registro de 2 acciones.
- **Confirmación encendida:** el registro pide confirmar, sin confirmar no entra (`EMAIL_NOT_CONFIRMED`), el panel lo muestra, el reenvío funciona, el link vuelve a `https://cmleague.lat` (303) y después entra.
- **`sb confirmar-correo on`:** ejecutado. `off` no se ejecutó.
- La primera corrida se cortó con 429: la propia prueba pasó el límite de 10 inicios de sesión por minuto. La parte de la confirmación se repitió y pasó.

### Sin probar todavía
- Cómo se ve el correo real con la plantilla: la clave de Resend no deja leer los correos enviados. Resend los aceptó.

### Cambiar la contraseña desde Mi perfil
Probado en producción con una cuenta temporal, ya borrada: entra con la nueva y rechaza la vieja.

## En qué se apartó del plan

- **Interruptor de la confirmación:** Daniel pidió que fuera fácil de encender y apagar. Se agregó `sb confirmar-correo`, que no estaba en el plan.
- **El estado de la cuenta se ve en el detalle, no en la lista:** una ruta `GET /account` propia, sin cambiar la vista de la lista.
- **Cuenta confirmada:** el 409 lo produce la base (`23505`).
- **El registro no guarda el resultado:** se escribe antes de la acción.
- **Sesiones:** `auth.admin.signOut` pide el token del usuario, no su id, así que se borran de `auth.sessions` con una función. Un token de acceso ya emitido puede valer hasta 1 hora.
- **`GOTRUE_RATE_LIMIT_EMAIL_SENT`:** no se tocó. Si hay muchos registros y aparecen 429 al enviar correos, hay que subirlo.
- **La API y la web se desplegaron juntas** con recuperar la contraseña, no en dos tandas.

## Cómo revertir

- **Confirmación:** `sudo sb confirmar-correo off --confirmar-pendientes`.
- **API y web:** volver a la versión anterior en `/srv/cmleague/<parte>/releases/`, como dice `deploy/vps/README.md`.
- **Clave:** sacar `SUPABASE_SERVICE_KEY` de `api.env` y reiniciar la API. La aleatoria responde 501.
- **Base:** borrar las tres funciones y `account_admin_actions`. Se pierde el registro.

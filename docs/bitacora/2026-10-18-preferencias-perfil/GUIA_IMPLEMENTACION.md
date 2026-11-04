# Preferencias de la cuenta (`preferences.theme_fx`): guía de implementación

## Estado

Hecho y probado en local el 2026-10-18, en la rama `feat/backend-api-fase-1`. **Sin desplegar:** la migración `18` y la API salen en el corte. Mientras tanto, el frontend sigue con el valor del navegador.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/18_preferencias.sql` | Nuevo: `user_preferences`, políticas y `set_my_preferences` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/18_preferencias.sql` | Nuevo: la inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/18_preferencias.sql` | Nuevo: 14 comprobaciones |
| `supabase/replanteo/README.md` | Fila de la `18` |
| `web/backend/src/db/types.ts` | Regenerado |
| `web/backend/src/schemas/profile.ts` | `THEME_FX`, `Preferences`, `PreferencesPatch`; `preferences` en `MyProfile` y `ProfilePatch` |
| `web/backend/src/routes/me.ts` | Lee `user_preferences` y llama a `set_my_preferences` |
| `web/backend/test/unit/me-routes.test.ts` | El simulador conoce la tabla y la función; 3 pruebas nuevas |
| `web/backend/test/integration/me.test.ts` | 1 prueba nueva |
| `docs/frontend/contract.md` | Sección 2, novedades y registro de decisiones |
| `docs/PENDIENTES.md`, `docs/bitacora/README.md` | Estado |

## Despliegue

Nada todavía. En el corte, la `18` va después de la `17`.

## Pruebas

**Base:** `pruebas/18_preferencias.sql`, 14 comprobaciones, todas bien:
- Guardar, sumar otra clave sin pisar `theme_fx`, cambiar y borrar con `null`.
- Rechazo de un valor desconocido (la restricción) y de algo que no es un objeto.
- Otro usuario no ve la fila ni la cambia (`update` sin efecto, `insert` rechazado por la RLS).
- Anon sin permisos sobre la tabla ni la función.
- Se borra con la cuenta.

**`correr.sh`** (las 18 migraciones con sus inversas y su segunda aplicación): "Todo ok".

**API:**
- Unitarias:
  - `null` sin fila, el valor guardado, y un valor desconocido en la base que se lee como `null`.
  - `set_my_preferences` con lo enviado (y con `null`), sin tocar `profile_details`.
  - `400 VALIDATION_ERROR` con otro valor, un booleano, una clave desconocida o un texto en lugar del objeto.
- Integración:
  - Guardar, cambiar otro campo sin tocar las preferencias, cambiar y borrar.
  - Otra cuenta sigue en `null`, y un valor inválido da `400`.
- Suite completa: 251 pruebas unitarias y 81 de integración, sin errores de tipos.

## En qué se apartó del plan

Ninguno. El código del error es `VALIDATION_ERROR`, el de toda la API; el pedido decía `VALIDATION` y quedó aclarado en el contrato.

## Cómo revertir

- **Antes del corte:** revertir el commit.
- **Después del corte:** aplicar `reversas/18_preferencias.sql`. Se pierden las preferencias guardadas y el frontend vuelve a las del navegador.

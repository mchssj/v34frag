# Demos desde el admin: guía de implementación

## Estado

Hecho y probado en local el 2026-10-16: migración `14` y backend. **Sin commit y sin desplegar.** La `14` se aplica en el corte, después de la `13`. Daniel aprobó el plan el 2026-10-16.

Con esta entrega quedan terminados los endpoints de dominio.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/14_demos_admin.sql` | Nuevo: nombre único de los Workers, alta con id y token, token nuevo, reintentar y las tres vistas |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/14_demos_admin.sql` | Nuevo: inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/14_demos_admin.sql` | Nuevo: pruebas |
| `web/backend/src/schemas/demos.ts` | Nuevo |
| `web/backend/src/schemas/common.ts` | `confirmField` y `CONFIRM_TEXT`: la doble confirmación, compartida con el ELO |
| `web/backend/src/schemas/elo.ts` | Usa `confirmField('recalcular')` (mismo comportamiento y mensaje) |
| `web/backend/src/routes/admin-demos.ts` | Nuevo: los ocho endpoints |
| `web/backend/src/app.ts` | Registra la ruta |
| `web/backend/src/db/types.ts` | Tipos regenerados con la `14` |
| `web/backend/test/unit/demos-routes.test.ts` | Nuevo |
| `web/backend/test/integration/demos.test.ts` | Nuevo |
| `docs/frontend/contract.md` | Filas de los dos listados, sección "Demos (admin)", pendientes y registro de decisiones |
| `supabase/replanteo/README.md`, `docs/bitacora/2026-10-14-replanteo-modelo-datos/DOCUMENTACION.md`, `docs/PENDIENTES.md` | Fila de la `14`; corte con 01 a 14; endpoints de dominio terminados |

## Despliegue (pendiente: va en el corte)

1. **Base:** aplicar `supabase/replanteo/14_demos_admin.sql` después de la `13`. Aborta si hay Workers con el mismo nombre (en la copia del 2026-10-14 hay uno solo).
2. **Backend:** sale con el primer despliegue. Usa `DEMO_BASE_URL`, que ya existe, para `demo_url`.
3. **Worker y Cloudflare:** nada. El token actual del Worker sigue sirviendo.

## Pruebas

- **`correr.sh`** pasa con 01 a 14.
- **`pruebas/14_demos_admin.sql`**, con una partida por estado y dos servidores (con y sin id del panel):
  - Un usuario común ve las vistas vacías y no puede reintentar ni crear Workers.
  - Listado: vencimiento solo de las subidas, servidor y búsqueda.
  - Resumen: cantidades, bytes y pendiente más vieja.
  - Reintentar una perdida; los cinco rechazos con su mensaje.
  - Worker: formato del token, nombre repetido, vista sin hash, el token sirve para `demo_pending` (y ve la reintentada), queda en línea, token nuevo (reactiva y el viejo da `PT401`).
- **Backend:**
  - `pnpm typecheck` sin errores.
  - 241 pruebas unitarias (8 nuevas).
  - 71 de integración (5 nuevas): permisos, resumen, listado con cada filtro y orden, vencimiento y `demo_url`, reintentar (servidor sin panel, ya subida y una perdida que pasa a la cola), ciclo completo del Worker contra `demo_pending` (alta, en línea, nombres repetidos, token nuevo sin y con confirmación, revocar y borrar).
- **Cobertura:** 97,6 % de líneas en total; `admin-demos.ts` al 100 %. Dos corridas seguidas con cobertura pasaron completas.
- **Copia de producción:** solo se contó (14 demos subidas, 342 MB, 1 Worker activo). No se cargó en la base local.

## En qué se apartó del plan

- **`can_retry`** en cada demo del listado, para que el frontend sepa cuándo mostrar el botón sin repetir la regla.
- **`confirmField`** pasó a `schemas/common.ts` para compartir la doble confirmación con el ELO. El mensaje dice la acción: "Para generar un token nuevo, escribe…" o "Para recalcular, escribe…".
- **Pendiente más vieja:** usa la fecha jugada o, si no tiene, la programada (`matches` no tiene `created_at`).

## Incidentes durante las pruebas

- Ninguno en esta entrega.
- Durante la sesión, Daniel pidió liberar el puerto 3030. Lo usaba el contenedor `infrastructure-backend_api-1` (de otro proyecto, con reinicio `always`), que arrancó al abrir Docker Desktop. Se detuvo con `docker stop`.

## Cómo revertir

- **En local:** aplicar `reversas/14_demos_admin.sql`.
- **Backend:** revertir el commit de esta entrega.
- **En producción:** no aplica todavía.

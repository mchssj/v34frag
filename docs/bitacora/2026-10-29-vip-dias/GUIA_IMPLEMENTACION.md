# Guía de implementación: días que lleva cada usuario como VIP

## Estado

- **Hecho y probado en la Supabase local (2026-10-29).** Sin commit. **Sin aplicar en producción.**
- No toca el plugin ni los servidores (real, RBK y flow): no hay nada que desplegar ahí.

## Aplicar en producción

1. Supabase › SQL Editor › pegar `supabase/migrations/20261029120000_vip_dias.sql` › Run. Es re-ejecutable.
2. Comprobar con una cuenta conocida:

```sql
select alias, status, active_since, days_active from public.vip_status order by days_active desc nulls last;
```

Desde el SQL Editor la vista no devuelve filas (filtra por `auth.uid()` o `is_admin()`); para mirarla ahí, correr la consulta con la sesión de un admin o copiar el `select` de la vista sin el `where`.

## Pruebas

```sh
docker exec -i supabase_db_v34frag-api psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/migrations/20261029120000_vip_dias.sql
docker exec -i supabase_db_v34frag-api psql -U postgres -v ON_ERROR_STOP=1 -q < docs/bitacora/2026-10-29-vip-dias/pruebas/vip_dias.sql
```

Resultado del 2026-10-29: las 7 de `vip_dias.sql` en OK, y las 45 de `docs/bitacora/2026-10-28-vip-fase-0/pruebas/vip_produccion.sql` siguen en OK con la vista nueva.

## Cambios respecto al plan

- **Fechas reales de los VIP de Kyan (2026-10-29):** la carga inicial ponía `starts_at = now()`. Daniel pasó las fechas de compra (todos lifetime): uriel (`instt`), cypee-thor (`shoxmeister`) y roman (`romanxz`) el 2026-10-26, y sandeerz el 2026-10-27. `docs/bitacora/2026-10-28-vip-fase-0/pruebas/carga_inicial_vip.sql` ahora:
  - Carga a cada uno desde la medianoche de Colombia de su día de compra, con lo que pagó en la nota (solo la ven el dueño y los admins).
  - Si ya estaba cargado (`source = 'import'`), le corrige la fecha y la nota en lugar de abortar.
  - Si la ficha todavía no tiene cuenta, la salta con un aviso `PENDIENTE`; se vuelve a correr el mismo archivo cuando la cree.
  - Probado en local con rollback, dos corridas seguidas: sin duplicados y 3 días al 2026-10-29 para los del 26.

## Lo que queda

- **API y frontend nuevo:** sumar `days_active` (y `active_since`) a `GET /api/v1/admin/vips`, `GET /api/v1/admin/users/{id}/vip` y `vip` de `/me/profile`, regenerar `web/backend/src/db/types.ts` y actualizar el contrato. Cuando Daniel lo pida.
- **Web vieja:** `index.html` todavía no muestra nada del VIP; la columna queda disponible en `vip_status`.

# Guía de implementación: replanteo 70

**Aplicado el 2026-11-03 en staging y en producción**, por Kyan con Claude.

| Archivo | Qué es |
|---|---|
| `supabase/replanteo/70_aviso_staff_equipos.sql` | Suma `team_staff_action` a la categoría `team`. Si ya está, no hace nada. Aborta si la función cambió y comprueba al final que la categoría sea `team` y que el aviso siga siendo obligatorio |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/70_aviso_staff_equipos.sql` | La inversa |

**Cómo se encontró:** el código de seguimiento solo queda en el log de la API del VPS. En los logs de la Supabase de producción (Management API, `analytics/endpoints/logs`) aparecieron dos `POST | 400 | rpc/team_staff_dissolve` a las 17:39 UTC, con el error `not-null` de `notifications.category`.

**Comprobado:**
- En las dos bases, `notification_category('team_staff_action') = 'team'` y `notification_required('team_staff_action') = true`.
- De los 55 tipos de aviso (los de todos los `notify(…)` de las funciones y los de `notifications.type`), ninguno queda sin categoría.

**Falta:**
- Probarlo desde la web: disolver un equipo de prueba desde Administración › Equipos.
- Sumar la fila de la `70` en `supabase/replanteo/README.md` al mezclar con `feat/frontend-fase-1`. En `kyan/pruebas` ese README llega hasta la `62`, y la `63` a la `69` están solo en esa rama.

No toca la API ni el plugin: no hay nada que subir a los servidores (#1 MVZG, #2 flow, #3 `aurav34`).

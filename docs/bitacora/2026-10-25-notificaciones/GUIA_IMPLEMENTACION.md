# Notificaciones (primera etapa): guía de implementación

## Estado

Implementado y probado en local el 2026-10-25, sin commit ni despliegue. La migración está aplicada en la Supabase local (copia de producción con BETA). Falta conectar la campana del frontend (otro requerimiento) y la segunda etapa (tareas programadas).

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/28_notificaciones.sql` | Nuevo: tabla, `notify()` y ayudantes, 22 triggers, `season_close_due` con el aviso a los admins, funciones y vista para la API |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/28_notificaciones.sql` | Nueva: la inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/28_notificaciones.sql` | Nuevas: 43 pruebas SQL con rollback |
| `supabase/replanteo/README.md` | Fila de la `28` |
| `web/backend/src/routes/notifications.ts`, `src/schemas/notifications.ts` | Nuevos |
| `web/backend/src/app.ts` | Monta las rutas |
| `web/backend/src/routes/me.ts`, `src/schemas/profile.ts` | `preferences.notifications` en `GET` y `PATCH /me/profile` |
| `web/backend/src/db/types.ts` | Regenerado con `pnpm db:types` |
| `web/backend/test/unit/notifications-routes.test.ts`, `test/integration/notifications.test.ts` | Nuevas |
| `web/backend/test/unit/me-routes.test.ts`, `test/integration/me.test.ts` | Las preferencias ahora traen `notifications` |
| `docs/frontend/contrato/notificaciones.md` (nuevo), `README.md`, `cuenta.md`, `decisiones.md` | Contrato |
| `docs/PENDIENTES.md` | La `28` en el corte, la segunda etapa y la primera temporada con el SQL de BETA (no desde el admin) |

## Cambios respecto al plan

| Plan | Quedó | Por qué |
|---|---|---|
| Algunos eventos se creaban dentro de las funciones (`team_invite`, `set_team_captain`, `veto_act`, `event_set_result`, `accept_pcw`…) | Casi todos son **triggers en las tablas**. Solo `season_close_due` se modificó (con `pg_temp.reemplazar`) | Un trigger cubre todos los caminos: la API, el plugin, los vencimientos automáticos (`team_invites_expire`) y el SQL del admin, sin tocar funciones que ya funcionan |
| `event_progress`: avanzó, quedó eliminado o campeón | Solo **campeón y subcampeón**, al terminar el torneo (de `player_titles`) | Saber si un equipo "avanzó" o "quedó eliminado" depende de la plantilla (doble eliminación, grupos, suizo). Queda para la segunda etapa si hace falta |
| `admin_users()` | `notify_admin_ids()` | Ya existía `admin_users(text)`: con un `admin_users()` sin argumentos, las llamadas a la vieja quedaban ambiguas (lo detectaron las pruebas `11`, `16` y `22`) |
| `match_ref(matches)` | `match_ref(uuid)` | Una función que recibe la fila de `matches` es una columna calculada para PostgREST (aparecía en los tipos) |
| Vista `notification_list` con `security_invoker` | Sin `security_invoker`, filtrada por `auth.uid()` | La RLS de `profiles` solo deja ver la propia fila: el alias del autor salía null |
| `season_closed` a todos los de la foto del cierre | Solo a los que jugaron algún mix en la temporada (`matches > 0`) | La foto incluye a todos los que tienen ELO, aunque no hayan jugado |

## Despliegue

No se desplegó. En el corte, la `28` va después de la `27` (aborta si falta `mix_deletions` o `season_standings`). No necesita datos previos ni configuración. Desde ese momento, todo lo que pase genera notificaciones.

Para deshacerla: la inversa de `reversas/28_notificaciones.sql`. Las preferencias de notificaciones que haya en `user_preferences` quedan, sin efecto.

## Pruebas (2026-10-25)

### SQL

- `pruebas/28_notificaciones.sql`: **43 OK**, con rollback. Cubren:
  - `notify()`: el autor, las fichas sin cuenta, las categorías apagadas, Novedades apagada por defecto, las obligatorias y el tope de 100;
  - el flujo de invitar, aceptar, pedir, rechazar y cancelar con las funciones reales, con su resolución;
  - el nuevo líder; te sacaron, se fue y cambió el rol; el alta del admin, y que un equipo de PCW no avise;
  - el alias, el rol y la contraseña;
  - el nivel (también que dentro de un recálculo no avise), los ajustes y las medallas;
  - el veto (empieza, turno y reinicio) y el resultado;
  - el contador, la vista de la lista y marcar como leídas.
- **La inversa:** se aplicó y se volvió a aplicar la migración (ida y vuelta), sin errores.
- **Las pruebas SQL de las migraciones anteriores**, con y sin la `28`: fallan las mismas (`01`, `04`, `05`, `07`, `09`, `13`, `15`, `21`, `23` y `24`), por cambios de migraciones posteriores que ya estaban antes. La `28` no rompe ninguna. Las `11`, `16` y `22` fallaban por el nombre `admin_users()`, que se corrigió.
- **El cierre de BETA**, a mano en una transacción con rollback: `season_close_run` creó 18 `season_closed` (con puesto y medalla) y ninguna "temporada nueva", porque Novedades arranca apagada. BETA quedó intacta.

### Backend

- `pnpm test` (unitarias): 22 archivos y **307** pruebas en verde (eran 297). Las nuevas cubren la lista con el autor y los filtros, el contador con ETag y `304`, marcar por ids o todas, los `400` y las preferencias (el mapa completo, la unión de categorías y la validación).
- **Integración:** todas menos `seasons.test.ts` (borra todas las temporadas: se habría llevado BETA). 15 archivos y 111 pruebas en verde, incluida la nueva `notifications.test.ts`:
  - pedido para crear un equipo: aviso a los admins y la respuesta;
  - invitar y aceptar: accionable, contador con `304`, resolución y aviso al líder;
  - marcar como leídas: una, todas, y que no se toquen las de otra cuenta;
  - categoría apagada y la obligatoria que llega igual.
  - `me.test.ts` se actualizó porque las preferencias ahora traen `notifications`.
- `tsc --noEmit` en verde.

## Falta

- Conectar la campana del frontend (`web/frontend/src/features/shell/notifications/`, hoy con datos de ejemplo) y la pantalla de preferencias.
- La segunda etapa: las que necesitan una tarea programada (`docs/PENDIENTES.md`, sección 6).

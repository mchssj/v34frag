# Amigos con solicitudes: guía de implementación

## Estado

Implementado y probado en local el 2026-11-07, en la copia de `main` (`v34frag-mainwt`), con la `85` aplicada en la base local. Commit en `main` el 2026-11-08. Es del matchmaking: la base y la API van también en `feat/mm-claim-en-sala`; la web, en `feat/frontend-fase-1`.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/85_amigos_con_solicitudes.sql` | Tabla, funciones, notificaciones y datos de antes |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/85_amigos_con_solicitudes.sql` | Inversa |
| `web/backend/src/routes/mm.ts` | Aceptar, rechazar y el estado con un jugador |
| `web/backend/src/schemas/notifications.ts` | Categoría `friends` |
| `web/backend/test/unit/mm-friends.test.ts`, `me-routes.test.ts` | Pruebas |
| `web/frontend/src/features/matchmaking/` | `FriendsPanel.tsx` (nuevo diseño), `types.ts`, `source.ts`, `demo.ts`, `PlayFeed.tsx`, `PlayPage.test.tsx` |
| `web/frontend/src/features/player/components/FriendButton.tsx` (+ prueba) | El botón del perfil |
| `web/frontend/src/features/shell/notifications/` | `friend_request` y `friend_accepted`, Aceptar / Rechazar |
| `web/frontend/src/features/profile/components/NotificationPrefsCard.tsx` | La categoría Amigos |
| `docs/manual/jugador/amigos.md` (nueva), `notificaciones.md`, `buscar-partida.md` | Manual |
| `web/frontend/src/features/legal/pages/PrivacyPage.tsx`, `terms/privacidad.html` | Privacidad |

## Despliegue (hecho el 2026-11-08)

**Desplegado el 2026-11-08 (05:47-06:00 UTC)** desde `main` (`8991457b`; copia `8428d9e5` en `feat/frontend-fase-1`, y la base y la API de la `85` en `feat/mm-claim-en-sala`, `9a33cd81`): sin salas ni nadie en la cola (la única partida `live` sigue siendo la `0d42d09a…` colgada del #1); respaldo `20261108T054752Z` (también en R2); `cmleague-mm` parado; `probar_85.sh`, `probar_86.sh` y `probar_87.sh` contra producción, en verde y con la inversa igual a antes; las tres migraciones desde el archivo commiteado con `PGCLIENTENCODING=UTF8` y `notify pgrst, 'reload schema'`; la API `8991457b20f8` (`/api/health` con el commit), `cmleague-mm` prendido de nuevo y la web `8991457b20f8`. La web, con `--sin-pruebas`: en la corrida del script dos pruebas de `PlayPage` se cortaron a los 5 s (la máquina estaba cargada) y con `--maxWorkers=2` pasaron las 667 sobre el mismo commit. Quedaron 31 solicitudes pendientes (con el aviso leído) y 18 filas de amistad (9 pares): para entonces había 54 marcas.

Los pasos:

1. Respaldo (`sudo -n /usr/local/bin/cmleague-respaldar`) y `systemctl stop cmleague-mm`.
2. `probar_85.sh` contra producción (por el túnel) y después la `85` con `PGCLIENTENCODING=UTF8`.
3. `notify pgrst, 'reload schema'`, la API, `cmleague-mm` y la web.
4. Revisar cuántas solicitudes quedaron pendientes.

## Pruebas

- Base: `probar_85.sh docker` con 10 bloques (enviar, rechazar en silencio y los 7 días, cruzadas, eliminar, aceptar, bloquear, cancelar, a quién no, vencer a los 30 días, tope de 20) y la inversa igual a antes.
- API: `mm-friends.test.ts` (3) y la categoría en `me-routes.test.ts`.
- Web: `FriendButton.test.tsx` (3), `model.test.ts` (las dos notificaciones) y `PlayPage.test.tsx` (aceptar desde el panel).
- En la web local: el panel con una solicitud recibida y el botón "Agregar amigo" en el perfil de otro (`pruebas/amigos_panel.png`, `pruebas/perfil_otro.png`).

## En qué se apartó del plan

- Vencer a los 30 días no se hace con un proceso programado: cualquier acción de amigos vence las de todos, y las listas ya no muestran las de más de 30 días. Si alguien acepta una vencida, recibe "Esa solicitud ya no está pendiente".
- El demo del matchmaking no trae una solicitud recibida de entrada (molestaba en otras pruebas): la suma `controls.friendRequest()`.

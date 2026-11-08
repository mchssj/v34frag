# Amigos con solicitudes: guía de implementación

## Estado

Implementado y probado en local el 2026-11-07, en la copia de `main` (`v34frag-mainwt`), con la `85` aplicada en la base local. **Sin commit ni despliegue.** Es del matchmaking: la base y la API van también en `feat/mm-claim-en-sala`; la web, en `feat/frontend-fase-1`.

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

## Despliegue (pendiente)

1. Respaldo (`sudo -n /usr/local/bin/cmleague-respaldar`) y `systemctl stop cmleague-mm`.
2. `probar_85.sh` contra producción (por el túnel) y después la `85` con `PGCLIENTENCODING=UTF8`.
3. `notify pgrst, 'reload schema'`, la API, `cmleague-mm` y la web.
4. Revisar cuántas solicitudes quedaron pendientes (en producción había 35 marcas de un solo lado).

## Pruebas

- Base: `probar_85.sh docker` con 10 bloques (enviar, rechazar en silencio y los 7 días, cruzadas, eliminar, aceptar, bloquear, cancelar, a quién no, vencer a los 30 días, tope de 20) y la inversa igual a antes.
- API: `mm-friends.test.ts` (3) y la categoría en `me-routes.test.ts`.
- Web: `FriendButton.test.tsx` (3), `model.test.ts` (las dos notificaciones) y `PlayPage.test.tsx` (aceptar desde el panel).
- En la web local: el panel con una solicitud recibida y el botón "Agregar amigo" en el perfil de otro (`pruebas/amigos_panel.png`, `pruebas/perfil_otro.png`).

## En qué se apartó del plan

- Vencer a los 30 días no se hace con un proceso programado: cualquier acción de amigos vence las de todos, y las listas ya no muestran las de más de 30 días. Si alguien acepta una vencida, recibe "Esa solicitud ya no está pendiente".
- El demo del matchmaking no trae una solicitud recibida de entrada (molestaba en otras pruebas): la suma `controls.friendRequest()`.

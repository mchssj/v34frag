# El baneo saca al jugador del matchmaking: guía de implementación

## Estado

**Desplegado el 2026-11-10**: replanteo `107` en producción, sin salas activas ni nadie en la cola. Probado antes en la base local y en producción (29 de 29, en una transacción que se deshace).

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/107_mm_baneo_saca_de_cola.sql` | Nuevo: `mm_user_banned`, `mm_unit_banned`, `mm_ban_kick`, el trigger `bans_mm_kick` y la red en `mm_try_build` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/107_mm_baneo_saca_de_cola.sql` | Nuevo: la inversa |
| `supabase/replanteo/README.md` | Fila de la `107` |
| `web/frontend/src/features/legal/pages/TermsPage.tsx` y `terms/terminos.html` | Un punto nuevo en "Moderación y baneos" |
| `docs/manual/moderador/banear-jugador.md` y `docs/manual/jugador/baneos-y-sanciones.md` | Qué pasa con el baneado en el matchmaking |
| `docs/bitacora/2026-11-09-mm-baneo-saca-de-cola/` | Plan (traído de `feat/frontend-fase-1`, donde estaba sin commit), documentación, esta guía, changelog y pruebas |

## Despliegue (hecho el 2026-11-10)

1. Comprobar que no hay salas activas: `select count(*) from mm_lobbies where status not in ('finished', 'cancelled')` dio 0, y la cola estaba vacía.
2. Prueba completa en producción, dentro de una transacción que se deshace (aplica la `107`, prueba los casos y aplica la inversa):
   ```sh
   bash docs/bitacora/2026-11-09-mm-baneo-saca-de-cola/pruebas/prueba_107.sh \
     | ssh ubuntu@<VPS> 'sudo docker exec -i supabase-db psql -U postgres -X -q -At'
   ```
3. La `107` de verdad, con una guarda adelante que aborta si hay una sala activa, y `notify pgrst, 'reload schema'`. Por stdin a `sudo docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1`.
4. Verificado: existe el trigger `bans_mm_kick`, `mm_try_build` tiene `mm_unit_banned(` en los 3 lugares, `cmleague-mm` sigue activo y no hay errores en su log ni en el de Postgres.

No hay cambios en la API, la web (salvo el texto de los términos) ni los servidores de juego.

## Pruebas

### Base local y producción

`pruebas/prueba_107.sql`, armada con `prueba_107.sh`. Usa 14 cuentas reales con ficha, SteamID y correo confirmado, sin sala ni cola, y termina en `rollback`. **29 de 29** en la base local (igualada antes a producción con la `104` y la `106`) y **29 de 29** en producción:

| Caso | Resultado |
|---|---|
| Solo en la cola | Sale, queda `cancelled` en el historial, sin sanción de la cola |
| Grupo de 3 en la cola | Salen los tres; el grupo sigue armado; otro jugador de la cola no se toca |
| Sala aceptando (con el baneado en un grupo de 2) | Se cancela con "Un jugador fue baneado"; los otros 8 vuelven a la cola; el baneado y su compañero no; su fila queda como rechazo |
| Sala conectando | Se cancela; los otros 9 vuelven |
| Sala en vivo | Sigue en vivo; solo él queda `abandoned`, sin sanción de la cola |
| SteamID sin ficha y alguien sin matchmaking | Se banea sin error |
| Baneo guardado ya levantado | No saca a nadie |
| Baneo que reemplaza a otro | Lo saca |
| La red | `mm_unit_banned` ve al que se coló y no a otro; `mm_try_build` la tiene en los 3 lugares |
| `mm_ban_kick` roto a propósito | El baneo se guarda igual, con un `WARNING` |
| Inversa | `mm_try_build` queda igual que antes (mismo md5) y no queda `mm_ban_kick` |

Los avisos por el socket (`pg_notify`) no se probaron: dentro de una transacción que se deshace no salen. Son los mismos que ya usan `mm_cancel_lobby`, `mm_tick` y `mm_queue_drop_away`.

## En qué se apartó del plan

- **Número:** `107` en vez de `105`, que tomó "grupo máximo".
- **Ramas:** solo `main` (Daniel, 2026-11-10), no la copia a `feat/frontend-fase-1` ni a `feat/mm-claim-en-sala`.
- **La sala va antes que la cola:** `mm_cancel_lobby` devuelve a la cola al que había aceptado, también al baneado; por eso se saca de la cola después. El plan los nombraba al revés.
- **Sala en vivo:** solo se marca si ya estaba conectado. Un reemplazo que todavía no entró lo saca `mm_replace_sweep`; marcarlo habría contado un abandono de más para la derrota automática.
- **Aviso a los que salen de la cola:** `party.changed` a todos los que salieron, como `mm_queue_drop_away`, en vez de `queue.changed` (que ya lo manda el trigger de `mm_queue` a todos).
- **Página del admin:** no se tocó una página de admin; los admins ven la del moderador.

## Incidentes durante las pruebas

- El caso del baneo vencido no se puede armar: `bans_expira` no deja guardar un vencimiento pasado. Se reemplazó por un baneo guardado ya levantado.
- La base local no tenía la `104` ni la `106` (su `mm_try_build` era distinto del de producción). Se aplicaron antes de probar.

## Cómo revertir

Aplicar `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/107_mm_baneo_saca_de_cola.sql`, mejor sin salas activas (reemplaza `mm_try_build`). Los que salieron de la cola o de una sala por un baneo no vuelven.

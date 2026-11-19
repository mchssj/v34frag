# El admin bloquea jugadores sin límite: guía de implementación

## Estado

**Desplegado** el 2026-11-19 (UTC): base `128` y web `12e7e71036d3`.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/128_mm_bloqueo_admin_sin_limite.sql` | `mm_block` con los límites solo para quien no es admin; `mm_my_profile` sin tope para el admin (reemplazo de texto que falla si no encuentra el fragmento) |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/128_mm_bloqueo_admin_sin_limite.sql` | Inversa |
| `web/frontend/src/features/matchmaking/BlockPanel.tsx` | `max` null: sin tope y solo la cantidad |
| `web/frontend/src/features/matchmaking/types.ts` | `max: number \| null`, `changes` puede ser null |
| `docs/manual/admin/matchmaking.md` | El admin no tiene límites |
| `web/frontend/src/features/legal/pages/TermsPage.tsx`, `terms/terminos.html` | Idem |
| `docs/bitacora/2026-11-18-bloqueo-admin-sin-limite/pruebas/probar_128.sh` y `.sql` | Prueba en la base local, con rollback |

## Despliegue (hecho el 2026-11-19, UTC)

1. Base: túnel `ssh -N -L 5433:127.0.0.1:5432 ubuntu@<VPS>` con el `ssh` de Windows. Prueba con `rollback` en producción (la `128` sin `commit`, la inversa y la comparación de `md5`: todo bien). Después, `tr -d '' < supabase/replanteo/128_mm_bloqueo_admin_sin_limite.sql | psql -v ON_ERROR_STOP=1`, a las 03:46 UTC. No bloquea tablas ni necesita esperar a que terminen los mix.
2. Web: `deploy/vps/desplegar.sh web`, versión `12e7e71036d3` (commit `12e7e710`), con las pruebas (831). Los cambios sin commit de otros pedidos (páginas legales) se guardaron en un stash durante el build y se devolvieron. Vuelta atrás: desplegar `7615857e` (la web anterior era `fbb852abb6fe`).

## Pruebas

- `pnpm typecheck` del frontend: pasa.
- Base local, 2026-11-18, con `pruebas/probar_128.sh` (aplica la `128` y la inversa dentro de una transacción con rollback):
  1. Un admin sin VIP, con `blocks_vip_only` encendido, `max_blocks` 1 y 5 por semana, bloquea a 8 jugadores. Su perfil llega con `max` null, `vip_only` false, `allowed` true y `changes` null. Con `max_blocks` 0 también bloquea. No se puede bloquear a sí mismo.
  2. Un jugador sin VIP sigue rechazado ("exclusivo para VIP") y su perfil no cambia.
  3. Sin VIP obligatorio, el jugador sigue con el máximo de bloqueos y con los 5 por semana.
  4. La inversa deja `mm_block` y `mm_my_profile` exactamente como estaban (mismo `md5`).
- Lo que no se probó: la web en el navegador con una cuenta admin.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

Aplicar la inversa (`reversas/128_…`) y revertir el commit de la web. Los bloqueos de más que tenga un admin se quedan; solo no puede sumar nuevos.

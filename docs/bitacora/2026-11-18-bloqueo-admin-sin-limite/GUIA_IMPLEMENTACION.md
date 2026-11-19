# El admin bloquea jugadores sin límite: guía de implementación

## Estado

Implementado y probado en la base local el 2026-11-18. **Sin desplegar**.

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

## Despliegue

1. Aplicar la `128` en la base de producción (túnel `PG_*`). No bloquea tablas: solo reemplaza dos funciones.
2. Desplegar la web. La web vieja con la base nueva muestra `x/` para el admin pero no se rompe; la web nueva con la base vieja funciona igual que antes.

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

# El resumen del matchmaking al día por el socket: guía de implementación

## Estado

**Implementado y probado el 2026-11-03, sin commit y sin desplegar.** La API y el plugin no cambian.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/66_mm_resumen_en_vivo.sql` | Nuevo |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/66_mm_resumen_en_vivo.sql` | Nuevo: la inversa |
| `supabase/replanteo/README.md` | Fila de la `66` |
| `web/frontend/src/features/matchmaking/queries.ts` | `patchQueueSizes` con el resumen y `refetchInterval` sin socket |
| `web/frontend/src/features/matchmaking/PlayBar.tsx` | Abrir la lista pide el estado |
| `web/frontend/src/features/matchmaking/queries.test.tsx` | 3 pruebas |

## Pruebas (2026-11-03)

- **Base:** Docker Desktop no estaba corriendo, así que no había base local. Las mismas pruebas se corrieron contra **staging, dentro de una transacción que se deshace** (`rollback`), con el `psql` 18 de la máquina. Antes se comprobó que no hubiera nadie en la cola ni salas abiertas. Resultado: 14 comprobaciones y la inversa:
  - `queue.changed` trae el resumen completo (tamaño, activos, servidores, niveles y en vivo);
  - una sala en vivo cuenta en activos y en vivo, y ocupa el servidor;
  - el tick avisa una vez cuando algo cambió y no vuelve a avisar si nada cambió;
  - al terminar la sala, el tick avisa con el servidor libre y los activos de nuevo;
  - `mm_my_live` y el resumen no cuentan como libre un servidor no disponible;
  - el resumen y su tabla no son de los jugadores.
  
  Después se verificó que staging quedó igual (sin `mm_summary`). La prueba toma la cola y los servidores durante uno o dos segundos.
- **Web:** 549 pruebas, typecheck y lint.
- **API:** sin cambios.

## En qué se apartó del plan

- **El replanteo es el `66`:** el `65` lo usa `65_manual_valores.sql`, de otro trabajo, sin commit en `v34frag-mmclaim`. Se corrigió en el plan antes de empezar.
- **Las pruebas SQL se corrieron en staging** (deshechas) y no en local, porque Docker Desktop estaba apagado. `pruebas/correr_local.sh` sirve igual para la base local.

## Despliegue en staging (pendiente)

1. **Base:** `66` con `psql -v ON_ERROR_STOP=1`. Verificar que existan `mm_summary` y `mm_summary_last`, y que `mm_trg_notify`, `mm_tick` y `mm_my_live` lo usen.
2. **Web:** desde un checkout limpio de `feat/frontend-fase-1`. La API no cambia.
3. **Ramas:** la base en `feat/frontend-fase-1` y en `feat/mm-claim-en-sala`; la web solo en la primera.
4. **Probar:** con Jugar abierto sin buscar, que "jugadores activos" cambie cuando otra cuenta entra a la cola.

## Cómo revertir

1. **Base:** la inversa `66`.
2. **Web:** revertir el commit. La web vieja con la base nueva funciona: lee `size` y `by_mode` y no usa lo demás.

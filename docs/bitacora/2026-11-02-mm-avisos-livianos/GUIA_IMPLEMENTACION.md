# Matchmaking con avisos que traen el dato y un estado liviano: guía de implementación

## Estado

**Implementado y probado en local el 2026-11-02, sin commit y sin desplegar.** El plugin no cambia: no hay nada que subir a los servidores #1, #2 (flow) ni #3.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/59_mm_avisos_livianos.sql` | Nuevo: `mm_emit(…, p_data)`, `mm_queue_sizes()`, los `d` de `queue.changed`, `lobby.accept`, `lobby.found` y `lobby.veto`, `mm_my_profile()`, `mm_my_live(p_full)`, `mm_my_state()` como unión de las dos, `mm_lobby_match(id)` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/59_mm_avisos_livianos.sql` | Nueva |
| `supabase/replanteo/README.md` | Fila de la `59` |
| `web/backend/src/mm/socket.ts` | `dispatch` reenvía `d` |
| `web/backend/src/routes/mm.ts` | `GET /api/v1/mm/state/live`, `GET /api/v1/mm/profile`, `GET /api/v1/mm/lobbies/{id}/match` |
| `web/backend/test/unit/mm-live-state.test.ts` | Nuevo: 4 pruebas |
| `web/frontend/src/features/matchmaking/queries.ts` | `applyMmEvent` (qué pide cada aviso), `patchQueueSizes`, `seedFoundLobby`, estado = liviano + perfil, consulta de la partida terminada, refresco de 30 s / 2 min |
| `web/frontend/src/features/matchmaking/{source,demo,types}.ts` | `stateLive`, `profile`, `lobbyMatch` y `MmEvent.d` |
| `web/frontend/src/features/matchmaking/{PlayPage,ReconnectBanner}.tsx` | `mmStateOptions` con el `QueryClient` |
| `web/frontend/src/features/matchmaking/queries.test.tsx` | 6 pruebas nuevas y una ajustada (`mmKeys.state`) |

Base y API en `E:\Css V34 Web\v34frag-mmclaim` (rama `feat/mm-claim-en-sala`); web en `feat/frontend-fase-1`.

## Pruebas (2026-11-02)

- **Base:** `bash pruebas/correr_local.sh "E:/Css V34 Web/v34frag-mmclaim"` → 11 comprobaciones (cada aviso con su `d` y sin secretos, `mm_my_live() || mm_my_profile()` igual a `mm_my_state()`, la sala sin estadísticas, `mm_lobby_match` solo para la sala) y la inversa, en una transacción que se deshace.
- **API:** 440 pruebas (4 nuevas) y typecheck.
- **Web:** 524 pruebas, typecheck y lint.

## Despliegue en staging (falta)

1. **Base:** aplicar la `59` en staging (va después de la `58`).
2. **API:** rama temporal con `feat/mm-claim-en-sala` y `feat/backend-api-fase-1` en una carpeta aparte, `deploy/vps/desplegar.sh api`. Verificar `GET /api/v1/mm/state/live` sin sesión → 401.
3. **Web:** desde una carpeta limpia de `feat/frontend-fase-1` (en la carpeta de trabajo está el manual de usuario de otra sesión, sin commit), `deploy/vps/desplegar.sh web`.
4. **Orden:** base → API → web. La web vieja y la web nueva anterior siguen andando con `GET /api/v1/mm/state` y sin mirar `d`.
5. **Medir de nuevo** (punto 5 del plan): sonda del socket y pedidos por hora a `/api/v1/mm/state*` en los logs de `cmleague-api`, y comparar con la tabla del plan.

## Producción

Con el corte, junto con el resto del matchmaking.

## Falta

- Commit, staging y la medición de después.
- Si la medición lo pide: aplicar el `d` de `lobby.accept` y `lobby.veto` sin pedir el estado liviano.

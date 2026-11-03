# Matchmaking con avisos que traen el dato y un estado liviano: guía de implementación

## Estado

**En staging desde el 2026-11-02, con commit** (base, API y web). Commits: `c20414f0` en `feat/mm-claim-en-sala` (base y API) y `f11f1952` en `feat/frontend-fase-1` (web). El plugin no cambia: no hay nada que subir a los servidores #1, #2 (flow) ni #3.

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

## Despliegue en staging (hecho el 2026-11-02)

Sin salas abiertas ni nadie en la cola.

1. **Base:** `59` aplicada en staging sin errores. Verificado: las funciones nuevas existen, `mm_emit` de 3 argumentos ya no está, `mm_my_live` es de `authenticated` y no de `anon`, `mm_emit` y `mm_queue_sizes` no son de `authenticated`, el trigger usa `mm_queue_sizes()`, y con un usuario de prueba `mm_my_profile() || mm_my_live(true)` es igual a `mm_my_state()`.
2. **API `4225068507f9`:** rama temporal con `feat/mm-claim-en-sala` y `origin/feat/backend-api-fase-1`, armada en una carpeta aparte y borrada después. 429 pruebas. Las tres rutas nuevas responden 401 sin sesión.
3. **Web `f11f1952fd60`:** desde una carpeta limpia de `feat/frontend-fase-1` (en la de trabajo está el manual de usuario de otra sesión). 509 pruebas.

### Primera medición (2026-11-02, desde la PC de Daniel, 10 pedidos por ruta, cuenta de prueba sin cola ni sala)

| Ruta | Tamaño | Mediana | Máximo |
|---|---|---|---|
| `GET /api/v1/mm/state` (completo, el de antes) | 6,7 kB | 420 ms | 635 ms |
| `GET /api/v1/mm/state/live` | 4,7 kB | 208 ms | 403 ms |
| `GET /api/v1/mm/profile` | 1,4 kB | 254 ms | 301 ms |

Sin carga no se ven los picos de la medición del plan (p90 de 13,9 s). La comparación que importa es la de los logs de la API con gente en Jugar: pedidos por hora a `/api/v1/mm/state*` y sus percentiles. Queda para la próxima sesión de matchmaking con jugadores.

## Producción

Con el corte, junto con el resto del matchmaking.

## Falta

- La medición con jugadores (logs de la API) y compararla con la tabla del plan.
- Si la medición lo pide: aplicar el `d` de `lobby.accept` y `lobby.veto` sin pedir el estado liviano.

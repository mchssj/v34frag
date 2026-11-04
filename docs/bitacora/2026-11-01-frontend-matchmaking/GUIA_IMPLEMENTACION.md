# Frontend del matchmaking en `feat/frontend-fase-1`: guía de implementación

## Estado

Implementado y probado en local (2026-11-01). **Web desplegada en staging** (`cmleague.lat`, versión `e0aa0ccc791d-local11020314`), sin commit. Sin plugin en ningún servidor, por decisión de Daniel.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/features/matchmaking/**` | Nuevo: copiado de `origin/kyan/pruebas` (`4079c8a2`) con el diseño, el tuteo y sin los cosméticos de la tienda |
| `web/frontend/src/routes/_app/play.tsx` | Nuevo, igual que en `kyan/pruebas` |
| `web/frontend/src/routes/_app/admin.matchmaking.tsx` | Nuevo, igual que en `kyan/pruebas` |
| `web/frontend/src/routes/demo.matchmaking.tsx` | Nuevo, igual que en `kyan/pruebas` (solo en desarrollo) |
| `web/frontend/src/routes/_app.tsx` | `ReconnectBanner` arriba de cada página con sesión, y `gap-4` en la columna |
| `web/frontend/src/auth/permissions.ts` | Sección `matchmaking` |
| `web/frontend/src/features/shell/lib/nav.ts` | "Jugar" (`/play`) y Administración › "Matchmaking" |
| `web/frontend/src/features/mixes/components/MixRoom.tsx` | `SideTable` exportada para las estadísticas de la sala |
| `web/frontend/src/routeTree.gen.ts` | Regenerado por el plugin del router |

### Cambios sobre lo de Kyan

| Archivo | Cambio |
|---|---|
| `PlayPage.tsx` | Encabezado "Jugar" fuera de la tarjeta. Una sola `Card variant="outline"` sin la foto de la landing ni el degradé |
| `PlayBar.tsx` | Sin borde ni fondo propios: es la columna derecha de la tarjeta |
| `FriendsPanel.tsx`, `BlockPanel.tsx`, `PlayFeed.tsx` | `Card variant="outline"`, encabezado `py-3.5` y sin íconos en el título |
| `admin/AdminMatchmaking.tsx` | `AdminHeader` con subtítulo y `AdminTabs` en lugar de las pestañas propias |
| `admin/*.tsx` | `Card variant="outline"` y títulos de 15 px, como el resto de Administración |
| `GroupSlots.tsx`, `room/RoomOverview.tsx` | Sin `CardBackground`, `FramedAvatar` ni `NameFx`: avatar y nick normales |
| `BlockPanel.tsx`, `SoundSettings.tsx`, `GroupSlots.tsx`, `room/RoomOverview.tsx` | `Badge variant="vip"` en lugar de la medalla de la tienda |
| `types.ts` | `MmCosmetics` pasa a `MmVip`: solo queda `vip` |
| `demo.ts` | Sin fondos, marcos ni efectos de nombre. Siguen siendo VIP "tu.nick", "maxi" y "kz.flick" |
| Textos (componentes, `labels.ts`, `alert.ts`, `demo.ts`) | Del voseo al tuteo: "Arma tu partida", "Puedes volver en…", "Tienes 20 segundos…", "Vuelve antes de…", "(tú)", etc. |
| `PlayPage.test.tsx` | Los textos que busca, en tuteo |

## Despliegue (hecho el 2026-11-01)

1. Verificado antes: la versión que estaba en staging (`1a3d9e92`) está incluida en `feat/frontend-fase-1`, así que no se pierde nada. Las 171 rutas de `schema.d.ts` existen en la API de staging (`4079c8a22757`, la de `kyan/pruebas`).
2. Desde la raíz del repo, con los cambios sin commit:

   ```bash
   deploy/vps/desplegar.sh web
   ```

   Corrió las pruebas y el build con `VITE_API_URL=https://api.cmleague.lat` y subió `e0aa0ccc791d-local11020314`. Los avisos de `tar` sobre fechas "en el futuro" son por 3 s de diferencia entre los relojes y no afectan.
3. Comprobado en el VPS: `web/current` apunta a esa versión, el bundle tiene la pantalla de Jugar y la URL de la API, y no tiene nada de `cosmetics/`.

Estado del resto en staging, revisado el mismo día:

| Pieza | Estado |
|---|---|
| API (`api.cmleague.lat`) | `4079c8a22757`, con las 32 rutas `/mm`. `/mm/state` responde 401 sin sesión |
| WebSocket `/api/v1/mm/ws` | Responde 101 al handshake |
| `cmleague-api` y `cmleague-mm` | Activos, con `MM_LISTEN_URL` configurado |
| `mm_config` | `open = false`, `require_anticheat = true`, `min_mixes = 5`, `min_account_days = 7`. Solo el 5v5 habilitado |
| Servidores | `aurav34` con `mm_enabled = true`, pero nunca le reportó a staging (`last_seen_at` vacío): su plugin apunta a la Supabase de producción |
| Falta en la API | `6c56bd84` (stats por mapa de la serie), que este frontend ya usa |

Para jugar de verdad faltan abrir la cola y un servidor que consulte la base de staging. Daniel decidió no tocar el plugin de ningún servidor por ahora.

## Pruebas

### Chequeos (`web/frontend`)

- `pnpm exec tsc -b`: sin errores.
- `pnpm lint`: sin errores.
- `pnpm exec vitest run`: 72 archivos, 464 pruebas en verde (incluye `PlayPage.test.tsx`, `labels.test.ts` y `AdminMatchmaking.test.tsx`).
- `pnpm build`: bien. El bundle no tiene referencias a `cosmetics/`.

### En el navegador

Capturas con Playwright de `/demo/matchmaking` sobre `pnpm dev`:

- 1440 px en oscuro y claro, y 390 px en oscuro y claro.
- El flujo Buscar partida → Aceptar → sala, y Administración › General.

Antes, en el [artifact](https://claude.ai/artifact/96VZS9JBGUvbcpBKM752vj), se compararon la versión de Kyan y esta propuesta dentro del marco de la web (barra lateral y encabezado).

No se probó contra la API real del matchmaking.

## En qué se apartó del plan

- Las tarjetas del grupo y de la sala siguen con el `Avatar` de shadcn que ya usaba Kyan, no con `PlayerAvatar`. Era la rama "sin marco" del código original y cambiarla no hacía falta para sacar los cosméticos.
- Se pasaron al tuteo también dos errores de la simulación (`demo.ts`) y los nombres de dos pruebas.

## Incidentes durante las pruebas

### Administración › Matchmaking daba 500 en staging (2026-11-01)

Guardar General y cargar Servidores, Salas, Mapas, Reportes, Baneos y Métricas respondían 500 ("Algo salió mal"). No era del frontend: eran tres errores de la migración `48` del matchmaking.

- `mm_set_config` hacía `UPDATE` sin `WHERE`, y `pg_safeupdate` (cargado por Supabase para PostgREST) lo rechazaba.
- `mm_set_config` vaciaba la escalera de sanciones si el cuerpo no la traía.
- `mm_admin_lists` tenía un error de agrupación en Métricas que rompía todas las listas.

Corrección en [`pruebas/fix_mm_admin_staging.sql`](pruebas/fix_mm_admin_staging.sql), probada como admin con `ROLLBACK` y **aplicada en staging el 2026-11-01** (Daniel). En `kyan/pruebas`, commit `a6ca687c` sobre `supabase/replanteo/48_matchmaking.sql`, con el detalle en la guía de [`2026-10-28-matchmaking`](../2026-10-28-matchmaking/GUIA_IMPLEMENTACION.md).

## Cómo revertir

1. Borrar `web/frontend/src/features/matchmaking/` y las tres rutas nuevas.
2. En el VPS, volver `web/current` a `1a3d9e92badb` (sigue en `/srv/cmleague/web/releases/`), o desplegar la versión anterior con `desplegar.sh web`.
3. Deshacer los cambios de `_app.tsx`, `permissions.ts`, `nav.ts` y `MixRoom.tsx` (`git checkout -- <archivo>` mientras no haya commit; si lo hay, `git revert`).
4. Dejar que el plugin del router regenere `routeTree.gen.ts` (`pnpm dev` o `pnpm build`).

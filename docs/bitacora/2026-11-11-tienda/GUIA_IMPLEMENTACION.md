# Tienda, inventario y economía: guía de implementación

## Estado

Implementado y probado en local el 2026-11-11, en `kyan/pruebas`. Sin commit.

| Parte | Prueba | Resultado |
|---|---|---|
| Web (`/demo/tienda`) | `tsc`, `eslint` y las pruebas del frontend; en el navegador: comprar, el tope, el pack, el inventario, las pestañas y en celular (375 px), sin desbordes | 742 pruebas pasan |
| Base (replanteo 110) | `pruebas/prueba_110.sql`, sobre una base aparte con el replanteo 01–91 | 19 comprobaciones pasan |
| API | `pnpm typecheck` y `pnpm test` (unitarias); `test/integration/shop.test.ts` contra la base con el 110 | 569 unitarias y 5 de integración pasan |

**Falta:**

1. **Daniel:**
   - confirmar el número del replanteo (110 era el primero libre el 2026-11-11);
   - aplicarlo en la base del VPS con `starts_at` = el día que salga;
   - `notify pgrst` y regenerar `src/db/types.ts`, para sacar los `as never` de `routes/shop.ts`;
   - desplegar la API.
2. **La ruta real** `/tienda` en la web, sobre la API: hoy solo existe el demo. Después, sacar `oculta: true` de las dos páginas del manual y la marca "En preparación" de los términos.
3. **Cosméticos en el matchmaking:** que el estado del lobby y de la sala (`MmMe`, `MmPartyMember`, `MmPlayer`) traiga `background_url`, `frame_url`, `name_class` y `vip` desde `player_cosmetics_public`. Es del matchmaking, así que va en `feat/frontend-fase-1` y `feat/mm-claim-en-sala`, según `CLAUDE.md`.
4. **Premios sin enganche:** los sistemas que todavía no existen o no avisan tienen que llamar a `economy_award` cuando estén:
   - misiones y Primeros pasos;
   - nivel nuevo;
   - campeón y subcampeón de torneo;
   - clip destacado por un admin;
   - referidos.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/110_economia_tienda.sql` | Todo lo de la base |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/110_economia_tienda.sql` | La inversa |
| `docs/bitacora/2026-11-11-tienda/pruebas/generar_catalogo_110.py` | Escribe la carga de los 333 artículos desde `catalogo.json` |
| `docs/bitacora/2026-11-11-tienda/pruebas/prueba_110.sql` | Pruebas de la base, en una transacción que se deshace |
| `web/backend/src/schemas/shop.ts`, `src/routes/shop.ts`, `src/app.ts` | Rutas de la API |
| `web/backend/test/integration/shop.test.ts` | Pruebas de las rutas |
| `web/frontend/src/features/shop/*` | La tienda: `economy.ts`, `demo.ts`, `parts.tsx`, `ItemCard.tsx`, `ItemSheet.tsx`, `StoreTab.tsx`, `InventoryTab.tsx`, `EarnTab.tsx`, `ShopPage.tsx`, `AdminShop.tsx` y `types.ts` |
| `web/frontend/src/routes/demo.tienda.tsx` | La barra del demo |
| `web/frontend/src/features/legal/pages/TermsPage.tsx`, `terms/terminos.html` | El punto de las monedas VIP |
| `docs/manual/jugador/tienda-y-puntos.md`, `docs/manual/admin/tienda.md` | El manual, oculto |

## Cambios respecto del plan de la economía

- **Zona horaria:** el día se corta en hora de **Bogotá**, no de Argentina, como los demás topes de la web.
- **`vip_at`:** las monedas VIP usan esta función, que ya existía, en vez de una nueva `was_vip`. Lo pidió Kyan: reutilizar.
- **Admin:** no da ni quita VIP; eso sigue en Administración › Usuarios.
- **Reversión:** al borrar una partida, sus premios vuelven con filas `reversal`.

## Cómo probarlo en local

1. **Base:**
   - la base `postgres` de la Supabase local tiene la copia de producción del 2026-10-21 y no se tocó;
   - las pruebas usan una base aparte, `tienda_prueba`, armada con el mismo orden que `db-local.sh`: esquema, migraciones pendientes y replanteo, con los `.sql` pasados a LF;
   - se saltea `20261029120000_widget_streamers.sql`, que usa `teams.members` y frena el replanteo 05. Es un pendiente aparte, no de la tienda.
2. **Base, pruebas:** con el 110 aplicado, correr `prueba_110.sql` con `psql -v ON_ERROR_STOP=1`. Termina con "OK: todas las pruebas del 110 pasaron".
3. **API:** las de integración necesitan el 110 en la base que usa la Supabase local. Hay dos caminos:
   - `pnpm db:reset`, que borra la base local;
   - o intercambiar el nombre de las bases con los servicios pausados y reiniciar PostgREST, que es lo que se hizo para no perder la copia local.
4. **Web:** `pnpm dev` y entrar a `/demo/tienda`.

No toca el plugin, así que no hay nada que subir a los servidores (#1, #2 ni #3).

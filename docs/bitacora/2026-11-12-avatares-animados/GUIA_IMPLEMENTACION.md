# Avatares animados en la tienda: guía de implementación

> **Reemplazado (Daniel, 2026-11-13):** los 16 avatares son arte de terceros sin permiso y no se publican. En su lugar, cada jugador sube el suyo: [`2026-11-13-avatar-y-fondo-propios`](../2026-11-13-avatar-y-fondo-propios/). Lo de abajo describe lo que se hizo y queda como historia.

## Estado

Hecho y probado en local el 2026-11-12, sin commit. Sale con la tienda (`113`) y la `114`.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/public/cosmetics/avatars/` | 16 `.webm` y 16 `.webp` (los GIF que dejó Daniel, renombrados y convertidos) |
| `web/frontend/public/cosmetics/catalogo.json` | Versión 9: tipo `avatar`, colección `avatares` y los 16 artículos |
| `pruebas/convertir_avatares.sh` | Nuevo: GIF → WebM y WebP |
| `supabase/replanteo/113_tienda.sql` | `avatar` en el tipo, en `user_cosmetics`, en equipar, quitar y la vista pública, y los 16 artículos (349 en total) |
| `docs/bitacora/2026-11-11-tienda-de-puntos/pruebas/probar_113.sql` | Bloque `6b` y el avatar en el `7` |
| `web/backend/src/schemas/shop.ts`, `services/shop.ts`, `routes/shop.ts`, `routes/players.ts` | El avatar en la API |
| `web/backend/src/lib/uploads.ts` y `test/unit/uploads.test.ts` | `isAnimated` y sus pruebas |
| `web/backend/src/db/types.ts`, `web/frontend/src/api/schema.d.ts` | Regenerados |
| `web/frontend/src/features/shop/` (`types.ts`, `cosmetics.tsx`, `ShopPage.tsx`, `shop.test.tsx`) | `posterUrl`, `AvatarMedia`, `AvatarThumb`, la pestaña y las pruebas |
| `web/frontend/src/features/player/pages/PlayerProfile.tsx` | El avatar en la ficha |
| `web/frontend/src/features/ranking/pages/PlayersRanking.tsx`, `matchmaking/room/RoomOverview.tsx` | Sin marco; el avatar quieto |
| `web/frontend/src/features/matchmaking/GroupSlots.tsx` | Las tarjetas del grupo en Jugar: fondo de miniperfil, avatar animado, marco y efecto de nombre (la propia busca el id de la ficha con `useMine`, porque `state.me` no lo trae) |
| `docs/manual/jugador/tienda-y-cosmeticos.md`, `TermsPage.tsx`, `terms/terminos.html`, `docs/frontend/contrato/tienda.md`, el changelog de la tienda | Los avatares |

## Despliegue

Con la tienda: ver su [guía](../2026-11-11-tienda-de-puntos/GUIA_IMPLEMENTACION.md). La `113` ya trae los avatares. Los archivos van con la web.

## Pruebas

- **Conversión:** los 16 WebM duran lo mismo que sus GIF. Se revisó la imagen fija de cada uno (el perrito pasó a usar el primer cuadro).
- **Base:** `probar_113.sh`, los 13 bloques en verde, con el `6b` (el avatar va en su lugar, junto al marco, y no como marco) y el `7` (se oculta al vencer el VIP y vuelve al renovar).
- **Detección de animación:** probada con archivos reales hechos con `ffmpeg` (WebP animado y APNG: animados; PNG y WebP fijos: fijos) y con 3 pruebas unitarias nuevas.
- **API:** 616 pruebas unitarias e integración de la tienda (8) en verde; typecheck sin errores.
- **Web:** 745 pruebas (3 nuevas de avatares), typecheck y lint en verde.
- **En el navegador** (2026-11-12, `pruebavip`): la tarjeta propia en Jugar muestra el avatar «Nieve» con el marco holográfico, y el video se reproduce en bucle (el 2026-11-13: avanza 1,5 s en 1,5 s).

## En qué se apartó del plan

- **Tarjetas del grupo en Jugar:** no estaban en el plan. Daniel no veía los cosméticos en Jugar porque, sin partida armada, lo que se ve son esas tarjetas (antes solo los tenía la sala de la partida).
- La detección de animación también vale para la imagen del MVP del matchmaking, que pasa por la misma función.

## Cómo revertir

Con la tienda (su inversa). Para sacar solo los avatares antes de que salga: volver estos archivos y regenerar la carga de la `113`.

## Pendiente

**Derechos de las imágenes:** las imágenes no traen autor ni licencia (ni en sus datos internos ni en la marca de descarga de Windows, que se perdió al moverlas de disco). Daniel contó de dónde salieron (2026-11-13):
- **Nieve:** una ilustración que encontró en Pinterest, animada por él. La ilustración sigue siendo de su autor original, que no se conoce.
- **Casi todas las demás:** fondos de Wallpaper Engine (el Workshop de Steam). Esos fondos son para usarlos dentro del programa; para publicarlos en otro lado hace falta el permiso de su autor, y muchos ya usan arte de otros.

Falta decidir si se piden permisos, se cambian por avatares propios o se publican igual.

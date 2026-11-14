# Avatar animado y fondo de miniperfil propios: guía de implementación

## Estado

**Desplegado el 2026-11-14** (23:44 a 23:51 UTC): la `118` y la `119` en producción, y la API y la web `e0b08e9f9e82`. Ver el despliegue en la [guía de la tienda](../2026-11-11-tienda-de-puntos/GUIA_IMPLEMENTACION.md).

Antes: Hecho y probado en local el 2026-11-14, sin commit (rama `feat/tienda-de-puntos`, worktree `v34frag-mainwt`). Sale con la tienda: falta el commit, `ffmpeg` en el VPS y el despliegue de la `113`.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/113_tienda.sql` | Precios de lo propio en `points_config`; `custom_cosmetics`; `avatar_custom` y `background_custom` en `user_cosmetics`; lo pagado en `points_totals` y `points_history`; `custom_cosmetic_json`; `custom` en `set_my_cosmetics` y en `player_cosmetics_public`; los precios en `set_points_config`; aviso `custom_removed`; sección 8 nueva (bucket `cosmetics`, subir, borrar, sacar y denunciar); la carga del catálogo pasa a ser la sección 9, con 369 artículos (sin los 16 avatares) |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/113_tienda.sql` | Borra lo nuevo y las políticas del bucket (el bucket y sus archivos quedan) |
| `docs/bitacora/2026-11-11-tienda-de-puntos/pruebas/probar_113.sql` | Bloque 13; los bloques 6b, 7 y 13 usan `avatar-relampago` (de Kyan) en vez de `avatar-perrito-pixel` |
| `web/backend/src/routes/custom.ts` | Rutas nuevas (lo propio, denuncias, moderación y admin) |
| `web/backend/src/lib/media.ts`, `lib/media-node.ts` | Tipos de archivo, recorte, filtros y la conversión con ffmpeg |
| `web/backend/src/app.ts`, `lib/types.ts`, `node.ts`, `tsconfig.json` | La opción `media` (solo Node, con `FFMPEG_PATH`) |
| `web/backend/src/routes/shop.ts`, `schemas/shop.ts` | Los precios en la configuración; `custom` en lo equipado y en el historial; `url` y `poster_url` en `Cosmetic`; los esquemas nuevos |
| `web/backend/src/db/types.ts` | Regenerado de la base local (`pnpm run db:types`) |
| `web/backend/test/integration/custom.test.ts`, `test/unit/media.test.ts` | Pruebas nuevas |
| `web/frontend/src/features/shop/CustomPanel.tsx` (y su prueba) | El recuadro de la Tienda |
| `web/frontend/src/features/shop/{api,types,cosmetics,ItemPreview,ShopPage,AdminShopPage}.ts(x)` | Lo propio al dibujar (`url`), el fondo animado en video, el panel en Avatares y Fondos, los precios y Gestionar |
| `web/frontend/src/features/player/components/MediaReportDialog.tsx`, `pages/PlayerProfile.tsx` | Denunciar imagen |
| `web/frontend/src/features/admin/bans/components/MediaReportsPanel.tsx`, `pages/AdminBansPage.tsx`, `lib/search.ts` | La pestaña Imágenes |
| `web/frontend/src/features/profile/components/AvatarCropDialog.tsx` | Encuadra también videos; descripción configurable |
| `web/frontend/src/features/matchmaking/GroupSlots.tsx` | El fondo animado en la tarjeta del grupo |
| `web/frontend/src/features/shell/notifications/lib/model.ts` (y su prueba) | El aviso `custom_removed` |
| `web/frontend/src/features/legal/...`, `terms/terminos.html`, `terms/privacidad.html` | Términos y privacidad |
| `web/frontend/public/cosmetics/catalogo.json` | Versión 13: sin los 16 avatares ni la colección `avatares` |
| `web/frontend/public/cosmetics/avatars/`, `docs/bitacora/2026-11-12-avatares-animados/pruebas/convertir_avatares.sh` | Sacados del repo a `~/.v34frag/avatares-retirados/` |
| `docs/manual/jugador/tienda-y-cosmeticos.md`, `moderador/revisar-imagenes.md` (nueva), `admin/tienda-y-puntos.md` | Manual |
| `docs/bitacora/2026-11-11-tienda-de-puntos/CHANGELOG_DISCORD.txt` | La 2.9.42 nombra lo propio en lugar de los avatares animados |

## Despliegue (pendiente)

Va con el de la tienda ([guía](../2026-11-11-tienda-de-puntos/GUIA_IMPLEMENTACION.md)), con dos pasos más:

1. **Antes:** ffmpeg en el VPS. **Hecho el 2026-11-14**, pedido por Daniel: `sudo apt-get install -y --no-upgrade --no-install-recommends ffmpeg` (con `NEEDRESTART_SUSPEND=1`, para que no reinicie servicios), 150 paquetes nuevos y ninguno actualizado. `ffmpeg -version` con el usuario `cmleague` (el de `cmleague-api`): 8.0.1. La API actual no lo usa todavía: la que trae la tienda lo encuentra al arrancar.
2. **Antes de generar la `113` para producción:** pasar a `catalogo.json` lo que Daniel activó, renombró, redescribió o cambió de grupo en su local, y regenerar con `generar_catalogo.py` (la `113` carga el catálogo desde ahí).
3. La `114`, la `113` (crea el bucket `cosmetics` y sus políticas), `notify pgrst`, la API y la web, como dice la guía de la tienda.
4. Probar en producción con una cuenta VIP (avatar animado) y una sin VIP (fondo fijo), y una denuncia resuelta desde Baneos › Imágenes.

## Pruebas

### Base (`probar_113.sh`, en una transacción que se deshace)

Sobre la base local (copia de producción) con la `113` revertida dentro de la misma transacción. Los 14 bloques en verde, incluido el 13:
- **13a:** el VIP sube el avatar dos veces (cobra las dos) y un fondo fijo; el precio equivocado no cobra; se lo saca y se lo pone sin pagar; un avatar de la tienda en su lugar.
- **13b:** sin VIP solo el fondo fijo; denuncia una vez, no la propia ni una imagen que no está; sin permisos de moderación.
- **13c y 13d:** el admin ve la denuncia, saca el avatar (con aviso), saca el fondo desde Gestionar y cambia un precio; dos avisos `custom_removed`.
- **13e:** el fondo animado se oculta al vencer el VIP y vuelve al renovar; el dueño lo borra.
- **12:** la inversa deja la estructura igual.

### API

- `test/integration/custom.test.ts`: 6 pruebas contra la Supabase local, con el ffmpeg de la PC: un GIF de verdad pasa a WebM con su WebP, se sube a Storage, cobra en monedas VIP y se ve en `/cosmetics`; el reemplazo borra el archivo viejo; el fondo fijo con la proporción mala o sin la casilla de derechos se rechaza; denuncia, moderación y sacar con aviso; borrar y sacar desde Gestionar.
- `test/unit/media.test.ts`: tipos de archivo, recorte y filtros. Las 616 unitarias y las 8 de integración de la tienda siguen pasando.

### Web

- `CustomPanel.test.tsx`: 10 pruebas (los botones según VIP y ffmpeg, ponérselo y sacárselo, VIP vencido, cómo se dibuja lo propio, la denuncia). Toda la web: 125 archivos y 763 pruebas en verde, tipos y lint limpios.
- **Navegador** (Chrome de Daniel, cuenta `daniloev`): los recuadros de Avatares y Fondos, el encuadre de un GIF con la proporción del fondo, la ventana de pago (precio y «te faltan 40 monedas VIP», sin pagar), la pestaña Imágenes de Baneos y los precios en Administración › Tienda. Sin errores en la consola.

## En qué se apartó del plan

- **Bucket `cosmetics` en vez de `avatars`:** `avatars` solo acepta imágenes de hasta 1 MB y no WebM.
- **Proporción del fondo propio 11:4** (la de la tarjeta del lobby) en vez de «la forma de los fondos de la tienda» (cuadrados de 400×400 que se recortan): lo que el jugador encuadra es lo que se ve.
- **Lo animado acepta también MP4 y WebM**, además de GIF, PNG y WebP animados: muchos «GIF» se descargan como video.
- **Error sin ffmpeg:** 501 `NOT_AVAILABLE` (el código que la API ya usa para lo que no está disponible).
- **Los 16 avatares no se borraron:** nunca estuvieron en git, así que se movieron a `~/.v34frag/avatares-retirados/` para no perderlos.
- **Seis volvieron un rato y salieron otra vez** (Daniel, 2026-11-14): Nieve, Cadenas, Gato DJ, Oscuridad, Lata caminante y Mono con estilo. Quedó como dice el plan: ninguno de los 16 (`catalogo.json` versión 13, la `113` carga 369).
- **Lo que ya estaba hecho** (avatares y fondos de Kyan, precios, vista previa, edición de artículos, armas y temas) se documenta en la [tienda](../2026-11-11-tienda-de-puntos/).

## Incidentes durante las pruebas

- La prueba de la web encontró que la ficha decidía si mostrar el avatar animado mirando `file`: lo propio no tiene `file` sino `url`. Ahora mira la dirección del archivo.
- La prueba de la base vencía el VIP con un `update` que chocaba con el período que empieza en el mismo momento; se corrigió en la prueba.
- En la base local, la cuenta de prueba `pruebavip` tenía el avatar «Nieve» comprado; al sacar los 16 volvieron a su saldo las 1200 monedas VIP de esa compra.

## Cómo revertir

- Base: la inversa de la `113` (borra toda la tienda). El bucket `cosmetics` y sus archivos quedan; se borran desde el panel de Storage si hace falta.
- API y web: volver a la versión anterior.
- Los 16 avatares: están en `~/.v34frag/avatares-retirados/` (archivos y script), pero no se pueden publicar.

# Plan: avatares animados en la tienda

> Planeación original. Estado: **aprobado por Daniel el 2026-11-12** (renombrar, WebM, VIP, 1200 monedas, sin marco en las filas).

Un tipo nuevo de cosmético, **avatar**: la única forma de tener una imagen animada de perfil en lugar de la foto. Los 16 iniciales los juntó Daniel (GIF). Va sobre la tienda ([`2026-11-11-tienda-de-puntos`](../2026-11-11-tienda-de-puntos/)), que todavía no salió.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Qué es | Tipo `avatar` en la tienda: reemplaza la foto donde se muestre, con el marco encima si hay uno | La foto sigue siendo la del perfil; el avatar es un cosmético más |
| Formato | WebM (VP9, sin audio, hasta 256 px) para la animación y un WebP fijo (un cuadro) | Los GIF pesaban 18 MB (uno solo 7,5 MB); convertidos, 1,3 MB entre los 16 |
| Archivos | `web/frontend/public/cosmetics/avatars/<id>.webm` y `<id>.webp`; los GIF originales fuera del repo (`~/.v34frag/avatares-originales/`), con `pruebas/convertir_avatares.sh` | Lo de `public/` se publica con la web |
| Nombres | `avatar-<qué se ve>`, renombrados por Claude (Daniel, 2026-11-12) | Son el id del artículo en la base y en `catalogo.json` |
| Para quién | **VIP**, con monedas VIP, **1200** cada uno (Daniel); el admin lo cambia | Los marcos y fondos VIP cuestan 1000; estos son animados |
| Dónde se ven | Animados en la ficha, la vista previa de la Tienda y el miniperfil; **quietos** (el WebP) en las filas (ranking, sala de Jugar), y se animan al pasar el mouse | Diez videos a la vez en una lista pesan y distraen |
| Marco en las filas | **Se saca** de la sala de Jugar y del ranking: solo el efecto de nombre (Daniel, 2026-11-12) | El marco está pensado para una foto grande; en una fila de 36 px queda recargado |
| Base | Dentro de la `113` (kind `avatar`, `user_cosmetics.avatar` y los 16 artículos), no un replanteo nuevo | La `113` no salió ni tiene commit |
| Subir imágenes | La API rechaza WebP y PNG **animados** en el avatar, la portada, los logos, los banners y las fotos de mapas (hoy solo rechaza GIF por tipo) | Una imagen animada de perfil solo se consigue en la tienda |

## 1. Base de datos (`113_tienda.sql`)

- `shop_items.kind` acepta `avatar`; `user_cosmetics.avatar`.
- `set_my_cosmetics`, `admin_item_revoke` y `player_cosmetics_public` con el avatar.
- Los 16 artículos en `catalogo.json` (colección `avatares`, `vip_only`, `vip_price` 1200, `file` el WebM) y la carga generada.
- La prueba `probar_113.sql` suma un caso: equipar un avatar VIP, verlo en `player_cosmetics_public` y que se oculte al vencer el VIP.

## 2. API

- `avatar` en los tipos (`Kind`), en lo equipado (`Equipped`, `EquipPatch`), en `CosmeticsLight` (las filas lo muestran quieto) y en `CosmeticsFull`.
- `lib/uploads.ts`: `readImage` rechaza un PNG con `acTL` (APNG) y un WebP con animación (`VP8X` con el bit de animación o un `ANIM`), con `INVALID_FILE` y "La imagen no puede ser animada". Pruebas en `uploads.test.ts`.

## 3. Web

- `cosmetics.tsx`: `FramedAvatar` dibuja el avatar (video en bucle, mudo, con el WebP de póster) o la foto; `animate={false}` muestra el WebP y anima al pasar el mouse.
- Tienda: pestaña **Avatares**; tarjeta y vista previa con el avatar.
- Ficha, miniperfil: el avatar animado.
- Ranking y sala de Jugar: el avatar quieto (sin marco).

## 4. Manual, legales y changelog

- Manual del jugador: los avatares en la tienda.
- Términos: "avatares animados" en la lista de cosméticos.
- Privacidad: sin cambios (es un cosmético más, ya cubierto).
- El changelog de la tienda (2.9.42) suma una línea.

## 5. Requisitos

- `ffmpeg` (instalado). Los derechos de las imágenes: **pendiente de Daniel** (varias parecen arte de terceros).

## 6. Orden

1. Convertir y renombrar (hecho antes del plan, a pedido de Daniel).
2. Base y su prueba; reaplicar la `113` en la base local.
3. API y sus pruebas; tipos.
4. Web y sus pruebas; verlo en el navegador.
5. Manual, términos, contrato, documentación y guía.

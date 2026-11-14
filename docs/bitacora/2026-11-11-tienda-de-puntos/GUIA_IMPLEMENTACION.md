# Tienda de cosméticos con puntos y monedas VIP: guía de implementación

## Estado

**Desplegado el 2026-11-14** (23:44 a 23:51 UTC): la `118` y la `119` en producción, y la API y la web `e0b08e9f9e82`. Ver el despliegue en la [guía de la tienda](../2026-11-11-tienda-de-puntos/GUIA_IMPLEMENTACION.md).

Antes: Base, API, web, manual y legales hechos y probados en local el 2026-11-12, sobre una copia de producción. **Sin commit ni despliegue.** Sale junto con el arreglo de permisos (`114`, [`2026-11-12-permisos-funciones`](../2026-11-12-permisos-funciones/)), por decisión de Daniel del 2026-11-12.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/113_tienda.sql` | Nuevo: tablas, funciones, vistas, avisos y los 333 artículos |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/113_tienda.sql` | Nuevo: la inversa |
| `pruebas/probar_113.sql` y `probar_113.sh` | Nuevos: 12 bloques con rollback |
| `pruebas/generar_catalogo.py` | Nuevo: la carga del catálogo desde `catalogo.json` |
| `web/backend/src/routes/shop.ts`, `schemas/shop.ts`, `services/shop.ts` | Nuevos: las rutas de la tienda, la cuenta, los cosméticos por lotes y el admin |
| `web/backend/src/routes/players.ts`, `ranking.ts`, `schemas/players.ts` | `cosmetics` en Jugadores, la ficha (con `cover_url`), el ranking y el comparador |
| `web/backend/src/routes/me.ts`, `schemas/profile.ts` | `details.cover_url` en Mi perfil |
| `web/backend/src/app.ts` | Monta `shop` |
| `web/backend/src/db/types.ts` | Regenerado (de paso, `mm_config` suma tres campos que faltaban) |
| `web/backend/test/unit/shop-routes.test.ts`, `test/integration/shop.test.ts` | Nuevos |
| `web/backend/scripts/copia-produccion.sh` | Nuevo: copia de producción en la base local (`copiar`, `cargar`, `todo`) |
| `web/backend/scripts/db-local.sh` | Los replanteos en orden numérico (el glob ponía la `100` antes que la `10` y la `98`) |
| `web/frontend/public/cosmetics/` | Nuevo: los 183 archivos de Kyan y `catalogo.json` |
| `web/frontend/src/features/shop/` | Nuevo: `cosmeticos.css`, `cosmetics.tsx`, `types.ts`, `api.ts`, `ShopPage.tsx`, `AdminShopPage.tsx`, `CoverCard.tsx` y `shop.test.tsx` |
| `web/frontend/src/routes/_app/shop.tsx` y `admin.shop.tsx` | Nuevos |
| `web/frontend/src/features/shell/lib/nav.ts`, `auth/permissions.ts` | **Tienda** en Comunidad y en Administración (sección `shop`, solo admin) |
| `web/frontend/src/features/player/pages/PlayerProfile.tsx` | Portada, tema, marco, efecto de nombre, insignia VIP y stickers |
| `web/frontend/src/features/ranking/pages/PlayersRanking.tsx` | Marco y efecto de nombre |
| `web/frontend/src/features/matchmaking/room/RoomOverview.tsx`, `FriendsPanel.tsx` | Marco y efecto en la sala; efecto en los amigos |
| `web/frontend/src/features/profile/pages/ProfileSection.tsx` | La tarjeta de la portada |
| `web/frontend/src/features/shell/notifications/lib/model.ts` (y su prueba) | Los cuatro avisos |
| `web/frontend/src/api/schema.d.ts`, `routeTree.gen.ts` | Regenerados |
| `docs/frontend/contrato/tienda.md` y el índice, `decisiones.md`, `jugadores.md`, `notificaciones.md` | El contrato |
| `docs/manual/jugador/tienda-y-cosmeticos.md`, `docs/manual/admin/tienda-y-puntos.md` | Nuevas |
| `web/frontend/src/features/legal/pages/TermsPage.tsx`, `PrivacyPage.tsx`, `lib/meta.ts`, `terms/terminos.html`, `terms/privacidad.html` | La tienda fuera de "En preparación", monedas VIP, portada; fecha 2026-11-12 |

## Despliegue (hecho el 2026-11-14, 23:44 a 23:51 UTC)

Junto con los permisos ([`2026-11-12-permisos-funciones`](../2026-11-12-permisos-funciones/)), lo propio guardado
([`2026-11-14-inventario-de-lo-propio`](../2026-11-14-inventario-de-lo-propio/)) y el avatar en toda la web
([`2026-11-14-avatar-en-toda-la-web`](../2026-11-14-avatar-en-toda-la-web/)). No toca los servidores de juego.

1. **Renumeración:** la `113` pasó a ser la **`119`** y la `114` de permisos, la **`118`**: en `main` ya estaban la
   `113` a la `117`. La `119` sale con los valores y el catálogo de la base local de Daniel (20 y 10 puntos por mix, fondo
   fijo a 300, topes 5 y 5, 326 de 369 artículos a la venta; `catalogo.json` versión 14 guarda `price` y `active`).
2. **Rama:** `feat/tienda-de-puntos` con `origin/main` mezclado (`019eb513`, hasta la `117`). API: 647 pruebas; web:
   788. `ffmpeg` 8.0.1 instalado antes en el VPS.
3. **118 regenerada contra producción** (por el túnel, solo lectura, `referencia.sh 117` y `comparar.sh`): los mismos
   407 objetos que el 2026-11-12; las migraciones `113` a `117` no sumaron ninguno. `comparar.sh` pasa ahora la consulta
   por la entrada estándar (en Windows, como argumento, la tilde llegaba en otra codificación).
4. **Ensayo en producción**, la `118` y la `119` en una transacción que se deshizo: 369 artículos (326 activos), los
   valores de Daniel y el bucket `cosmetics`; después, sin tienda. Duró 67 s por una consulta de saldos de todas las
   cuentas que no iba en la aplicación real: durante ese minuto las lecturas de `profile_details` pudieron esperar.
5. **Respaldo** `20261114T234345Z` en R2 (`sudo cmleague-respaldar`).
6. **Base:** la `118` (23:44 a 23:45 UTC) y la `119` (23:45:33 a 23:45:47 UTC), y `notify pgrst`. Comprobado: `anon` ya
   no ejecuta `season_close_run`, el plugin sigue llegando a `csstv_ingest`, `matches.link_code` no se lee; contra la
   referencia hasta la `117` solo queda la diferencia esperada (`matches.parent_approved`, que da la `118`).
7. **API:** `deploy/vps/desplegar.sh api`, `e0b08e9f9e82` (antes `777a477bac92`), `/api/health` con esa versión.
8. **Web:** `deploy/vps/desplegar.sh web`, `e0b08e9f9e82` (antes `777a477bac92`).
9. **Comprobado sin sesión:** `GET /api/v1/shop/config` con los valores de Daniel, `GET /api/v1/shop/items` con el
   catálogo, `/me/points`, `/me/custom` y `/admin/shop/items` dan 401, y `https://cmleague.lat/shop` responde.
10. **Falta:** probar en producción con una cuenta común y una VIP (comprar, equipar, subir lo propio, el avatar en
    toda la web), publicar `CHANGELOG_DISCORD.txt` (2.9.46) en Discord y publicar `terms/` donde se publiquen.

Vuelta atrás: la API y la web `777a477bac92` (`ln -sfn`, ver `deploy/vps/README.md`), y las inversas de la `119` y la
`118` (en ese orden).

## Despliegue (como se planeó, con la `114`)

1. Respaldo del día en R2.
2. Por el túnel, en orden: la **`114_permisos.sql`** (su guía) y la **`113_tienda.sql`**. La `113` no cambia datos existentes salvo agregar `profile_details.cover_url` y la categoría de los avisos; no hace falta parar nada.
3. `notify pgrst` (la `113` no lo hace; la `114` sí).
4. API y web desde `main`, como siempre (`deploy/`).
5. Probar en producción con una cuenta común y una VIP: la Tienda, comprar, equipar, la ficha, el ranking, la sala y Administración › Tienda.
6. Publicar `CHANGELOG_DISCORD.txt` (2.9.46, o la que siga cuando salga).
7. Commit en `main`. Lo de `features/matchmaking/` (sala y amigos) también en `feat/frontend-fase-1`; la base no toca el matchmaking, así que no va a `feat/mm-claim-en-sala`.

## Pruebas

### Base (`pruebas/probar_113.sh`, sobre la copia de producción del 2026-11-12)

12 bloques, todos con rollback:
1. Suman los mixes, los mapas del matchmaking y el SteamID adicional; no suman el interrumpido, el sin ELO, el abandonado, el oficial ni el que está en vivo.
2. `anon` ve el catálogo y no compra ni ve saldos.
3. Cada uno ve su saldo y su historial, con el total, y nada ajeno.
4. Comprar con puntos y con monedas VIP; rechaza sin saldo, repetido, el premio VIP y sin precio.
5. Equipar lo propio y el premio VIP; rechaza lo ajeno y el tipo equivocado; conserva lo que no viene.
6. Sin escritura directa en las tablas ni funciones del admin para cualquiera.
7. Lo VIP se oculta al vencer y vuelve al renovar; las monedas quedan.
8. Regalos y correcciones con aviso, quitar sin devolver lo pagado, precios, configuración, cuentas e inventario; 4 avisos en `account`.
9. El admin quita la portada.
10. `shop_buy` toma el lock por cuenta.
11. Sin ficha no se compra.
12. La inversa deja la estructura idéntica.

Con datos reales: quien más tiene juntó 975 puntos (75 partidas); el listado de cuentas del admin tarda 0,4 s.

### API

- Unitarias: 17 nuevas (613 en total), en verde. Typecheck sin errores.
- Integración: `shop.test.ts`, 8 de 8 (puntos de los mixes, comprar, lo VIP, catálogo, equipar en la ficha y en Jugadores, admin, portada, configuración). La suite completa: los fallos que quedan son de otras áreas y ya fallaban sobre la copia de producción (ver la guía de la `114`).

### Web

- Typecheck, lint y 742 pruebas en verde (5 nuevas de la tienda; los avisos nuevos en la prueba de categorías).
- **En el navegador** (local, con una cuenta VIP y admin vinculada a una ficha con mixes):
  - la Tienda carga con los saldos reales;
  - ponerse el Marco Oro VIP;
  - comprar un marco en oferta (diálogo con precio y saldo restante);
  - la ficha pública con el marco y la insignia;
  - Administración › Tienda: restar puntos con motivo.
- La subida de la portada se probó por la API (integración), no en el navegador.

## En qué se apartó del plan

- **Cosméticos en la sala y los amigos:** en lugar de sumarlos a las funciones del matchmaking (que van en dos ramas), una ruta por lotes, `GET /api/v1/cosmetics?players=`.
- **La portada** va en el bucket `avatars` (carpeta `<uid>/`, con sus políticas) y no en `photos`: no hizo falta crear políticas.
- **Quitar un artículo** deja un descuento en `point_grants`: sin eso, borrar la fila de `user_items` devolvía los puntos (lo encontró la prueba de integración).
- **`details.cover_url` en Mi perfil**, para la tarjeta de la portada (no estaba en el plan).
- **Ficha y listados:** `cosmetics` también en el comparador.
- **La base local** pasó a ser una copia de producción cargada con `copia-produccion.sh` (no `db:reset`, por pedido de Daniel), y `db-local.sh` se corrigió de paso.
- **Las ofertas** se muestran con la fecha en hora de Argentina (en la hora del navegador decía "domingo").
- **Changelog:** 2.9.42, pasado a 2.9.45 y después a 2.9.46 el 2026-11-14, porque `main` ya usó la 2.9.43, la 2.9.44 y la 2.9.45 (rol Soporte).

### Después (2026-11-14, bitácora [`2026-11-13-avatar-y-fondo-propios`](../2026-11-13-avatar-y-fondo-propios/))

- **Catálogo:** se sumaron los 24 avatares y los 12 fondos originales de Kyan (`kyan/pruebas`, 2026-11-01): `public/cosmetics/avatares/` y `fondos/extra-*.svg`, `catalogo.json` versión 10, colecciones Anime y Memes. La `113` carga 385 artículos (`generar_catalogo.py`). En la base local se agregaron sin tocar los que ya estaban.
- **Precios:** los de Kyan divididos por 2,5, redondeados a 50, y 50 más (Daniel). En `generar_catalogo.py` (puntos) y en `vip_price` de `catalogo.json` (monedas VIP). En la base local se actualizaron `price` y `vip_price` de todos, sin tocar `active`.
- **Vista previa en ventana** (`features/shop/ItemPreview.tsx`) en la Tienda y en Administración › Tienda, con miniaturas y filtros por colección y por activo en el catálogo del admin.
- `probar_113.sh` sigue en verde (13 bloques), corrido sobre la base local con la `113` revertida dentro de la misma transacción.
- **Lo propio y las denuncias** (bloque 13 de la prueba, bucket `cosmetics`, rutas y pantallas nuevas) y **sin los 16 avatares de terceros** (la `113` carga 369): ver la [guía](../2026-11-13-avatar-y-fondo-propios/GUIA_IMPLEMENTACION.md) de ese requerimiento.

## Incidentes durante las pruebas

- El esquema generado de la OpenAPI deja nulos los esquemas con nombre que se usan con `.nullable()` (pasa también con `VipStatus`): la web usa `NonNullable<…>`.
- La base local tenía un estado mezclado (le faltaban replanteos de `main`); se reemplazó por una copia nueva de producción. Al probarla aparecieron los permisos de más de producción: requerimiento aparte, [`2026-11-12-permisos-funciones`](../2026-11-12-permisos-funciones/).

## Cómo revertir

- Base: la inversa (`reversas/113_tienda.sql`). Se pierden los inventarios, lo equipado, los regalos y las portadas (los archivos quedan en el bucket); los puntos no, porque se calculan.
- API y web: volver a la versión anterior. La web sin la API nueva no pide nada de la tienda salvo `cosmetics` en las respuestas, que son campos nuevos.

# Etiqueta "Nuevo" en la tienda durante 3 días: guía de implementación

## Qué se hizo

1. `132_tienda_etiqueta_nuevo.sql`: `create or replace view shop_catalog`, igual a la de la `119` con `is_new` al final. La inversa borra la vista y la vuelve a crear como en la `119`, con su comentario y su permiso (una vista no deja quitar columnas con `create or replace`).
2. API: `is_new` en `ShopItem`, en `CATALOG` y en `CatalogRow`. La prueba de la ruta comprueba que se pide la columna y que llega en la respuesta.
3. Web: `pnpm gen:api` (2 líneas en `schema.d.ts`), la etiqueta en `ItemCard` (exportado para probarlo) y dos pruebas.
4. Manual del jugador: `jugador/tienda-y-cosmeticos.md`.

## Cambios respecto del plan

- La etiqueta quedó solo en la tarjeta de la tienda, no en la vista grande (`ItemPreview`): la vista grande no tiene etiquetas (tampoco la de oferta) y se abre desde la tarjeta.

## Pruebas

- Base local: `132` aplicada; `is_new` es verdadero en 22 artículos (los de la `130`) y falso en 325. `anon` sigue pudiendo leer la vista. Inversa probada dentro de una transacción con `rollback`.
- API local: `GET /api/v1/shop/items?collection=tactico` devuelve `"is_new": true`.
- `web/backend`: `pnpm exec vitest run test/unit/shop-routes.test.ts`, 18 de 18; `tsc` sin errores.
- `web/frontend`: `pnpm exec vitest run src/features/shop`, 48 de 48; `tsc` y `eslint` sin errores.
- No se probó en el navegador con sesión.

## Despliegue

**Desplegado el 2026-11-20 (18:10-18:14 UTC)**, commit `9dc88348`: respaldo `20261120T181053Z`, replanteos `129` a `132` por el túnel, API y web `9dc88348b8b9` (desde una copia limpia del commit, sin los cambios sin commit de otros requerimientos). Con una sala del matchmaking en juego (`1fd48e0f`, partida ya empezada, por decisión de Daniel), que siguió `live`. Comprobado: 12 artículos de `tactico` y 22 con `is_new`, `GET /seasons/1/summary` 200 y 121 recaps de la Temporada 1. Antes decía: **Sin desplegar.** Orden: primero la `132` en la base de producción, después la API (pide `is_new` a la vista: sin la `132` falla el catálogo) y después la web.

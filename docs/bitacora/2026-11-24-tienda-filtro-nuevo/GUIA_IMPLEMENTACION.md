# Filtro "Nuevo" en la tienda: guía de implementación

## Estado

Hecho y probado en local el 2026-11-24. **Sin commit ni despliegue.**

## Archivos

| Archivo | Cambio |
|---|---|
| `web/backend/src/schemas/shop.ts`, `web/backend/src/routes/shop.ts` | `is_new` en `GET /shop/items` |
| `web/backend/src/db/types.ts` | `is_new` en `shop_catalog`, agregado a mano: los tipos no se habían regenerado desde la `132` |
| `web/backend/test/unit/shop-routes.test.ts` | Prueba del filtro |
| `web/frontend/src/api/schema.d.ts` | El parámetro, agregado a mano (el archivo ya tenía cambios sin commit de otros pedidos) |
| `web/frontend/src/features/shop/ShopPage.tsx` | `isNew()`, la opción **Nuevo**, el filtro y el mensaje |
| `web/frontend/src/features/shop/Inventory.test.tsx` | Prueba del selector |
| `docs/manual/jugador/tienda-y-cosmeticos.md` | El filtro nuevo |

## Despliegue

Sin hacer. Va la API y la web, en cualquier orden: la web no usa el parámetro nuevo. Sin migración. No toca los servidores de juego (#1, #2, #3).

## Pruebas

### API

- `pnpm typecheck` y las 685 pruebas unitarias.
- Contra la base local: `is_new=true` devuelve 10 (los 10 marcos nuevos), `is_new=false&kind=frame` 86 de 96, y `is_new=si` da 400.

### Web

- `pnpm typecheck`, ESLint, Prettier y las 51 pruebas de `src/features/shop`: solo queda lo que lleva la etiqueta, lo nuevo que ya tienes no sale, y el mensaje cuando el tipo no tiene nada nuevo.
- Sin probar a mano en el navegador. No se corrió el resto de las pruebas de la web.

## En qué se apartó del plan

- Se sumó `web/backend/src/db/types.ts`, que no tenía `is_new`.

## Cómo revertir

Revertir el commit. No hay datos que deshacer.

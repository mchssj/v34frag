# Sección Inventario, aparte de la Tienda: guía de implementación

## Qué se hizo

1. `ShopPage` recibe `mode` (`"shop"` por defecto o `"inventory"`). En inventario:
   - `items` es lo tuyo (`owned`); `byId` sigue usando todo el catálogo, para dibujar lo puesto.
   - Se ocultan el saldo, el aviso del VIP, las ofertas y el filtro "Mostrar"; la lista ordena lo puesto primero (`isOn`).
   - Cambian el título, el texto, el botón de arriba (**Ir a la tienda**) y el mensaje sin artículos.
2. Ruta `src/routes/_app/inventory.tsx`, con `?canjear=true` como la tienda. `routeTree.gen.ts` lo regeneró el plugin del router con `pnpm dev` levantado.
3. Entrada del menú en `nav.ts`.
4. Manual del jugador.

## Cambios respecto del plan

Ninguno.

## Pruebas

- `Inventory.test.tsx` (MSW y router en memoria): en inventario se ven solo los dos marcos tuyos, el puesto primero, sin el de oferta, sin "Ofertas de la semana", sin el saldo ni el filtro, y con **Ir a la tienda** hacia `/shop`; la tienda sigue mostrando todo.
- `nav.test.ts`: `/inventory` marca Inventario y `/shop` marca Tienda.
- Toda la web: 837 pruebas en 136 archivos, `tsc` y `eslint` sin errores.
- No se probó en el navegador con sesión: la base local es una copia de producción y no hay una cuenta de prueba.

## Despliegue

**Desplegado el 2026-11-20 (18:10-18:14 UTC)**, commit `9dc88348`: respaldo `20261120T181053Z`, replanteos `129` a `132` por el túnel, API y web `9dc88348b8b9` (desde una copia limpia del commit, sin los cambios sin commit de otros requerimientos). Con una sala del matchmaking en juego (`1fd48e0f`, partida ya empezada, por decisión de Daniel), que siguió `live`. Comprobado: 12 artículos de `tactico` y 22 con `is_new`, `GET /seasons/1/summary` 200 y 121 recaps de la Temporada 1. Antes decía: **Sin desplegar.** Solo la web (`web/frontend`).

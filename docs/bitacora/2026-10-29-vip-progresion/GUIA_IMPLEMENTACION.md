# Progresión VIP con moneda propia: guía de implementación

## Estado

Implementado y probado el 2026-10-29 en el demo del frontend nuevo (`/demo/tienda`). Pasaron `tsc` y `eslint`.

Se probó en el navegador:
- comprar un sticker VIP con monedas: de 535 pasó a 335;
- sacar el VIP: lo comprado y el saldo quedan congelados;
- el Marco Oro VIP: se equipa solo siendo VIP;
- los campos nuevos del admin.

Falta:
- **Migración:** no se corrió en ningún Postgres. Docker estaba apagado y no se pudo probar en la base local.
- **API:** el backend todavía no tiene rutas para las monedas VIP.

## Archivos

| Repo / rama | Archivo | Cambio |
|---|---|---|
| `kyan/pruebas` | `supabase/migrations/20261029210000_vip_progresion.sql` | Todo lo de la base (ver la documentación) |
| `kyan/pruebas` | `assets/perfil/marcos/vip-oro.svg` | El Marco Oro VIP |
| `kyan/pruebas` | `assets/perfil/catalogo.json` | Versión 8: `marco-vip-oro`, `vip_price` y `vip_reward`, y la colección `vip` |
| `kyan/pruebas` | `pruebas/generar_vip.py` | Dibuja el marco, pone los precios VIP en el catálogo y escribe el bloque de precios de la migración |
| `kyan/pruebas` | `docs/bitacora/2026-10-29-tienda-web/pruebas/generar_catalogo_sql.py` | Saltea el Marco Oro VIP, que va en esta migración |
| `kyan/ejemplo-matchmaking` | `public/cosmetics/marcos/vip-oro.svg`, `catalogo.json` | Copia de los assets |
| `kyan/ejemplo-matchmaking` | `src/features/shop/{types.ts,demo.ts,ShopPage.tsx,AdminShop.tsx}`, `src/routes/demo.tienda.tsx` | Moneda VIP en el demo, la tienda y el admin |

## Cambios respecto del plan

Ninguno.

## Pasos para desplegarlo

1. **Migraciones:** correr, en este orden y en el SQL Editor:
   1. `20261028120000_vip.sql`
   2. `20261029180000_tienda.sql`
   3. `20261029200000_fondo_miniperfil.sql`
   4. `20261029210000_vip_progresion.sql`

   Todas son re-ejecutables. Conviene probarlas antes en la base local del backend.
2. **Web vieja:** la tienda de `index.html` sigue con la regla anterior, en la que lo VIP se usa gratis. **No conviene correr el paso 1.4 hasta portar esa tienda o pasar al frontend nuevo.** Si se corre igual, en la web vieja los VIP verían sus artículos VIP como "incluidos", pero no los podrían equipar.
3. **Backend:** rutas para `my_vip_coins`, `my_vip_coins_history`, `shop_buy` (devuelve `currency`), `admin_vip_coins_grant`, `admin_shop_item_vip_price` y `set_vip_coins_config`.
4. **Discord:** publicar el changelog cuando esté en producción.

No toca el plugin, así que no hay nada que subir a nuestro servidor ni a RBK.

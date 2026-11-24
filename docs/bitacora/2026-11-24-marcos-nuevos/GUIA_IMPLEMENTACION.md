# 7 marcos nuevos en la tienda: guía de implementación

## Estado

Commiteado el 2026-11-24. El despliegue se anota abajo.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/public/cosmetics/marcos/*.svg` | Los 7 marcos |
| `docs/generar_*.mjs` | `fauces`, `siesta`, `nocturno`, `bosque`, `sabueso` y `terminal` |
| `supabase/replanteo/143_tienda_marcos_nuevos.sql` y su inversa | Las 7 filas de `shop_items` |
| `web/frontend/public/cosmetics/catalogo.json` | Versión 18, 415 artículos |

## Despliegue

Pendiente.

## Pruebas

- Cada marco, en Chrome sin ventana: al lado de su referencia, en varios momentos del ciclo, en tema claro y oscuro y a 128, 96, 64 y 44 px.
- `143` en la base local: inserta los 7; una segunda vez falla con "ya se aplicó". La inversa, dentro de una transacción con `rollback`, los borra.
- No se probó comprar cada marco con una cuenta. No se probó en Safari ni en Firefox.

## En qué se apartó del plan

Ninguno. Los marcos se cargaron primero en local a 550 puntos y sin VIP; al publicar quedaron como en el plan.

## Cómo revertir

1. Base: la inversa de la `143`. **Borra las compras de estos marcos**, sin devolver puntos ni monedas VIP.
2. Web: volver a la versión anterior (queda en el VPS).

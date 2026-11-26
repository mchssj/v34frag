# 20 temas de perfil con textura: guía de implementación

## Estado

Hecho en local el 2026-11-24. **Sin commit y sin desplegar.**

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/features/shop/cosmeticos.css` | Reglas comunes, los 20 temas y sus animaciones |
| `web/frontend/src/features/shop/types.ts` | `COLLECTIONS.texturas` |
| `web/frontend/public/cosmetics/catalogo.json` | Versión 19, 435 artículos |
| `supabase/replanteo/144_tienda_temas_con_textura.sql` y su inversa | Las 20 filas de `shop_items` |
| `docs/manual/jugador/tienda-y-cosmeticos.md` | Sección Temas |

## Despliegue

1. Commit solo con lo de este pedido y push.
2. Worktree limpio, pruebas de la web y `desplegar.sh web`. La API no cambia.
3. `144` en la base de producción, después de la web.
4. Publicar `CHANGELOG_DISCORD.txt` (CMLeague 2.9.72).

No toca los servidores de juego (#1, #2, #3).

## Pruebas

- Los 20 en la página real del jugador en local, con una sesión y un tema simulados en el navegador (sin tocar cuentas). Cuatro en teléfono y cuatro con la web en modo claro. Cuaderno, también en Mapas, Bio y torneos, Logros, Comentarios, Clips y Temporadas.
- La tienda en modo claro: la colección, las muestras y "Probar" con Fileteado.
- Contraste calculado sobre el color de la tarjeta: el texto secundario da 6,0 o más; victoria y derrota, 4,5 o más.
- `144` en la base local: inserta los 20; una segunda vez falla con "ya se aplicó". La inversa, dentro de una transacción con `rollback`, los borra.
- `vitest` de la tienda y del jugador: 93 pruebas.
- No se probó comprar y equipar con una cuenta, ni con portada, ni Safari ni Firefox.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

1. Base: la inversa de la `144`. **Borra las compras de estos temas**, sin devolver puntos.
2. Web: volver a la versión anterior.

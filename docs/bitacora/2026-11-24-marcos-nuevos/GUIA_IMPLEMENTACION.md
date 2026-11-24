# 7 marcos nuevos en la tienda: guía de implementación

## Estado

Desplegado el 2026-11-24 (~22:12 UTC). Falta publicar el changelog.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/public/cosmetics/marcos/*.svg` | Los 7 marcos |
| `docs/generar_*.mjs` | `fauces`, `siesta`, `nocturno`, `bosque`, `sabueso` y `terminal` |
| `supabase/replanteo/143_tienda_marcos_nuevos.sql` y su inversa | Las 7 filas de `shop_items` |
| `web/frontend/public/cosmetics/catalogo.json` | Versión 18, 415 artículos |

## Despliegue (hecho el 2026-11-24)

1. Commit `bb718895` en `main`, solo con lo de este pedido (los índices compartidos, desde `HEAD` más su fila), y push.
2. Worktree limpio en `bb718895`, `pnpm install --frozen-lockfile`, pruebas de la API (685) y de la web (846).
3. Sin ninguna sala armándose (había una en vivo): `desplegar.sh web --sin-pruebas` y después `desplegar.sh api --sin-pruebas`, comprobando las salas antes de cada una. Web y API `bb718895cc67` (antes `87388ef5324b` y `c3803aa60c69`). La API es por el filtro "Nuevo"; su reinicio no tocó el worker del matchmaking.
4. `143` en la base de producción, después de comprobar que `cmleague.lat` sirve los 7 SVG con el mismo tamaño que en git:

   ```bash
   (echo "set lock_timeout = '5s';"; cat supabase/replanteo/143_tienda_marcos_nuevos.sql) | ssh ubuntu@<VPS> "sudo docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 -q"
   ```

   De 408 a 415 artículos. `GET /api/v1/shop/items?kind=frame&is_new=true` devuelve los 7 (y los 4 de la `138`), y `catalogo.json` está en la versión 18.
5. Pendiente: publicar `CHANGELOG_DISCORD.txt` (CMLeague 2.9.71).

No toca los servidores de juego (#1, #2, #3).

## Pruebas

- Cada marco, en Chrome sin ventana: al lado de su referencia, en varios momentos del ciclo, en tema claro y oscuro y a 128, 96, 64 y 44 px.
- `143` en la base local: inserta los 7; una segunda vez falla con "ya se aplicó". La inversa, dentro de una transacción con `rollback`, los borra.
- No se probó comprar cada marco con una cuenta. No se probó en Safari ni en Firefox.

## En qué se apartó del plan

Ninguno. Los marcos se cargaron primero en local a 550 puntos y sin VIP; al publicar quedaron como en el plan.

## Cómo revertir

1. Base: la inversa de la `143`. **Borra las compras de estos marcos**, sin devolver puntos ni monedas VIP.
2. Web: volver a la versión anterior (queda en el VPS).

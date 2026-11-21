# 13 marcos nuevos en la tienda: guía de implementación

## Qué se hizo

1. Cada marco con la guía de arte (`docs/guia_y_flujo_de_arte_conceptual_estilo_steam.md`), a partir de una referencia de Steam, y probado en la tienda local antes de seguir con el siguiente:

   | Marco | Cómo se hizo |
   |---|---|
   | Cyberpunk | `recraft-v3` sobre blanco y recorte por color (`recortar_marco.mjs`). Fijo |
   | Plasma líquido | `flux-1.1-pro` sobre blanco, video `kling-v2.5-turbo-pro` y recorte `--brillo` cuadro por cuadro (`animar_marco.sh`) |
   | Plasma de fuego | El mismo con otra paleta (`recolorear_marco.mjs`, azul a rojo y naranja) |
   | Boceto | `flux-1.1-pro` y temblor en local (`temblor_marco.mjs`), sin video |
   | Boceto de tiza | El Boceto con el color invertido, para el tema oscuro |
   | Destellos | SVG animado (`generar_destellos.mjs`) |
   | Conejo | SVG animado escrito a mano |
   | Energía (5 paletas) | SVG animado (`generar_energia.mjs`) |
   | Synthwave | `flux-1.1-pro-ultra` (escena entera), video `kling-v2.5-turbo-pro` y hueco de la foto cortado con la forma de la web (`hueco_marco.mjs`) |

2. Los 13 archivos en `web/frontend/public/cosmetics/marcos/` y los 13 en `catalogo.json` (versión 16).
3. `133_tienda_marcos_nuevos.sql` y su inversa, generadas con un script de una sola lista (los 13 de la base local) que también escribió `catalogo.json`, para que digan lo mismo.

## Cambios respecto del plan

- Los descartados no se publicaron: Llamas fantasma (no le gustó a Daniel), Vacío (no se parecía a la referencia) y Código (Daniel lo sacó antes de publicar).
- Los ids y archivos que terminaban en `-ia` se renombraron antes de publicar (`marco-plasma-liquido`, `marco-plasma-fuego`, `marco-boceto`, `marco-boceto-tiza`). En la base local se pasaron también las compras y el marco equipado de Daniel.
- Cyberpunk pasó de PNG de 1,17 MB a WebP de 54 KB (512 px).
- El plasma azul se llama **Plasma líquido** y no "Plasma", porque ese nombre ya lo usan `marco-plasma` y `nombre-plasma`.

## Pruebas

- Cada marco, visto en la tienda local (Vite 5173 y la API local) y con capturas sobre un avatar de prueba, en tema claro y oscuro. Los SVG, en Chrome sin ventana en 6 momentos del ciclo.
- `133` y su inversa en la base local dentro de una transacción con `rollback`: inserta los 13 (3 VIP, etiqueta Nuevo, orden 3920 a 4040) y la inversa los borra.
- No se probó comprar y equipar cada marco con una cuenta (sí el Plasma de fuego, equipado por Daniel en local). No se probó en Safari ni en Firefox.

## Despliegue

**Sin desplegar.** Va en este orden:

1. La web (`web/frontend`), desde una copia limpia del commit: los archivos tienen que estar antes que los artículos.
2. Respaldo de la base del VPS y `133_tienda_marcos_nuevos.sql` por el túnel:

   ```bash
   psql "$PG_URL" -v ON_ERROR_STOP=1 -f supabase/replanteo/133_tienda_marcos_nuevos.sql
   ```

3. Publicar `CHANGELOG_DISCORD.txt` (CMLeague 2.9.59).

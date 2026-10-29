# Tienda de cosméticos en la web: guía de implementación

## Estado

Implementada y probada en local el 2026-10-29, con datos de ejemplo. **Falta aplicar las dos migraciones en Supabase y publicar la web.** Commiteado en `kyan/pruebas`.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261028120000_vip.sql` | **Copiado sin cambios** de `feat/backend-api-fase-1` (VIP fase 0). Cuando se mergeen las ramas, el archivo es idéntico y no choca |
| `supabase/migrations/20261029180000_tienda.sql` | Tablas, vistas, funciones y la carga de los 308 artículos con precio |
| `index.html` | Menú Tienda y Admin → Tienda; páginas `#shop` y `#shadm`; portada en Mi perfil; cosméticos en la ficha y en la lista de jugadores; carga de `assets/perfil/cosmeticos.css` |
| `.gitignore` | `_tienda_demo.html` |
| `pruebas/generar_catalogo_sql.py` | Regenera la carga del catálogo en la migración desde `catalogo.json` (correrlo si cambia el catálogo) |
| `pruebas/generar_demo.py` | Copia de la web con la tienda alimentada por `catalogo.json`, para verla sin la migración |

## Despliegue

No toca el plugin, así que no hay nada que subir a nuestro servidor ni a RBK.

1. **Supabase → SQL Editor:** correr `supabase/migrations/20261028120000_vip.sql` (si todavía no se corrió desde el backend; es re-ejecutable).
2. **Supabase → SQL Editor:** correr `supabase/migrations/20261029180000_tienda.sql`. Es re-ejecutable: una segunda corrida actualiza textos y archivos del catálogo, pero no pisa precios ni "activo".
3. **Publicar juntos** `index.html` y la carpeta `assets/perfil/` completa. Sin `assets/perfil/`, los marcos y el CSS no cargan. `datos-falsos.json` y `vista-previa.html` se pueden publicar o no: no los usa la web.
4. **Comprobar:**
   - Tienda muestra el saldo.
   - Comprar un sticker baja el saldo.
   - Equiparlo lo muestra en la ficha.
   - En Admin → Tienda aparecen las cuentas.
   - Darle VIP a una cuenta de prueba le habilita lo VIP.
5. **Changelog:** publicar [`CHANGELOG_DISCORD.txt`](CHANGELOG_DISCORD.txt).

## Pruebas

### Web en local (navegador del escritorio, `http://localhost:8099`)

- **Sin la migración** (contra la Supabase real, solo lectura):
  - `#shop` muestra "La tienda todavía no está disponible".
  - El resto de la web carga igual.
  - En la consola hay 404 de las tablas nuevas, que es esperado hasta aplicar la migración.
- **Con datos de ejemplo** (`pruebas/generar_demo.py`, `?demo=1`, con `&vip=1` y `&admin=1`):
  - **Tienda:**
    - La vista previa aplica el marco, el nombre, el tema y los stickers.
    - Las ofertas se muestran con el precio tachado.
    - Pestañas, colecciones, búsqueda y filtros funcionan.
    - Con 840 puntos, lo que cuesta más aparece con "te faltan" y Comprar deshabilitado.
    - El banner VIP cambia si sos VIP.
  - **Lista de jugadores:** el marco, el efecto de nombre y la etiqueta VIP.
  - **Ficha:** el marco sobre la foto, el nombre con efecto, VIP, los stickers y el tema VIP (dorado) en la cabecera y el cuerpo.
  - **Mi perfil:** la sección de portada y lo puesto.
  - **Admin → Tienda:** los puntos y el catálogo con precio y activo. Las cuentas fallan porque la función todavía no existe, que es esperado.
  - **Celular (375 px):** sin scroll horizontal.
  - Sin errores de JavaScript. La sintaxis de los dos scripts se revisó con Node.
- **No se probó:**
  - **La migración no se corrió en ningún Postgres**, porque en la máquina no hay Postgres ni Docker activo. Se revisó a mano contra el esquema real (`supabase/schema/public.sql` de `feat/backend-api-fase-1`). Conviene correrla primero en un proyecto de prueba o en la base local del backend (`pnpm db:reset`).
  - Comprar, equipar, subir la portada y las acciones del admin de punta a punta, porque necesitan la migración.
  - Safari y el tema claro.

## En qué se apartó del plan

- **Paso 2 (probar la migración en un Postgres local):** no se pudo, porque no hay Postgres en la máquina. Se dejó anotado arriba.
- **Admin → Tienda:** la recarga de las cuentas se pide solo al abrir la página y después de cada acción, y no en cada render. Antes salía el mismo error repetido.

## Cómo revertir

1. **Web:** volver `index.html` al commit anterior y publicarlo.
2. **Base:** en el SQL Editor, `drop view if exists player_cosmetics_public, shop_catalog;` y borrar las funciones de la tienda: `shop_buy`, `set_my_cosmetics`, `can_use_item`, `my_points`, `my_points_history`, `points_of`, `points_mixes_of`, `was_vip`, `shop_weekly`, `admin_points_grant`, `admin_item_grant`, `admin_item_revoke`, `admin_shop_item_update`, `set_points_config`, `admin_cover_clear` y `admin_points_overview`.
3. **Tablas:** `drop table user_cosmetics, user_items, point_grants, shop_items, points_config;` y `alter table profile_details drop column cover_url;`. **Esto borra las compras y los regalos.**
4. **VIP:** no hace falta revertirlo; es del backend.

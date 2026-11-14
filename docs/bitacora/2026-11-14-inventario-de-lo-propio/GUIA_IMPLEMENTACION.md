# Lo que sube cada jugador queda guardado, y el encuadre del fondo de miniperfil: guía de implementación

## Estado

**Desplegado el 2026-11-14** (23:44 a 23:51 UTC): la `118` y la `119` en producción, y la API y la web `e0b08e9f9e82`. Ver el despliegue en la [guía de la tienda](../2026-11-11-tienda-de-puntos/GUIA_IMPLEMENTACION.md). Falta recorrerlo en el navegador.

Antes: Hecho y probado en local el 2026-11-14 (base, API y web), sin commit, en `feat/tienda-de-puntos` (worktree `v34frag-mainwt`). **No se recorrió en el navegador** (ver Pruebas). Sale con la tienda.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/113_tienda.sql` | Topes en `points_config`; `custom_cosmetics` sin `replaced` y con índice común; `user_cosmetics.*_custom` a `uuid` con clave foránea; `custom_cosmetic_json(id)`; `set_my_cosmetics` con `custom:<id>`; vista pública; topes en `set_points_config`; subir, borrar, sacar y resolver denuncias de a una subida; etiquetas del historial |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/113_tienda.sql` | Las firmas nuevas; borra `user_cosmetics` antes que `custom_cosmetics` (por la clave foránea) |
| `docs/bitacora/2026-11-11-tienda-de-puntos/pruebas/probar_113.sql` | Bloque 13 reescrito (13a a 13e); si la base ya tiene la `113`, la revierte primero, dentro de la misma transacción |
| `web/backend/src/routes/custom.ts` | Listas, tope antes de convertir, borrar y sacar por id, proporción 1:2 (fijo de 240×480 a 960×1920; animado a 256×512); ya no borra el archivo anterior al subir |
| `web/backend/src/routes/shop.ts`, `schemas/shop.ts` | `custom:<id>` en lo equipado, topes en la configuración, `CustomMedia.id`, `MyCustom.max`, `CustomIdParam` |
| `web/backend/src/db/types.ts` | Regenerado |
| `web/backend/test/integration/custom.test.ts`, `test/unit/media.test.ts` | Casos nuevos; proporción 1:2 |
| `web/frontend/src/api/schema.d.ts` | Regenerado |
| `web/frontend/src/features/shop/CustomPanel.tsx` (y su prueba) | La galería, el contador, el tope, el encuadre 1:2 y los textos |
| `web/frontend/src/features/shop/cosmetics.tsx` | `MiniCard` vertical (1:2, con `size` `sm` o `md`) y `MINI_CARD_ASPECT` |
| `web/frontend/src/features/shop/ShopPage.tsx`, `ItemPreview.tsx`, `api.ts`, `types.ts`, `AdminShopPage.tsx`, `shop.test.tsx` | `custom:<id>`, la lista de Gestionar, los topes, la miniatura del catálogo y «Fondos de miniperfil» |
| `web/frontend/src/features/player/components/MediaReportDialog.tsx`, `features/shell/notifications/lib/model.ts` | «Fondo de miniperfil» |
| `web/frontend/src/features/legal/pages/TermsPage.tsx`, `PrivacyPage.tsx`, `terms/terminos.html`, `terms/privacidad.html` | Términos y privacidad |
| `docs/manual/jugador/tienda-y-cosmeticos.md`, `admin/tienda-y-puntos.md`, `moderador/revisar-imagenes.md` | Manual |
| `docs/frontend/contrato/tienda.md` | Contrato |
| `docs/bitacora/2026-11-11-tienda-de-puntos/CHANGELOG_DISCORD.txt` | Lo guardado y el nombre |

## Despliegue (pendiente)

Va con la tienda: la `113` ya trae todo. Ver la [guía de la tienda](../2026-11-11-tienda-de-puntos/GUIA_IMPLEMENTACION.md) y la de [lo propio](../2026-11-13-avatar-y-fondo-propios/GUIA_IMPLEMENTACION.md). No hace falta nada más.

**La base local de Daniel** tenía la `113` vieja. Se actualizó en su lugar el 2026-11-14 con un script de una sola vez, generado desde la `113` nueva (en el scratchpad de la sesión, no en el repo): agrega los topes, convierte `avatar_custom` y `background_custom` a la subida puesta, pasa las filas `replaced` a `deleted` (sus archivos ya estaban borrados) y recrea las funciones. No tocó el catálogo, lo comprado, los puntos ni la configuración. Antes se guardó un respaldo de esas tablas (`pg_dump -a`). Resultado: el avatar y el fondo que estaban puestos siguen puestos; los dos avatares reemplazados antes quedaron como borrados.

## Pruebas

### Base (`probar_113.sh`, en una transacción que se deshace)

Sobre la base local con la `113` nueva, revertida y vuelta a aplicar dentro de la prueba. Todos los bloques en verde, también el 12 (la inversa deja la estructura igual). Los nuevos:
- **13a:** el VIP sube dos avatares (cobra los dos); los dos quedan guardados; vuelve al primero sin pagar, se lo saca y se pone el segundo; una subida del tipo equivocado o mal escrita: rechazada.
- **13a2:** con 5 avatares, la sexta no cobra; borrar una guardada no toca la puesta y deja subir otra.
- **13b:** sin VIP solo el fondo fijo; no se pone ni se borra una subida ajena; denuncia.
- **13c:** el moderador saca el avatar denunciado y los otros 4 siguen guardados; el admin saca una puesta y una guardada sin poner; topes en la configuración (0 rechazado).
- **13d:** 3 avisos `custom_removed`.
- **13e:** con el tope de fondos en 1 no deja subir otro; lo animado guardado no se ve ni se puede poner con el VIP vencido y vuelve al renovar; borrarlo se lo saca.

### API

- Unitarias: 621 en verde (la de `filterChain` con 1:2). Typecheck sin errores.
- Integración `custom.test.ts`: 8 de 8 contra la Supabase local con el ffmpeg de la PC. Subir otro deja el anterior guardado **con su archivo** (responde 200 después de 1,5 s); volver a él no cobra; una subida ajena no se pone; el tope rechaza sin cobrar; sacar la denunciada deja la otra; borrar y sacar por id.
- `shop.test.ts`: 7 de 8 fallan en la base local de Daniel, y no por este cambio: esperan los valores iniciales (10 y 5 puntos por mix) y artículos activos, y en esa base los valores son 20 y 10 y hay 38 artículos apagados. Hay que correrla sobre una base recién cargada.

### Web

- Typecheck, lint y las 765 pruebas (125 archivos) en verde. La primera corrida completa marcó un fallo que no se repitió en la segunda ni al correr la Tienda sola (44 de 44); parece una prueba inestable con la máquina cargada.
- `CustomPanel.test.tsx`: la galería con el contador, la puesta marcada, ponerse una guardada manda `custom:<id>`, sacársela, borrar pide confirmación (y avisa si está puesta), el tope apaga la subida, lo animado con el VIP vencido no se pone.

### En el navegador: no se hizo

- La extensión de Chrome no estaba conectada.
- La API local del puerto 8787 (el `tsx watch` de `v34frag-mainwt/web/backend`, que corre en la terminal de Daniel) quedó caída después de los cambios y no se reinició sola. La API arranca bien en otro puerto (se usó el 8799 para regenerar los tipos de la web). Hay que reiniciar ese `pnpm dev`.
- Falta recorrer: subir dos, volver al primero sin pagar, el tope, borrar, y el fondo en Jugar en la computadora (5 lugares) y en el celular.

## En qué se apartó del plan

- **El tope al llegar a 5:** el plan lo dejaba como decisión por defecto (no dejar subir); quedó así.
- **`MiniCard` vertical.** El plan decía que «la vista previa del encuadre muestra la tarjeta de Jugar». El 11:4 venía de `MiniCard` (340×124), la tarjeta de las vistas previas de la Tienda, que no tenía la forma de Jugar. Se cambió `MiniCard` a la tarjeta vertical (1:2), así todas las vistas previas muestran lo que se ve.
- **La proporción no se midió en el navegador** (la extensión no estaba conectada): se calculó desde el diseño. Hay que confirmarla al recorrerlo.
- **`custom_cosmetic_json` sigue devolviendo `id: 'custom'`** para dibujar (la denuncia y la ficha lo usan); el id de la subida va en `custom:<id>` solo en lo equipado.
- **El nombre de la ruta de borrar:** `DELETE /me/custom/items/{cid}` (y `…/custom/items/{cid}/clear` en el admin), para no chocar con `POST /me/custom/{kind}`.

## Incidentes durante las pruebas

- **Un hilo naranja en la tarjeta propia de Jugar con fondo de miniperfil** (lo vio Daniel con `daniloev`, el 2026-11-14). La tarjeta propia lleva un borde interior de 2 px con `--primary` (naranja) para marcarla. Con fondo, la imagen o el video queda encima y lo tapa, pero el suavizado de los bordes redondeados lo deja asomar. Ahora el borde va solo sin fondo (`web/frontend/src/features/matchmaking/GroupSlots.tsx`). Como es de `features/matchmaking/`, también se commitea en `feat/frontend-fase-1`. Pruebas del matchmaking: 106 en verde. Falta verlo en el navegador.

## Cómo revertir

Antes de desplegar, volver estos archivos. La base local: la inversa de la `113` y aplicar la `113` anterior, o restaurar el respaldo de las tablas de la tienda. Después de desplegar: con la tienda (su inversa).

# La portada se ve nítida, y el staff la puede quitar desde el perfil: documentación

## Qué hace

**La portada se ve nítida.** Se guarda a 2400×600 (antes 1200×300) y la ficha la muestra siempre en 4:1, a todo el ancho, sin tope de alto: lo que el jugador encuadra es lo que se ve. Antes, en pantallas anchas la caja quedaba cerca de 7:1 (alto máximo de 192 px), la imagen se agrandaba y se cortaba arriba y abajo; en pantallas de alta densidad se estiraba 2 o 3 veces. Las portadas ya subidas no cambian: mejoran si el jugador la vuelve a subir.

**El staff la quita desde el perfil.** Soporte, moderadores y admins ven **Quitar portada** en el perfil público de un jugador con portada (no en el propio), junto a **Quitar foto**. Con motivo (3 a 300 caracteres), se borra el archivo, el jugador recibe el aviso «Te quitaron la portada» con el motivo, se cierran las denuncias abiertas de esa portada y, si lo hizo un soporte, queda en Baneos › Actividad del soporte («quitó la portada de X»).

```mermaid
sequenceDiagram
  participant S as Soporte, moderador o admin
  participant W as Web (perfil público)
  participant A as API
  participant B as Base
  S->>W: Quitar portada + motivo
  W->>A: POST /api/v1/admin/players/{id}/cover/remove
  A->>B: staff_remove_cover(ficha, motivo)
  B-->>A: La URL que tenía
  A->>A: Borra el archivo (bucket avatars, clave de servicio)
  B-->>S: Aviso cover_removed; denuncias cerradas; actividad del soporte
```

## Quién quita una portada

| Quién | Desde dónde |
|---|---|
| Soporte, moderador o admin | El perfil del jugador › **Quitar portada** (nuevo) |
| Moderador o admin | Baneos › Imágenes, si la denunciaron |
| Admin | Administración › Tienda › Cuentas › Gestionar › **Quitar portada** |
| El jugador | Mi perfil › Portada y cosméticos › **Quitar** |

## Base (replanteo `120_portada_staff.sql`)

| Objeto | Qué es |
|---|---|
| `staff_remove_cover(ficha, motivo)` | `is_support()`; motivo de 3 a 300; «No tiene portada» si no hay; saca `profile_details.cover_url`, cierra las denuncias abiertas de esa URL, avisa `cover_removed` y anota `support_log('cover_remove', …)`. Devuelve la URL |
| `support_actions.action` | Acepta `cover_remove` |

## API y web

| Pieza | Cambio |
|---|---|
| `POST /api/v1/admin/players/{id}/cover/remove` | Nueva (`requireSupport`), como `…/photo/remove`; borra el archivo del bucket `avatars` |
| `SUPPORT_ACTIONS` | `cover_remove` |
| `features/shop/CoverCard.tsx` | Recorte a 2400×600 (hasta 1 MB: si pesa más, baja la calidad del JPEG) |
| `features/player/pages/PlayerProfile.tsx` | La portada siempre en 4:1; **Quitar portada** para el staff |
| `features/admin/bans/lib/support.ts` | «Portadas quitadas» y «quitó la portada de X» |

## Qué cambia para cada rol

| Rol | Qué cambia | Página del manual |
|---|---|---|
| Jugador | La portada se ve nítida y como la encuadró; el staff la puede quitar | [`jugador/tienda-y-cosmeticos.md`](../../manual/jugador/tienda-y-cosmeticos.md) |
| Soporte | Quitar portada desde el perfil | [`soporte/quitar-fotos-y-logos.md`](../../manual/soporte/quitar-fotos-y-logos.md) |
| Moderador | Quitar portada desde el perfil, sin denuncia | [`moderador/revisar-imagenes.md`](../../manual/moderador/revisar-imagenes.md) |
| Admin | También desde el perfil, además de Gestionar | [`admin/tienda-y-puntos.md`](../../manual/admin/tienda-y-puntos.md) |
| Capitán, organizador, streamer y dueño de un servidor externo | Nada distinto de lo del jugador | — |

## Términos y privacidad

- **Términos (sección 13):** la portada la puede quitar el staff (soporte, moderadores y administradores), con aviso y motivo. En la página y en `terms/terminos.html`.
- **Privacidad:** sin cambios (la portada ya figura entre lo que se publica, y quitarla no guarda nada nuevo salvo la acción del soporte, que ya está en «Registro de lo que hace el soporte»).

## Dónde está cada cosa

| Qué | Archivo |
|---|---|
| Base | `supabase/replanteo/120_portada_staff.sql` e inversa en `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/` |
| Prueba de la base | `pruebas/probar_120.sql` y `probar_120.sh` |
| API | `web/backend/src/routes/admin-players.ts`, `schemas/bans.ts`, `test/unit/support-routes.test.ts` |
| Web | `CoverCard.tsx`, `PlayerProfile.tsx`, `admin/bans/lib/support.ts` |

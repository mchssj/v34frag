# Plan: la portada se ve nítida, y el staff la puede quitar desde el perfil

> Planeación original. Estado: **aprobado por Daniel el 2026-11-14**.

Pedido por Daniel el 2026-11-14, al ver la portada de un jugador en producción («se ve un poco con mala calidad»), y la duda de si el staff la puede borrar.

## Lo que pasa hoy

- **Calidad.** La web recorta la portada a 1200×300 (`features/shop/CoverCard.tsx`) y la ficha la muestra a todo el ancho (hasta ~1320 px) con un alto máximo de 192 px (`max-h-48` en `PlayerProfile.tsx`). En pantallas anchas la caja queda cerca de 7:1: la imagen se agranda y se le corta arriba y abajo. En pantallas de alta densidad (portátiles, celulares, Windows al 150 % o 200 %) se estira 2 o 3 veces.
- **Quién la quita.** Un admin, desde Administración › Tienda › Gestionar (`admin_cover_clear`, solo admin). Un moderador o un admin, solo si la denunciaron (Baneos › Imágenes). El rol Soporte no puede, y nadie del staff tiene un botón directo en el perfil, como **Quitar foto** (replanteo `117`).

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Tamaño guardado | 2400×600 (el máximo que ya acepta la API), hasta 1 MB: si pesa más, la web baja la calidad del JPEG de a poco, como ya hace | Nítida en pantallas de alta densidad |
| Cómo se ve | Siempre 4:1, sin tope de alto: lo que se encuadra es lo que se ve (Daniel aceptó que en una pantalla ancha mida unos 330 px de alto) | Hoy se agranda y se corta |
| Portadas ya subidas | No se tocan: mejoran si el jugador la vuelve a subir | No hay de dónde sacar más resolución |
| Quitarla desde el perfil | Botón **Quitar portada** en el perfil público para soporte, moderadores y admins, junto a **Quitar foto**, con motivo (3 a 300 caracteres) (Daniel, 2026-11-14) | Igual que la foto de perfil |
| Al quitarla | Se borra el archivo, el jugador recibe el aviso `cover_removed` con el motivo, se cierran las denuncias abiertas de esa portada y, si lo hizo un soporte, queda en la actividad del soporte (`cover_remove`) | Igual que la foto y que las denuncias |

## 1. El flujo

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
  B-->>S: Aviso cover_removed al jugador; actividad del soporte
```

## 2. Base (`supabase/replanteo/120_portada_staff.sql`)

- `staff_remove_cover(p_player, p_reason)`: `is_support()`; motivo de 3 a 300; la portada de la cuenta de la ficha; si no tiene, «No tiene portada»; la saca, avisa `cover_removed`, cierra las denuncias abiertas de esa URL y anota `support_log('cover_remove', …)`. Devuelve la URL.
- `support_actions.action` acepta `cover_remove`.
- Inversa y prueba (`pruebas/probar_120.sql`, con rollback).

## 3. API

- `POST /api/v1/admin/players/{id}/cover/remove` (`requireSupport`), como `…/photo/remove`; borra el archivo del bucket `avatars`.
- `SUPPORT_ACTIONS` con `cover_remove`.

## 4. Web

- `CoverCard.tsx`: recorte a 2400×600.
- `PlayerProfile.tsx`: la portada siempre en 4:1, y **Quitar portada** para el staff (no para el dueño).
- Actividad del soporte: «Portadas quitadas» y «quitó la portada de X».

## 5. Manual, términos y privacidad

- **Manual:** `soporte/quitar-fotos-y-logos.md` (la portada), `moderador/revisar-imagenes.md` y `admin/tienda-y-puntos.md` (el botón directo), `jugador/tienda-y-cosmeticos.md` (quién la puede quitar).
- **Términos:** la portada la puede quitar el staff (soporte, moderadores y admins), con el motivo. En la página y en `terms/terminos.html`.
- **Privacidad:** sin cambios.
- **Changelog:** `CHANGELOG_DISCORD.txt` en esta carpeta.

## 6. Orden

1. La `120`, su inversa y su prueba en la base local.
2. API y web, con pruebas.
3. Manual, términos, changelog y bitácora.
4. Commit en `main`, push y despliegue (la `120` por el túnel, API y web), como pidió Daniel para la tienda.

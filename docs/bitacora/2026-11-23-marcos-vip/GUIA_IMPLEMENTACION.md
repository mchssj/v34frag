# 4 marcos VIP nuevos en la tienda: guía de implementación

## Qué se hizo

1. Cada marco con la guía de arte, a partir de una referencia de Steam, y probado en la tienda local antes de seguir con el siguiente:

   | Marco | Referencia | Cómo se hizo | Costo en Replicate |
   |---|---|---|---|
   | Nevada | `1.gif` / `1.png` | Marco con `flux-schnell` (los dos intentos con `flux-1.1-pro` pintaron una escena con el centro lleno), ajustado a la foto midiendo la línea. Chibi con `animagine-xl-3.1` (regla de Daniel para personajes anime), recortada con `recortar_personaje.mjs` y compuesta delante de la línea y detrás del montón de nieve. Video `kling-v2.5-turbo-pro`, recorte `MODO=--linea EXTRA=--con-personaje` a 768 px, los últimos 3 cuadros mezclados con el primero para el bucle, y copos sobre la foto con `copos_marco.mjs` | ~$0,60 |
   | Celda | `3.gif` / `3.png` | SVG con `generar_celda.mjs` (hierro remachado en vez del hormigón de la referencia) | $0 |
   | Polaroid | `4.png` (el `.gif` perdió el velo translúcido) | Textura de papel con `flux-schnell` en grises (en beige, el filtro de flux la rechazaba) teñida en local, y `generar_polaroid.mjs` | ~$0,01 |
   | Pintura | `6.png` | SVG con `generar_pintura.mjs` (iconos y paleta propios) | $0 |

2. Los 4 archivos en `web/frontend/public/cosmetics/marcos/`.
3. `138_tienda_marcos_vip.sql`, su inversa y `catalogo.json` (versión 17), generados con `pruebas/generar_138.mjs` desde una sola lista, para que digan lo mismo.

## Cambios respecto del plan

- En la tienda local se cargaron primero a 550 puntos y sin VIP; Daniel pidió al desplegar que fueran VIP con el precio de los demás (450 monedas VIP).
- Al revisar Nevada apareció que `animar_marco.sh` armaba los WebP con `libwebp`, que mezcla cada cuadro con el anterior: lo que se mueve sobre transparencia deja rastro. Se cambió a `libwebp_anim`. **Boceto, Boceto de tiza, Plasma líquido y Plasma de fuego (publicados el 2026-11-21) tienen ese rastro**; Daniel decidió no tocarlos por ahora.

## Pruebas

- Cada marco, visto por Daniel en la tienda local (Vite 5173 y la API local) y con capturas sobre una foto de prueba, en tema claro y oscuro. Los SVG, en Chrome sin ventana en varios momentos del ciclo.
- Los WebP, decodificados con ffmpeg 9: los píxeles visibles de cada cuadro coinciden con los PNG de origen (sin rastro). El bucle de Nevada se midió (PSNR del último cuadro al primero igual al de dos cuadros seguidos).
- `138` y su inversa en la base local, dentro de una transacción con `rollback` (las 4 filas locales tenían compras de Daniel): inserta los 4 como VIP a 450 (orden 4050 a 4080), bloquea una segunda inserción, y la inversa los borra. La `138` entera, sobre la base local, falla con "ya se aplicó". Las filas locales se actualizaron a los mismos valores.
- No se probó comprar cada marco con una cuenta VIP. No se probó en Safari ni en Firefox.

## Despliegue

**Sin desplegar.** Va en este orden:

1. La web (`web/frontend`), desde una copia limpia del commit: los archivos tienen que estar antes que los artículos.
2. `138_tienda_marcos_vip.sql` en la base de producción.
3. Publicar `CHANGELOG_DISCORD.txt` (CMLeague 2.9.66).

No toca los servidores de juego (#1, #2, #3): no hay nada que subir por SFTP.

## Cómo revertir

1. Base: `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/138_tienda_marcos_vip.sql`. **Borra las compras de estos marcos**, sin devolver las monedas VIP.
2. Web: volver a la versión anterior (queda en el VPS).

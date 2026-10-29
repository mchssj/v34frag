# Fondo de miniperfil: guía de implementación

## Estado

Implementado y probado el 2026-10-29 en los demos del frontend nuevo, en `/demo/tienda` y `/demo/matchmaking`. Pasaron `tsc`, `eslint` y los 42 tests del matchmaking.

Falta:
- **Migración:** no se corrió en ningún Postgres. Docker estaba apagado y no se pudo probar en la base local.
- **API:** ninguna ruta la usa todavía.

## Archivos

| Repo / rama | Archivo | Cambio |
|---|---|---|
| `kyan/pruebas` | `supabase/migrations/20261029200000_fondo_miniperfil.sql` | Tipo `background`, columna, funciones, vista y carga de los 24 fondos |
| `kyan/pruebas` | `assets/perfil/fondos/*.svg` | Los 24 fondos |
| `kyan/pruebas` | `assets/perfil/catalogo.json` | Versión 7, con los fondos |
| `kyan/pruebas` | `docs/bitacora/2026-10-29-tienda-web/pruebas/generar_catalogo_sql.py` | Saltea los fondos, que van en su propia migración |
| `kyan/pruebas` | `pruebas/generar_fondos.py` | Genera los SVG, el catálogo y la carga de la migración |
| `kyan/ejemplo-matchmaking` | `web/frontend/public/cosmetics/fondos/`, `catalogo.json` | Copia de los assets |
| `kyan/ejemplo-matchmaking` | `src/features/shop/*` | Tipo `background`, `MiniCard`, `CardBackground`, pestaña Fondos y miniperfil en la tienda y en Mi perfil |
| `kyan/ejemplo-matchmaking` | `src/features/matchmaking/{types.ts,GroupSlots.tsx,room/RoomOverview.tsx,demo.ts}` | `MmCosmetics` y su dibujo en el lobby y en la sala; el demo con cosméticos cargados |

## Cambios respecto del plan

- **Más cosméticos en el matchmaking:** a pedido de Kyan, además del fondo, el lobby y la sala muestran el **marco**, el **efecto de nombre** y la **insignia VIP**. Se sumaron en `MmCosmetics`.
- **Vista previa en la tienda:** la tarjeta de cada fondo es la `MiniCard` a ancho completo, con un avatar de 72 px. Así se ve el fondo y no queda tapado por el marco.
- **"Del otro lado":** se aclaró porque era casi negro.

## Pasos para desplegarlo

1. Correr `20261029200000_fondo_miniperfil.sql` en el SQL Editor, después de `20261029180000_tienda.sql`. Es re-ejecutable.
2. Publicar `assets/perfil/fondos/` y `catalogo.json` junto con la web.
3. En el backend:
   - devolver `background` en lo que lea `player_cosmetics_public`;
   - armar `background_url`, `frame_url`, `name_class` y `vip` en el estado del matchmaking, el que hoy arma `MmMe`, `MmPartyMember` y `MmPlayer`.

No toca el plugin, así que no hay nada que subir a nuestro servidor ni a RBK.

## Si se regenera

- **Orden:** correr primero `generar_fondos.py` y después `2026-10-29-vip-progresion/pruebas/generar_vip.py`. `generar_fondos.py` reescribe los fondos del catálogo sin `vip_price`, y `generar_vip.py` se lo vuelve a poner.
- **Frontend nuevo:** después de regenerar, copiar `assets/perfil/fondos/` y `catalogo.json` a `web/frontend/public/cosmetics/`.

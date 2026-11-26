# El nick de la web en producción: guía de implementación

## Estado

La `134` está **aplicada en producción desde el 2026-11-25 (16:15:34 UTC)**, a pedido de Daniel. Falta desplegar la web (legales) y la API (manual).

## Despliegue

1. Reporter 2.10.3 y `csstv_qol` 1.6.0 en #1, #2 y #3 ([`2026-11-25-nombre-web-en-vivo`](../2026-11-25-nombre-web-en-vivo/)). Al aplicar la `134`, el **#1** ya los tenía cargados; el **#2** y el **#3** los cargan en su próximo cambio de mapa. Hasta entonces, si en esos dos entra alguien con la partida en vivo y otro nombre, los plugins viejos se pelean por el nombre.
2. La `134`, más `notify pgrst, 'reload schema'`:

   ```bash
   (echo "set lock_timeout = '5s';"; cat supabase/replanteo/134_nick_de_la_web.sql; echo "notify pgrst, 'reload schema';") | ssh ubuntu@<VPS> "sudo docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 -q"
   ```

3. **Falta:** la web (`/terminos`, `/privacidad`), la API (manual) y los `.html` de `terms/`.

## Pruebas

En el servidor local, contra la base local: 2026-11-22 (`pruebas/prueba_local.sh`) y 2026-11-25 (10 nicks reales). En producción, pendiente de Daniel con su cliente.

## En qué se apartó del plan

El plan decía que bastaba con aplicar la función. El 2026-11-25 se vio que chocaba con `csstv_qol` en vivo y primero se cambiaron los dos plugins.

## Cómo revertir

La inversa de la `134` (cada uno queda con su nombre al volver a entrar). Más rápido en un servidor: `csstv_web_names 0`.

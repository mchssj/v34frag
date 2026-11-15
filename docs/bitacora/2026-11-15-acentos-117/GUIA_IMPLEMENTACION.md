# Los acentos rotos de la 117 en producción: guía de implementación

## Estado

**Aplicado en producción el 2026-11-15 a las 06:01 UTC** (Daniel, con Claude). Hecho en la rama `feat/rol-soporte` (worktree `v34frag-soporte`) sobre `806ba5ec`. Commiteado en `main`.

Probado el 2026-11-15:

- **Local:** `pruebas/probar_122.sh`. Rompe las siete funciones y los dos comentarios como quedaron en producción, aplica la `122` y comprueba que quedan idénticos a los de antes, con los permisos igual. 5 de 5, con rollback. En una base sana, la `122` no cambia nada ("funciones arregladas: ninguna").
- **Producción, con rollback:** 5 de 5.

## Cambios respecto del plan

- **Comentarios:** el plan nombraba dos (`support_actions` y `match_clips.video_reprocessed_by`). La comprobación final de la migración encontró un tercero, el de la función `support_actions_list`, con "›" roto ("â€º"): la búsqueda del plan solo miraba secuencias que empiezan con "Ã" o "Â". La `122` ahora recorre todos los comentarios rotos de `public` en lugar de una lista fija.

## Despliegue (hecho el 2026-11-15)

No toca los servidores de juego, la API ni la web.

1. **Prueba en producción**, por el túnel y en una transacción que se deshizo: 5 de 5. El primer intento falló en la comprobación final (el comentario de `support_actions_list`, ver arriba) y se deshizo solo.
2. **Base:** la `122` a las 06:01 UTC, con `PGCLIENTENCODING=UTF8` y sin `\r`:

   ```bash
   tr -d '\r' < supabase/replanteo/122_acentos_117.sql > /tmp/a122.sql
   PGCLIENTENCODING=UTF8 psql "host=$PG_HOST port=$PG_PORT user=$PG_USER dbname=$PG_DATABASE" -v ON_ERROR_STOP=1 -f /tmp/a122.sql
   ```

   Arregló las siete funciones y tres comentarios.
3. **Comprobado:** ninguna función ni comentario de la base tiene secuencias rotas.

## Para no repetirlo

Aplicar las migraciones desde Git Bash con `PGCLIENTENCODING=UTF8` y quitando los `\r` (`tr -d '\r'`), como en la `121` y la `122`. Con `core.autocrlf`, Git deja los `.sql` con CRLF.

## Ramas

Solo `main`. `mm_admin_lists` es del matchmaking, pero `feat/frontend-fase-1` y `feat/mm-claim-en-sala` siguen en la `105` y no tienen la `117`: allí no hay nada que arreglar.

## Vuelta atrás

No tiene (ver la inversa). Si hiciera falta deshacer algo de esas funciones, se vuelve a la definición de la migración que las creó.

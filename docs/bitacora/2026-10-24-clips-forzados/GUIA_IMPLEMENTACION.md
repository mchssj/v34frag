# Forzar el video de una jugada: guía de implementación

## Estado

Implementado y probado en la Supabase local el 2026-10-24. Falta aplicar la migración en producción, bajar el código al portátil y forzar las jugadas de sunless.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261024180000_clips_forzados.sql` | Nueva: columnas, `match_clip_list` con las forzadas, `clip_force`, `clip_unforce` y `clip_discord_pending` con las forzadas |
| `supabase/replanteo/26_clips.sql` y `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/26_clips.sql` | La vista con las forzadas y `forced` |
| `render/discord.py` | "Elegida por los admins" en las forzadas |
| `web/backend/src/db/types.ts` | Regenerado: suma lo de Discord y lo de las forzadas |
| `docs/bitacora/2026-10-24-clips-forzados/` | Plan, documentación, esta guía y `pruebas/` |

## Despliegue

1. **Migración en producción (Daniel):** SQL Editor → `supabase/migrations/20261024180000_clips_forzados.sql` → Run.
2. **Portátil:** desactivar la tarea (`Disable-ScheduledTask "CMLeague clips"`, como administrador), `git pull` y volver a activarla.
3. **Las jugadas de sunless en season** (`srv1-20261024T030601-b05b`):

   ```sql
   select clip_force('d7376a05-e8a7-41ee-b541-adff5d594eaa');  -- ronda 5: 1v2 ganado (2 kills + defuse)
   select clip_force('13af1fb4-9914-41a3-aac9-845ab47a9237');  -- ronda 1: 3k de pistola
   ```

   La segunda solo si también se quiere el 3k de pistola. Las dos quedan en los puestos 6 y 7 de la partida. La próxima corrida las graba y las publica.

## Pruebas

En la Supabase local:
- **Con el esquema de producción** (`REPLANTEO=0 pnpm db:reset`):
  - [`pruebas/pruebas_db.sql`](pruebas/pruebas_db.sql): **24 OK**. Cubren:
    - antes de forzar, la lista muestra solo el top y la cola está vacía;
    - forzar: queda en cola, con fecha y sin autor desde el SQL Editor;
    - la lista la muestra en el puesto 6 con `forced`, sin cambiar el top;
    - la cola toma solo la forzada, se graba y sale en Discord con `forced`;
    - forzar una `failed`: vuelve a la cola con los intentos en 0;
    - dos forzadas: en el orden de la escala, y Discord espera mientras una está en cola;
    - forzar una del top: no se duplica;
    - desforzar, y una jugada que no existe;
    - permisos: `anon` y un usuario común no fuerzan; `anon` ve la marca.
  - Las de Discord (20), video (62) y clips (40) siguen pasando.
- **Con el replanteo completo** (`pnpm db:reset`): las mismas, más las 9 de la `26`.
  - Una segunda aplicación de la `26` aborta.
  - La inversa deja la vista igual a la de la migración.
  - Se vuelve a aplicar con la misma estructura.
- **Backend:** typecheck, 291 unitarias y 104 de integración OK.
- **Discord** (`probar_discord.py`): OK.

## En qué se apartó del plan

- **Se puede forzar una jugada que ya está en el top:** solo suma la marca y no se duplica.
- **Las pruebas de Discord** (`2026-10-24-clips-discord/pruebas/pruebas_db.sql`) usaban `winner_side`, que solo existe con el replanteo. Se quitó, para que corran también con el esquema de producción.

## Cómo revertir

```sql
-- Volver a definir match_clip_list y clip_discord_pending como en 20261024120000_clips_discord.sql
-- (y la vista como en 20261023180000_clips_video.sql); después:
drop function clip_force(uuid), clip_unforce(uuid);
alter table match_clips drop column video_forced, drop column video_forced_at, drop column video_forced_by;
```

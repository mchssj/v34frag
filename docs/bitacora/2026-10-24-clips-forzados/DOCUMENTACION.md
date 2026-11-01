# Forzar el video de una jugada: documentación

## Qué hace

El bot graba y publica solo las mejores jugadas de cada partida: las que entran en los topes de `clip_config` (5 por partida y 2 por jugador). Con esto, un admin puede pedir el video de cualquier otra jugada registrada.

La jugada queda marcada como forzada y entra en la cola del bot como las del top. El bot la graba, la sube a R2 y a Drive, y la publica en Discord con "Elegida por los admins" en lugar de su puesto. En la lista de clips de la web nueva aparece después de las del top.

```mermaid
flowchart LR
    A[Admin: clip_force] --> B[video_forced = true]
    B --> C[match_clip_list: después del top]
    C --> D[clip_render_claim: entra en la cola]
    D --> E[Video en R2 y Drive]
    E --> F[clip_discord_pending: "Elegida por los admins"]
```

## Reglas

| Regla | Detalle |
|---|---|
| Qué se puede forzar | Cualquier jugada guardada por el plugin (3+ kills o un clutch ganado), aunque esté fuera de los topes |
| Si había fallado | `clip_force` la devuelve a la cola con los intentos en 0 (una `failed` o `skipped`) |
| Si ya está en el top | Queda igual: ya se graba. Solo suma la marca |
| Dónde se ve | En `match_clip_list`, después del top, con puesto a continuación (6, 7…) y `forced = true`. Varias forzadas de una partida van en el orden de la escala |
| Discord | Sale cuando la partida no tiene, entre el top y las forzadas, nada en cola o grabándose. El mensaje dice "Elegida por los admins" |
| Demo vencida | Si la demo ya no está en R2 (90 días), la jugada queda `skipped` |
| Desforzar | `clip_unforce`: deja de verse si no entra en el top. Un video ya grabado no se borra |

## Base de datos

Migración `supabase/migrations/20261024180000_clips_forzados.sql`.

| Objeto | Qué es |
|---|---|
| `match_clips.video_forced`, `video_forced_at`, `video_forced_by` | La marca, cuándo y quién (`null` desde el SQL Editor) |
| `clip_force(p_clip)` | Marca la jugada (solo admin o el SQL Editor). Devuelve el estado en que quedó |
| `clip_unforce(p_clip)` | Saca la marca |
| `match_clip_list` | El top y, después, las forzadas. Columna nueva al final: `forced` |
| `clip_discord_pending` | Suma las forzadas y devuelve `forced` |

`clip_render_claim` no cambió: toma lo que muestra la vista. El replanteo `26` y su inversa tienen la misma vista, con la ficha por `steam_owner()`.

## Cómo pedir una jugada (hasta que haya un botón en el admin)

En el SQL Editor:

```sql
-- 1. Buscarla: las jugadas de un jugador en las últimas partidas de un mapa
select c.id, m.played_at, c.round, c.player_name, cardinality(c.kill_ticks) as kills, c.clutch_vs, c.round_won,
       c.video_status, c.video_forced
  from match_clips c join matches m on m.id = c.match_id
 where m.map = 'season' and c.player_name ilike '%sunless%'
 order by m.played_at desc, c.round;

-- 2. Forzarla
select clip_force('<id>');
```

La próxima corrida del bot (cada 10 minutos) la graba y la publica.

## Dónde está cada cosa

| Qué | Archivo |
|---|---|
| Migración | `supabase/migrations/20261024180000_clips_forzados.sql` |
| Vista con el replanteo | `supabase/replanteo/26_clips.sql` y su inversa |
| Mensaje de Discord | `render/discord.py` (`clip_message`) |
| Pruebas | [`pruebas/pruebas_db.sql`](pruebas/pruebas_db.sql) |

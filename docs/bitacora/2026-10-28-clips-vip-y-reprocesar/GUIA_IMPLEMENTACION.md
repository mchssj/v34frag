# Clips extra para los VIP y reprocesar un clip: guía de implementación

## Estado

Implementado y probado en la Supabase local el 2026-10-28, sin commit, en `feat/backend-api-fase-1`. Falta:
- Aplicar la migración en producción.
- Bajar `render/procesar.py` al portátil.
- La web nueva: Administración › Clips y la marca VIP en la sala.

## Archivos

Todos en el worktree del backend (`v34frag-backend`), salvo esta bitácora.

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261028180000_clips_vip_reprocesar.sql` | Nueva: `vip_per_match`, `vip_at`, `match_clip_list` con VIP y `review`, `clip_reprocess`, `clip_review_ok`, `match_clips_video_guard`, `clip_render_claim` y `clip_discord_pending`; `clip_set_config` con 7 parámetros |
| `supabase/replanteo/26_clips.sql` y su inversa | La vista con `steam_owner()` y la regla VIP; la inversa deja la de la migración |
| `supabase/replanteo/28_notificaciones.sql` | `clip_ready` de un reprocesado al aprobarlo |
| `web/backend/src/routes/clips.ts`, `src/schemas/clips.ts` | `vip`, `review`, `vip_per_match` y los endpoints de reprocesar, aprobar y la cola |
| `web/backend/src/db/types.ts` | Regenerado |
| `web/backend/test/unit/clips-routes.test.ts`, `test/integration/clips-vip.test.ts` | Pruebas |
| `render/procesar.py` | " (reproceso N)" en el nombre de Drive |
| `docs/frontend/contrato/` | `partidas.md`, `admin.md`, `README.md` y `decisiones.md` |
| `docs/bitacora/2026-10-28-clips-vip-y-reprocesar/` | Plan, documentación, esta guía, changelog y `pruebas/` |

## Despliegue

1. **Comprobar los topes** en producción (SQL Editor): `select per_match, per_player from clip_config;`. Si `per_match` no es 5, ajustarlo con `update clip_config set per_match = 5 where id = 1;`.
2. **Migración (Daniel):** SQL Editor → `supabase/migrations/20261028180000_clips_vip_reprocesar.sql` → Run. Comprobar: `select vip_per_match from clip_config;` da 3.
3. **Portátil**, para el nombre " (reproceso N)" en Drive (sin esto todo funciona igual, con el nombre de siempre):
   - Desactivar la tarea: `Disable-ScheduledTask "CMLeague clips"`, como administrador.
   - `git pull`.
   - Volver a activarla.

   Es lo mismo que en [`2026-10-24-clips-forzados`](../2026-10-24-clips-forzados/GUIA_IMPLEMENTACION.md).
4. **API:** sale con la web nueva. La web vieja no se toca.
5. **Changelog** para Discord: [`CHANGELOG_DISCORD.txt`](CHANGELOG_DISCORD.txt).

## Reprocesar desde el SQL Editor (hasta la web nueva)

```sql
-- 1. Encontrar el clip: los de un mix (por el código del mix o por el jugador).
select l.id, l.position, l.type, l.round, l.player_name, l.vip, l.video_status, l.review, m.external_id, m.played_at
  from match_clip_list l join matches m on m.id = l.match_id
 where m.external_id = '<código del mix>'          -- o: l.player_name ilike '%nick%'
 order by m.played_at desc, l.position;

-- 2. Mandarlo a grabar de nuevo.
select clip_reprocess('<id>');

-- 3. Ver la cola: cuando video_status = 'done', el video nuevo está en Drive (" (reproceso N)").
select l.id, l.type, l.player_name, l.video_status, c.video_reprocess_count, m.map, m.played_at
  from match_clips c join match_clip_list l on l.id = c.id join matches m on m.id = c.match_id
 where c.video_review = 'pending' order by c.video_reprocessed_at;

-- 4a. Quedó bien: sale en Discord en la próxima corrida del bot.
select clip_review_ok('<id>');
-- 4b. Quedó mal: otra vez el paso 2.
```

## Pruebas

En la Supabase local:

- **Esquema de producción** (`REPLANTEO=0`):
  - [`pruebas/clips_vip_produccion.sql`](pruebas/clips_vip_produccion.sql): 38 OK, también después de correr la migración dos veces. Cubren:
    - `vip_at`;
    - el top sin los VIP y los VIP después;
    - el tope de 3, el VIP de después del mix, el revocado después del mix, las forzadas al final y `vip_per_match = 0`;
    - `clip_set_config`;
    - reprocesar y aprobar con todos sus rechazos;
    - la papelera;
    - Discord sin el reprocesado y con los VIP;
    - el claim con `review` y `reprocess`;
    - el reenvío con otros ticks.
  - Las pruebas de los clips anteriores (automáticos, render, Discord y forzados) siguen pasando.
- **Con el replanteo:**
  - [`pruebas/clips_vip_replanteo.sql`](pruebas/clips_vip_replanteo.sql): 5 OK. El SteamID adicional de un VIP cuenta, y el aviso `clip_ready` llega al aprobar.
  - La `26` y la `28` con `correr.sh`: su prueba, que no se apliquen dos veces y la inversa con la estructura idéntica.
- **API:** 358 unitarias y 154 de integración en verde. Las nuevas son 6 unitarias en `clips-routes.test.ts` y 4 de integración en `clips-vip.test.ts`.
- **Bot:** sin probar de punta a punta: hace falta el portátil. El cambio es solo el nombre del archivo en Drive.

## En qué se apartó del plan

- **Sin replanteo `33`:**
  - La `26` vuelve a definir `match_clip_list` con `create or replace` y las columnas viejas, así que en el corte habría fallado (Postgres no saca columnas de una vista).
  - Se editaron la `26` y su inversa, como cuando se agregó el video de los clips.
  - El aviso `clip_ready` se cambió directamente en la `28`.
  - El número `33` lo usa Equipo y Torneos.
- **`clip_render_claim`** manda también `vip` en cada jugada, para que el bot pueda marcarlas si hace falta.
- **`clip_discord_pending`** suma `vip` en cada fila. `render/discord.py` todavía no lo usa: los clips VIP salen como los del top.

## Cómo revertir

- **Producción:**
  - Volver a correr `20261024180000_clips_forzados.sql` restaura la vista, `clip_discord_pending` y el guardián. `match_clip_list` tiene que borrarse antes (`drop view match_clip_list;`), porque esa versión tiene menos columnas.
  - Restaurar `clip_render_claim` corriendo `20261023180000_clips_video.sql`, o desde su texto.
  - Borrar `vip_at`, `clip_reprocess` y `clip_review_ok`.
  - `clip_set_config`: `drop function clip_set_config(jsonb, integer, integer, integer, integer, integer, integer);` y volver a crear la de 6 parámetros desde `20261023120000_clips.sql`.
  - Las columnas nuevas pueden quedar.
- **Portátil:** `git checkout` de la versión anterior de `render/procesar.py`.

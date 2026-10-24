# Clips en Discord: guía de implementación

## Estado

Implementado y probado en local el 2026-10-24. La migración ya está en producción (la aplicó Daniel). Un mensaje de prueba se publicó en el canal (privado, solo admins y mods) y Daniel lo aprobó. Falta que el portátil baje el código y lo active (pasos de abajo).

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261024120000_clips_discord.sql` | Nueva: columnas y `clip_discord_pending` / `clip_discord_mark` |
| `render/discord.py` | Nuevo: el webhook y el mensaje |
| `render/procesar.py` | `publish_discord()` al final de cada corrida; `DISCORD_*` en las variables |
| `render/render_clip.py` | `light_version()` |
| `render/drive.py` | `download()` |
| `render/config.example.json` | `"discord": true`, `"discord_top": 5` |
| `render/CONFIGURAR_PORTATIL.md` | `DISCORD_CLIPS_WEBHOOK` en el `.env` y las claves nuevas de `config.json` |
| `docs/bitacora/2026-10-24-clips-discord/` | Plan, esta guía, la documentación y `pruebas/` |

## Despliegue

1. **Base (hecho el 2026-10-24, Daniel):**
   - la migración en el SQL Editor;
   - antes, el tope por partida a 5: `select clip_set_config(priorities, per_player, 5, split_gap_seconds, pre_seconds, post_seconds) from clip_config where id = 1;`;
   - verificado: `clip_config` con `per_match` 5 y `clip_discord_pending` con las 5 del inferno.
2. **Push** de la rama `feat/backend-api-fase-1` desde la PC.
3. **Portátil:**
   1. `git pull`;
   2. en su `.env`, `DISCORD_CLIPS_WEBHOOK` (el mismo de la PC);
   3. en su `render/config.json`, `"discord": true` y `"discord_top": 5`;
   4. reactivar la tarea (`Enable-ScheduledTask "CMLeague clips"`, como administrador).
4. **La primera corrida** publica las 5 del inferno de las 00:30 del 2026-10-24 y las de las partidas que ya estén completas.

## Pruebas

- **Base** ([`pruebas/pruebas_db.sql`](pruebas/pruebas_db.sql)): 20 OK. Cubren:
  - el token y el tope;
  - el top 5 con una que falló;
  - una partida con jugadas en cola o grabándose, que espera;
  - una en vivo, que no sale;
  - el orden, `p_limit`, la marca repetida, una jugada que no existe y los permisos de `anon`.
- **De punta a punta** ([`pruebas/probar_discord.py`](pruebas/probar_discord.py)): base local, R2 y Drive de verdad, y un webhook local que imita a Discord y responde una vez 429. Todo OK:
  - 3 mensajes en orden, con el texto, sin menciones, `?wait=true` y el `User-Agent`;
  - los adjuntos, de 2 MB;
  - la jugada que solo estaba en Drive también salió;
  - las 3 quedaron marcadas, sin repetidos en la segunda corrida;
  - publicada sin marca: se marca sin volver a publicar.
- **Versión liviana:** con un límite de 1,2 MB se recodifica a la tasa que entra (1,13 MB). Con 300 KB se rechaza.
- **Discord de verdad (2026-10-24):**
  - un mensaje de prueba en el canal con el 4k de Old x Gsyng (inferno, puesto 1): de 40,1 MB a 7,1 MB, mensaje `1563440921696272435`;
  - la jugada no se marcó en la base, así que sale de nuevo cuando el portátil lo active.

## En qué se apartó del plan

- **Un error de una jugada no frena a las demás.** Solo un error de Discord corta la publicación.
- **El título lleva color por tipo y el adjunto se llama con el tipo y la ronda** (`4k_10.mp4`).
- **Con el tope por partida en 5, el top 5 de Discord son todas las visibles.** `discord_top` queda para publicar menos si hace falta.

## Cómo revertir

1. `"discord": false` en `render/config.json` del portátil: deja de publicar en la próxima corrida.
2. **Base:**

   ```sql
   drop function clip_discord_pending(text, integer, integer), clip_discord_mark(text, uuid, text);
   alter table match_clips drop column discord_posted_at, drop column discord_message_id;
   ```

3. Los mensajes ya publicados quedan en el canal: se borran a mano.

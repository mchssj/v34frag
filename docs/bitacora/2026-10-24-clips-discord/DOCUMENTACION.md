# Clips en Discord: documentación

## Qué hace

Las 5 mejores jugadas de cada mix se publican solas en un canal de Discord, una por mensaje, con su video. Las publica la máquina de render (`render/procesar.py`) al final de cada corrida, después de grabar.

El video que se ve en el chat es una copia liviana (720p, menos de 10 MB) que se sube a Discord como archivo adjunto. Discord la guarda mientras exista el mensaje, así que no vence. El mensaje lleva además el link "Ver en 1080p" al video de Google Drive, que tampoco vence.

```mermaid
sequenceDiagram
    participant T as procesar.py
    participant B as Supabase
    participant R as R2 / Drive
    participant D as Discord

    T->>B: clip_discord_pending(token, 5)
    B-->>T: jugadas para publicar
    loop Cada jugada
        T->>R: el .mp4 (R2 los primeros 15 días; después, Drive)
        T->>T: versión de 720p (menos de 9,5 MB)
        T->>D: webhook ?wait=true, con el adjunto
        D-->>T: id del mensaje
        T->>T: discord_publicados.json
        T->>B: clip_discord_mark
    end
```

## Qué se publica

| Regla | Detalle |
|---|---|
| Qué jugadas | Las de puesto 1 a 5 (`discord_top`) de cada partida, con video listo (`done`) y sin publicar. Con el tope por partida en 5 (`clip_config`, desde el 2026-10-24), son todas las visibles |
| Cuándo | Cuando la partida ya no tiene, entre esas 5, jugadas en cola o grabándose: salen juntas. Las que fallaron o se saltaron no frenan a las demás |
| Orden | Partida más vieja primero y, dentro de cada una, del puesto 1 al 5 |
| Las ya grabadas | Entran solas: el estado sale de la base |

## El mensaje

- **Título:** el tipo y el jugador, por ejemplo `4K · Old x Gsyng` o `Clutch 1v3 · hyd @ PDF`. Color por tipo: ACE dorado, 4K naranja, 3K azul y clutch violeta.
- **Texto:** el mapa, la ronda, el resultado y la duración (por ejemplo `de_inferno_classic · ronda 10 · 16-9 · 14 s`), `#1 de la partida` y el link "Ver en 1080p" a Drive.
- **Adjunto:** `4k_10.mp4` (tipo y ronda). Discord lo reproduce en el chat.
- **Sin menciones** (`allowed_mentions` vacío): un nombre con `@` no le avisa a nadie.

## La versión liviana

`render_clip.light_version()` arma una copia de 720p (CRF 28, AAC de 96 kbps). Si igual pasa de 9,5 MB (por ejemplo, un clutch largo), se vuelve a codificar a la tasa de bits que entra. Si haría falta menos de 200 kbps, la jugada no se publica y queda anotado en el log. En la prueba, el 4k del inferno pasó de 40,1 MB a 7,1 MB.

## Estado y repeticiones

| Dónde | Qué |
|---|---|
| `match_clips.discord_posted_at`, `discord_message_id` | Publicada y con qué mensaje |
| `work_dir/discord_publicados.json` (portátil) | Id de la jugada → id del mensaje, anotado **antes** de marcar en la base. Si la marca falla, la próxima corrida la marca sin volver a publicarla |
| Errores | Si Discord falla (o sigue pidiendo esperar), se corta y se sigue en la próxima corrida. Si falla una sola jugada (no se pudo bajar o no entra), se anota y se sigue con la próxima |

## Base de datos

Migración `supabase/migrations/20261024120000_clips_discord.sql` (aplicada en producción el 2026-10-24).

| Objeto | Qué hace |
|---|---|
| `match_clips.discord_posted_at`, `discord_message_id` | Columnas nuevas |
| `clip_discord_pending(p_token, p_top, p_limit)` | Las jugadas para publicar (arreglo JSON), con la partida, el puesto, el tipo, la ronda, el jugador y dónde está el video |
| `clip_discord_mark(p_token, p_clip, p_message_id)` | Marca la jugada. `false` si ya estaba |

Las dos piden el token de render (`render_auth`). `match_clip_list` no cambió.

## Configuración

| Dónde | Qué |
|---|---|
| `.env` de la máquina de render | `DISCORD_CLIPS_WEBHOOK`: el webhook del canal. Es una credencial: quien la tiene puede publicar ahí |
| `render/config.json` | `"discord": true` y `"discord_top": 5` |

## Dónde está cada cosa

| Qué | Archivo |
|---|---|
| Migración | `supabase/migrations/20261024120000_clips_discord.sql` |
| Webhook y mensaje | `render/discord.py` (`python discord.py prueba <video>` publica un mensaje de prueba) |
| Paso de cada corrida | `render/procesar.py` (`publish_discord`) |
| Versión liviana | `render/render_clip.py` (`light_version`) |
| Bajar de Drive | `render/drive.py` (`download`) |
| Pruebas | [`pruebas/`](pruebas/) |

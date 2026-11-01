# Ajustes del render después de configurar el portátil: guía de implementación

## Estado

Aplicado en la PC el 2026-10-24 y probado sin el juego. Falta que el portátil lo baje y confirmarlo con el juego en las próximas corridas de la tarea.

## Qué se hizo, punto por punto del plan

| Punto del plan | Qué se hizo |
|---|---|
| User-Agent en la descarga de la demo | Ya estaba corregido en la PC, más amplio: `procesar.USER_AGENT` va en todos los pedidos (la base y la demo). La parte del parche para `procesar.py` no se aplicó: choca con ese cambio y hace lo mismo |
| Reintento del salto que se pasa de largo (`SEEK_TRIES = 3`) | El parche de `render_clip.py`, aplicado tal cual (`git apply --include=render/render_clip.py`) |
| 5.1 Tramo al principio de la demo | `demo_pause` justo después del `playdemo` en `cmleague_render.cfg`. Si el motor lo toma al terminar la carga, la demo queda en pausa en el tick 0. Si no, no hace nada. **Sin probar con el juego** |
| 5.2 `startmovie` sin cuadros | Si a los 20 s no apareció ningún cuadro, se vuelve a mandar el paso del `startmovie` una vez. **Sin probar con el juego** |
| 5.3 `endmovie` que no corta | Sin cambios: ya reintenta dos veces más y falla |
| 5.4 El juego no se cierra y la corrida se cae | Borrar la copia de la demo en el cliente ya no corta la corrida: se anota el aviso y sigue |
| 5.5 Velocidad | Solo para observar |
| 5.6 Tres intentos en una corrida | Ya estaba corregido en la PC: si una partida deja jugadas para reintentar, la corrida termina y sigue en la próxima |
| 7. Correcciones de `CONFIGURAR_PORTATIL.md` | Las cuatro: la búsqueda del arreglo del tick, `"drive": true` (también en `config.example.json`), el comando de la tarea en una línea con `-Python`, y borrar el video de prueba solo después de que lo vea Daniel |

Además, en la misma tanda:

- **El `|` delante de los comandos de la consola.** La tecla de la consola, en el teclado latinoamericano del portátil, a veces dejaba su carácter en la línea, y el juego recibía `|demo_pause; …`. Ahora se borra la línea con Backspace y el texto empieza con `;`. Sin probar con el juego.
- **Calidad en el portátil:** los videos del primer inferno pesaron unas 4 veces lo esperado (40 MB para 14 s). La guía pide revisar `"crf": 23` y `"preset": "veryfast"` en su `config.json`.

## Datos a reponer (Daniel, en el SQL Editor)

- **cbble:** ya está en cola. El 2026-10-24 Daniel corrió el `update` de las jugadas que fallaron al bajar la demo.
- **mirage:** sigue en `failed`. Correr el SQL de la sección 6 del plan **después** de que el portátil tenga estos arreglos:

  ```sql
  update match_clips set video_status = null, video_attempts = 0, video_error = null
   where video_status = 'failed' and match_id = '92d7a525-c4ba-4377-8f1f-14917989293f';  -- mirage_rc1
  ```

## Pruebas

Sin el juego:
- `probar_procesar.py` y `probar_discord.py`: todo OK;
- las pruebas de la base (62 y 20): OK;
- todo compila.

Los puntos 5.1, 5.2 y el `|` se confirman en `procesar.log` del portátil. Hay que buscar:
- que las jugadas de la ronda 1 salgan;
- "startmovie no grabó nada en 20 s; lo mando otra vez";
- que no haya más "pasó de largo".

## Cámara en el jugador equivocado (2026-10-24)

- **Qué pasó:** los dos clips de JESHO del inferno de las 02:14 (4k de la ronda 20 y 4k de la ronda 17) salieron desde el POV de otro jugador. Su nombre en el juego es `CANDY LOVE愛.`: el `愛` no llega bien a la consola, `spec_player "<nombre>"` no encuentra a nadie y la cámara se queda en el jugador anterior.
- **Probado con el juego en la PC de Daniel:**
  - `spec_player 3` (el índice de entidad) no sirve: en las demos, `spec_player` solo acepta el nombre exacto, y con un número la cámara queda fija sin seguir a nadie;
  - lo que funciona es `spec_player "<un jugador vivo con nombre escribible>"` seguido de `spec_next` hasta llegar a él. `spec_next` va al siguiente jugador vivo por número. Con eso, el 4k de JESHO salió en su primera persona (la pistola en las dos primeras kills y el AK en la última, igual que el feed).
- **Cambios:**
  - `leer_demo.py`: el índice de entidad de cada jugador por tick (`slot_at`, de la entrada de la tabla `userinfo` + 1) y los vivos en un tick (`alive_at`);
  - `render_clip.spec_target()`: el nombre si se puede escribir; si no, el ancla con menos pasos de `spec_next`. `render_clip.py --steamid` para probar a mano;
  - `procesar.build_job` pasa el SteamID. Las jugadas de jugadores con comillas o `;` en el nombre, que antes quedaban `skipped`, ahora se graban igual;
  - `discord_publicados.json` anota por jugada y por video: una jugada que se vuelve a grabar se publica de nuevo;
  - `discord.delete()` borra un mensaje del webhook (para los clips grabados con la cámara equivocada).


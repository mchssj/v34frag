---
titulo: La configuración obligatoria
resumen: Lo que tiene que ser igual en todos los servidores de CMLeague y lo que es propio de cada uno.
orden: 2
---

Todos los servidores de CMLeague se juegan igual: mismas reglas, mismos plugins, mismo formato. Así una partida vale lo mismo en cualquier servidor. Viene en el paquete que te mandamos; no la cambies por tu cuenta.

## Lo que es igual en todos

| Qué | Detalle |
|---|---|
| **Stripper:Source** | Con los filtros de CMLeague (sin niebla) y los de cada mapa |
| **Plugins y extensiones** | Los mismos en todos, incluidos el anti-wallhack de CMLeague y el de rendimiento (que sostiene `fps_max 600`) |
| **Las cfg de la partida** | Calentamiento, en vivo, fin, y las de cada tipo de partida (torneo, PCW, matchmaking y mix) |
| **El ciclo de mapas** | El mismo `mapcycle.txt` |
| **El plugin de CMLeague** | Formato MR15 con prórroga MR3 a 12000, medio tiempo de 3 segundos, pausas y `!gg` como en [Jugar en el servidor](/help/jugador/jugar-en-el-servidor) |
| **El `server.cfg`** | `sv_pure 1` con la misma lista de archivos permitidos (solo skins de armas en primera persona y sonidos de armas), `phys_timescale 1.7`, humo tipo 2 de ClientMod, `sv_minupdaterate` y `sv_mincmdrate` en 100, `sv_maxupdaterate` y `sv_maxcmdrate` en 101 |

## Lo propio de tu servidor

- El **token**, el **tag** y la licencia del plugin.
- Si graba demos o no (ver [Demos y clips de tu servidor](/help/servidor-externo/demos-y-clips)).
- El **nombre** del servidor y el título de la SourceTV.
- Las **contraseñas** y los **admins** de tu servidor.
- El aviso de `!calladmin`: el nombre y la dirección que se muestran en Discord.
- El **FastDL**.
- El puerto y la clave del **HUD para streamers**, si lo activamos.

## Cuando cambia algo

Si cambia la configuración común, la cambiamos en todos los servidores en la misma tanda, también en el tuyo. Si necesitas cambiar algo propio (un admin nuevo, otra contraseña), hazlo tranquilo; si dudas de si es propio o común, pregúntanos.

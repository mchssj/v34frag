---
titulo: Comandos del admin en el servidor
resumen: Lo que un admin suma sobre el moderador en el juego, y cómo revisar el estado de un servidor.
orden: 10
---

Un admin tiene todos los comandos del moderador (ver [Comandos del moderador en el servidor](/help/moderador/comandos-en-el-servidor)), sin sus límites, y además lo de esta página. Nadie puede usar un comando contra un admin.

## Lo que solo hace un admin

| Comando | Qué hace |
|---|---|
| `!cancelmatch` | Cancela el mix. Si se jugó al menos una ronda, queda guardado como cancelado, con su demo |
| `!map <mapa>` | Cambia el mapa también con un mix en curso |
| `!ban <jugador> 0 [motivo]` | Ban permanente |
| `!unban <SteamID>` | Levanta un baneo |
| `!addban <minutos> "<SteamID>" [motivo]` | Banea a alguien que no está en el servidor (en la consola, con el SteamID entre comillas) |
| `!banip <IP, rango o #userid> <minutos> [motivo]` | Banea una IP (`181.21.4.7`) o un rango (`181.21.0.0/16`, como mucho `/16`). `0` minutos es permanente. Con `#userid` (de `status`), la IP con la que está conectado |
| `!unbanip <IP o rango>` | Levanta un baneo por IP |
| `!vote`, `!votemap`, `!votekick` | Votaciones de admin |
| `!rcon <comando>` y `!cvar <nombre> <valor>` | Comandos y ajustes de la consola del servidor |
| `sm_ac_open <minutos>` | En la consola: deja jugar en ese servidor sin el anticheat por esos minutos (hasta 720), por ejemplo si se cayó. `sm_ac_open 0` lo vuelve a exigir. Los códigos `AC-3`, `AC-4` y `AC-5` sacan igual |

> **Ojo:** cambiar el mapa con un mix en curso lo corta, y un mix cortado no se recupera. Antes de usar `!map` o `!cancelmatch` en vivo, asegúrate de que es lo que quieres.

Todos los baneos, del juego o de la web, son uno solo: valen en los tres servidores y en el matchmaking, y quedan en Administración › [Baneos](/admin/bans) (ver [Banear a un jugador](/help/moderador/banear-jugador)).

- **Tu `!ban` también banea la IP** con la que está conectado el jugador, por el mismo tiempo. Si es una IP compartida, levántala o suma excepciones desde la web.
- **Un `!banip` no tiene ficha:** aparece en la pestaña **IPs sin ficha** de Baneos, donde le sumas excepciones o lo levantas. Al banear, echa a los que están conectados desde ahí. Los rangos alcanzan a todos los de ese proveedor: antes de banear uno, mira desde la web a quién más afecta.
- Un baneo nuevo de la web llega a los servidores en 5 minutos como mucho.

## Revisar el estado de un servidor

Se escriben en la consola del juego. La respuesta te llega solo a ti.

| Comando | Qué muestra |
|---|---|
| `sm_csstv_status` | El estado de la partida y los resultados que esperan para mandarse a la web |
| `sm_csstv_flush` | Reintenta ahora mandar los resultados pendientes |
| `sm_csstv_retryfailed` | Vuelve a mandar los resultados que la web rechazó |
| `sm_perf` | Cómo vienen los ticks del servidor en este momento (si se traba) |
| `csstv_hud_status` | Si el servidor le está mandando datos al HUD de los streamers |
| `sm_coach_status` | Los coaches anotados |

## Dar el permiso de moderador en los servidores

El rol de moderador de la web no da permisos en el juego. El permiso en los servidores se suma aparte, con el SteamID de la persona, y en todos los servidores a la vez: pídeselo a quien maneja los servidores. Empieza a valer en el próximo cambio de mapa.

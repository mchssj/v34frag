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
| `!vote`, `!votemap`, `!votekick` | Votaciones de admin |
| `!rcon <comando>` y `!cvar <nombre> <valor>` | Comandos y ajustes de la consola del servidor |

> **Ojo:** cambiar el mapa con un mix en curso lo corta, y un mix cortado no se recupera. Antes de usar `!map` o `!cancelmatch` en vivo, asegúrate de que es lo que quieres.

Los baneos también se manejan desde la web, con el historial de cada jugador (ver [Banear a un jugador](/help/moderador/banear-jugador)).

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

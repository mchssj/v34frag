---
titulo: Jugar en el servidor
resumen: Cómo arranca la partida, la ronda de cuchillo, las pausas, la rendición y los comandos del chat.
orden: 4
---

Todos los servidores de CMLeague se juegan igual. Los comandos se escriben en el chat del juego.

## Cómo arranca

1. Mientras entran todos, el servidor está en **calentamiento**.
2. Cuando estés listo, escribe `!ready` (`!unready` lo quita). La partida arranca cuando están todos listos.
3. Primero se juega una **ronda de cuchillo**. El equipo que gana tiene 60 segundos para elegir lado: `!stay` se queda donde está y `!switch` cambia.
4. Después, la partida en vivo.

En el matchmaking, la partida no arranca hasta que entraron todos los jugadores de la sala.

## El formato

- Al mejor de 30 rondas (gana el primero en llegar a 16).
- En el medio tiempo hay unos segundos de charla con los dos equipos juntos.
- Si terminan 15 a 15 hay **prórroga**: tandas de 6 rondas con 12000 de dinero, hasta que alguien gane.

## Pausas

| Comando | Qué hace |
|---|---|
| `!pause` | Pausa táctica para tu equipo: 2 por partida, de 60 segundos. Empieza en la ronda siguiente |
| `!tech` | Pausa técnica por un crash o un problema de conexión: una por equipo en cada mitad, de 2 minutos. No gasta las tácticas |
| `!unpause` | Termina la pausa antes, cuando los dos equipos lo escriben. También cancela la que pediste |

Si un jugador se desconecta, el servidor pausa solo hasta 2 minutos para esperarlo (una vez por partida).

## Rendirse

Si tu equipo va perdiendo por 8 rondas o más, pueden rendirse con `!gg`. Hacen falta los votos de todo el equipo menos uno.

En el matchmaking, si un compañero abandonó, rendirse con `!gg` les hace perder menos ELO (ver [Tu ELO, nivel y estadísticas](/help/jugador/elo-y-estadisticas)).

## Otros comandos

| Comando | Qué hace |
|---|---|
| `!claim <código>` | Vincula tu SteamID con tu cuenta (ver [Vincular tu SteamID](/help/jugador/vincular-steamid)) |
| `!hp` | Quién te mató en la ronda y cuánta vida le queda |
| `!sell` | Vende lo que compraste en la ronda, durante la compra. `!sell all` vende todo |
| `!as` | Elige si la M4A1 y la USP aparecen con silenciador |
| `!score` | El marcador |
| `!status` | Cómo está configurada la partida |
| `!rtv` y `!nominate <mapa>` | En el calentamiento, piden cambiar de mapa y votan uno. `!mapas` muestra la lista. No sirven en el matchmaking ni en los torneos: el mapa sale del veto |
| `!calladmin <motivo>` | Avisa a los moderadores en Discord. Sin motivo abre un menú |

> **Ojo:** usa `!calladmin` para trampas, insultos o un problema que necesita a alguien ya. Para pedir una revisión después de la partida, usa el botón **Reportar** de la sala (ver [Baneos y sanciones](/help/jugador/baneos-y-sanciones)).

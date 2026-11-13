---
titulo: Comandos del jugador en el servidor
resumen: Todos los comandos del chat del juego: listo, pausas, rendirse, !calladmin, !claim, !sell, !eq y los del calentamiento.
orden: 4
---

Se escriben en el chat del juego. Con `!` adelante (`!pause`) todos ven el comando; con `/` (`/pause`) no lo ve nadie. Cómo se juega una partida, paso a paso, está en [Jugar en el servidor](/help/jugador/jugar-en-el-servidor).

## Para arrancar

| Comando | Qué hace |
|---|---|
| `!ready` | Te marca listo. En los mixes y en el matchmaking ya entras listo solo; en torneos y PCW lo tienes que escribir. La partida arranca cuando están todos listos |
| `!unready` | Quita tu listo, si necesitas un momento antes de que arranque. No vuelves a quedar listo solo hasta que escribas `!ready` |
| `!faltan` | Quiénes faltan estar listos |
| `!stay` · `!switch` | Después de la ronda de cuchillo, el capitán del equipo que ganó se queda en su lado o cambia (ver [Comandos del capitán en el servidor](/help/capitan/comandos-en-el-servidor)) |

## En el calentamiento

Si mueres, reapareces enseguida con un arma gratis y chaleco con casco.

| Comando | Qué hace |
|---|---|
| `!armas` | Elige el arma con la que apareces. `!armas awp` la elige directo |
| `!nades` | Práctica de granadas: infinitas y con la trayectoria a la vista. Otra vez `!nades` la apaga |
| `!rethrow` | Con la práctica prendida, te vuelve al lugar y a la mira de la última granada que tiraste |
| `!rtv` · `!nominate <mapa>` | Piden cambiar de mapa y votan uno. `!mapas` muestra la lista y `!unrtv` quita tu pedido. No sirven en el matchmaking ni en los torneos: el mapa sale del veto |
| `!coach` | Te anota como coach de un equipo (ver [Comandos del capitán en el servidor](/help/capitan/comandos-en-el-servidor)) |

## Durante la partida

| Comando | Qué hace |
|---|---|
| `!pause` | Pausa táctica para tu equipo: 2 por partida, de 60 segundos. Empieza en la ronda siguiente |
| `!tech` | Pausa técnica por un crash o un problema de conexión: una por equipo en cada mitad, de 2 minutos. No gasta las tácticas |
| `!unpause` | Termina la pausa antes, cuando los dos equipos lo escriben. También cancela la que pediste |
| `!gg` | Vota para que tu equipo se rinda. Solo si van perdiendo por 8 rondas o más, y hacen falta los votos de todo el equipo menos uno. En los torneos no se puede |
| `!callreplace` | En el matchmaking, con un compañero desconectado: abre un voto en tu equipo para pedir un reemplazo sin esperar a que se termine su tiempo para volver (ver [Buscar partida](/help/jugador/buscar-partida)) |
| `!sell` | Vende lo que compraste en la ronda, durante la compra. `!sell all` vende todo |
| `!eq` | Qué tiene cada uno de tu equipo: armas, chaleco, kit, granadas y plata. También aparece solo unos segundos antes de que arranque cada ronda |
| `!hp` | Quién te mató en la ronda y cuánta vida le queda |
| `!voz` | Cuando quedas último vivo, dejas de escuchar a tus compañeros muertos hasta que termina la ronda. `!voz` lo apaga (o lo vuelve a prender) para ti |
| `!score` | El marcador |

Para pedirle un arma a un compañero no hay comando: se hace con la **R** y la **E** (ver [Jugar en el servidor](/help/jugador/jugar-en-el-servidor)).

## En cualquier momento

| Comando | Qué hace |
|---|---|
| `!calladmin <motivo>` | Avisa a los moderadores en Discord. Sin motivo abre un menú |
| `!admins` | Qué admins y moderadores están conectados |
| `!claim <código>` | Vincula tu SteamID con tu cuenta (ver [Vincular tu SteamID](/help/jugador/vincular-steamid)) |
| `!as` | Elige si la M4A1 y la USP aparecen con silenciador |
| `!status` | Cómo está configurada la partida |

> **Ojo:** usa `!calladmin` para trampas, insultos o un problema que necesita a alguien ya. Para pedir una revisión después de la partida, usa el botón **Reportar** de la sala (ver [Baneos y sanciones](/help/jugador/baneos-y-sanciones)).

Los comandos del deathmatch, el retake y el 2v2 están en [Deathmatch, retake y 2v2](/help/jugador/otros-modos).

---
titulo: Jugar en el servidor
resumen: Cómo arranca la partida, el calentamiento, las pausas, la rendición, pedir un arma y los comandos del chat.
orden: 4
---

Todos los servidores de CMLeague se juegan igual. Los comandos se escriben en el chat del juego.

## Cómo arranca

1. Mientras entran todos, el servidor está en **calentamiento**.
2. Cuando estés listo, escribe `!ready` (`!unready` lo quita). La partida arranca cuando están todos listos.
3. Primero se juega una **ronda de cuchillo**. El equipo que gana tiene 60 segundos para elegir lado: `!stay` se queda donde está y `!switch` cambia.
4. Después, la partida en vivo.

En el matchmaking, la partida no arranca hasta que entraron todos los jugadores de la sala.

## En el calentamiento

Si mueres, reapareces enseguida con un arma gratis y chaleco con casco.

| Comando | Qué hace |
|---|---|
| `!faltan` | Quiénes faltan escribir `!ready` |
| `!armas` | Elige el arma con la que apareces. `!armas awp` la elige directo |
| `!nades` | Práctica de granadas: infinitas y con la trayectoria a la vista. Otra vez `!nades` la apaga |
| `!rethrow` | Con la práctica prendida, te vuelve al lugar y a la mira de la última granada que tiraste |
| `!rtv` y `!nominate <mapa>` | Piden cambiar de mapa y votan uno. `!mapas` muestra la lista y `!unrtv` quita tu pedido. No sirven en el matchmaking ni en los torneos: el mapa sale del veto |
| `!coach` | Te anota como coach de un equipo (ver [Comandos del capitán en el servidor](/help/capitan/comandos-en-el-servidor)) |

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
| `!callreplace` | En el matchmaking, con un compañero desconectado: abre un voto en tu equipo para pedir un reemplazo sin esperar a que se termine su tiempo para volver (ver [Buscar partida](/help/jugador/buscar-partida)) |
| `!claim <código>` | Vincula tu SteamID con tu cuenta (ver [Vincular tu SteamID](/help/jugador/vincular-steamid)) |
| `!hp` | Quién te mató en la ronda y cuánta vida le queda |
| `!eq` | Qué tiene cada uno de tu equipo: armas, chaleco, kit, granadas y plata. También aparece solo unos segundos antes de que arranque cada ronda |
| `!sell` | Vende lo que compraste en la ronda, durante la compra. `!sell all` vende todo |
| `!as` | Elige si la M4A1 y la USP aparecen con silenciador |
| `!voz` | Cuando quedas último vivo, dejas de escuchar a tus compañeros muertos hasta que termina la ronda. `!voz` lo apaga (o lo vuelve a prender) para ti |
| `!score` | El marcador |
| `!status` | Cómo está configurada la partida |
| `!admins` | Qué admins y moderadores están conectados |
| `!calladmin <motivo>` | Avisa a los moderadores en Discord. Sin motivo abre un menú |

> **Ojo:** usa `!calladmin` para trampas, insultos o un problema que necesita a alguien ya. Para pedir una revisión después de la partida, usa el botón **Reportar** de la sala (ver [Baneos y sanciones](/help/jugador/baneos-y-sanciones)).

## Pedir un arma

Si no te alcanza la plata, un compañero te puede comprar el arma:

1. Al empezar la ronda, mientras están todos quietos, aprieta **R** (recargar) y elige el arma en el menú.
2. Tu equipo ve el pedido. El primero que aprieta **E** (usar) en la zona de compra te la compra, con su plata.

## Si estás de espectador

Durante la partida, los espectadores no escriben en el chat general y los jugadores no los escuchan. Nadie se puede cambiar el nombre hasta que termina.

Los modos aparte (deathmatch, retake y 2v2) están en [Deathmatch, retake y 2v2](/help/jugador/otros-modos).

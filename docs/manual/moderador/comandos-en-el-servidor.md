---
titulo: Comandos del moderador en el servidor
resumen: Kick, ban por tiempo, mute, mensajes, empezar un mix, pausas, contraseña y qué queda para un admin.
orden: 5
---

> **Ojo:** el permiso de moderador en los servidores es aparte del rol de la web. Si escribes `!admin` y no te abre el menú, pídele a un admin que te sume en los servidores.

## Cómo se escriben

- En el chat, con `!` adelante (`!kick`), todos ven el comando. Con `/` (`/kick`) no lo ve nadie. En la consola se usa `sm_` (`sm_kick`).
- A un jugador lo nombras con parte de su nombre (`!kick juan`) o con su número (`!kick #12`), que sale en `!who`. Si el nombre coincide con varios, usa el número.
- Lo más fácil: `!admin` abre un menú con casi todo lo de esta página.
- Los comandos no funcionan contra un admin.

## Básicos

| Comando | Qué hace |
|---|---|
| `!admin` | Menú de moderación: jugadores, castigos y chat |
| `!who` | Los jugadores con su número y si tienen permisos |
| `!whois <nombre o SteamID>` | Los nombres que usó en las partidas y su perfil en la web, aunque ya no esté conectado. Solo lo ves tú |

## Sacar y banear

| Comando | Qué hace |
|---|---|
| `!kick <jugador> [motivo]` | Lo saca del servidor. Puede volver a entrar |
| `!ban <jugador> <minutos> [motivo]` | Lo banea por un tiempo: `60` es una hora, `1440` un día y `10080` una semana |

El `!ban` del juego vale para todos los servidores y aparece en la lista de baneos de la web. No puedes banear para siempre (`0` minutos) ni desbanear. Para banear a alguien que ya no está en el servidor, o por más tiempo, usa la web (ver [Banear a un jugador](/help/moderador/banear-jugador)).

## Chat y voz

| Comando | Qué hace |
|---|---|
| `!mute <jugador>` · `!unmute` | Le quita (o le devuelve) la voz |
| `!gag <jugador>` · `!ungag` | Le quita (o le devuelve) el chat de texto |
| `!silence <jugador>` · `!unsilence` | Las dos cosas a la vez |
| `!say <mensaje>` | Mensaje a todos en el chat |
| `!csay <mensaje>` | Mensaje grande en el centro de la pantalla |
| `!psay <jugador> <mensaje>` | Mensaje privado a un jugador |

El mute, el gag y el silence duran hasta que el jugador se desconecta. A diferencia de los demás espectadores, tú puedes escribir en el chat general durante la partida.

## En la partida

| Comando | Qué hace |
|---|---|
| `!slay <jugador>` | Lo mata en la ronda (por ejemplo, si está trabado) |
| `!slap <jugador> [daño]` | Un empujón, con daño opcional |
| `!beacon <jugador>` | Le pone una baliza para encontrarlo |
| `!rename <jugador> <nombre>` | Le cambia el nombre (por ejemplo, uno ofensivo) |
| `!team <jugador> <ct, t o spec>` | Lo pasa a otro equipo. Si está vivo, muere y aparece en la ronda siguiente. Sirve con `@all`, `@ct`, `@t` y `@spec` |

## Mixes, pausas y mapa

| Comando | Qué hace |
|---|---|
| `!live` | Empieza el mix con los equipos como están, sin esperar los `!ready`. `!live knife` juega antes la ronda de cuchillo |
| `!swap` | En el calentamiento, pasa los CT a T y los T a CT |
| `!forcepause` · `!forceunpause` | Pausa la partida hasta que la sacas, o hasta que los dos equipos escriben `!unpause` |
| `!rr` | Repite la ronda en curso, sin esperar a los capitanes (ver [Comandos del capitán en el servidor](/help/capitan/comandos-en-el-servidor)) |
| `!match <código>` | Vincula la partida a un torneo o una PCW sin que confirme el otro equipo. No hace falta en los servidores que reservó la web |
| `!map <mapa>` | Cambia el mapa en 3 segundos, **solo sin mix en curso**. Sirve el nombre corto (`!map mirage`). `!map` solo abre la lista |

Con un mix en curso no puedes cambiar el mapa ni cancelar el mix: avísale a un admin.

## Contraseña del servidor

| Comando | Qué hace |
|---|---|
| `!pw <contraseña>` | Le pone contraseña al servidor. Solo tú la ves: los demás leen que le pusiste una. `!pw` solo dice si hay |
| `!npw` | Saca la contraseña |
| `!rpw` | Pone una al azar |

En los servidores del matchmaking la contraseña la maneja la web, y estos comandos no la cambian.

## Deathmatch, retake y 2v2

| Comando | Qué hace |
|---|---|
| `!retake 1` · `!retake 0` | Prende o apaga el retake |
| `!2v2 1` · `!2v2 0` | Prende o apaga el 2v2 |
| `!2v2_start` | Empieza el 2v2 sin esperar los `!ready` |
| `!2v2_cancel` | Cancela el 2v2 y vuelve al calentamiento |

El deathmatch se prende solo al poner su mapa con `!map`. Cómo se juega cada modo: [Deathmatch, retake y 2v2](/help/jugador/otros-modos).

## Cuando llega un `!calladmin`

El reporte llega al canal de reportes de Discord con una mención a los moderadores, y en el chat si estás en ese servidor. Dice quién reportó, a quién, el motivo, el servidor y, si hay mix, el código de la partida (sirve para buscar la demo).

Entra al servidor, mira qué pasa y usa los comandos de arriba. Si hace falta un ban permanente o cancelar el mix, avísale a un admin.

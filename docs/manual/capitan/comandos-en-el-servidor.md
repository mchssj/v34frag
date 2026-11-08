---
titulo: Comandos del capitán en el servidor
resumen: Elegir lado después del cuchillo, repetir una ronda, vincular la partida y el coach.
orden: 6
---

En el juego, el **capitán** de cada equipo es el jugador que le da nombre al equipo en el marcador. Si se va del servidor, lo que le toca al capitán lo puede hacer cualquiera de su equipo. Los comandos se escriben en el chat del juego.

## Elegir lado después del cuchillo

Si tu equipo gana la ronda de cuchillo, te aparece un menú para elegir lado. También puedes escribir:

| Comando | Qué hace |
|---|---|
| `!stay` | Se quedan en el lado donde están |
| `!switch` | Cambian de lado |

Tienes 60 segundos. Solo elige el capitán: si lo escribe otro, el servidor le dice quién tiene que elegir.

## Repetir una ronda

Si una ronda se arruinó por algo ajeno al juego (un crash, alguien que entró al equipo equivocado), los dos capitanes pueden repetirla:

1. Un capitán escribe `!rr`.
2. El capitán del otro equipo escribe `!rr` para aceptar.

La ronda vuelve a empezar como estaba: el marcador, las estadísticas, la plata y las armas de cada uno. Solo sirve con la partida en vivo. Un moderador o un admin la repite sin pedirle a nadie.

## Vincular la partida a la web

En los torneos, las PCW y el matchmaking, la web reserva el servidor y la partida queda vinculada sola: ahí `!match` no hace nada. Solo hace falta si juegan una partida de torneo o una PCW en un servidor que la web no reservó:

1. En el calentamiento, un jugador de tu equipo escribe `!match <código>`, con el código de la partida que muestra la web.
2. Uno del otro equipo escribe el mismo `!match <código>` para confirmar.

`!match` sin código la desvincula. Si se desvincula con la partida empezada, se guarda como un mix común.

## El coach

Cada equipo puede tener un coach. En el calentamiento, escribe `!coach` y elige el equipo, o directo `!coach ct` o `!coach t`. `!coach off` te saca.

- Quedas de espectador y solo ves a los jugadores vivos de tu equipo, en primera persona.
- Hablas y escribes (por el chat del equipo) solo con tu equipo.
- Ves la plata de cada uno de tu equipo al empezar la ronda, y puedes pedir `!pause` por tu equipo.
- Sigues a tu equipo cuando cambia de lado.

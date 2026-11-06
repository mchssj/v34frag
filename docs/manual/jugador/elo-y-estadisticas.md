---
titulo: Tu ELO, nivel y estadísticas
resumen: Cómo sube y baja tu ELO, qué nivel te corresponde, cómo funcionan las temporadas y dónde ves tus números.
orden: 5
---

El ELO mide tu nivel según los mixes que juegas. Todos empiezan con **1000**. Con él se arman las partidas del matchmaking y se ordena el ranking.

## Qué partidas cuentan

- **Cuentan** los mixes: los del matchmaking y los que se juegan en nuestros servidores.
- **No cuentan** las partidas de torneo ni las PCW. Esas suman a tus estadísticas, pero no a tu ELO.
- Algunos modos del matchmaking pueden no mover el ELO. La sala te lo muestra antes de jugar.

## Cuánto sube o baja

Antes de cada partida calculamos qué tan probable es que gane tu equipo, según el nivel de todos los jugadores.

- **Si tu equipo era favorito**, ganar te da poco y perder te quita más.
- **Si era el más débil**, ganar te da más y perder te quita poco.
- **Con equipos parejos**, ganas o pierdes más o menos lo mismo.
- **Tu rendimiento suma un poco:** si jugaste muy bien, ganas algo más o pierdes algo menos; si jugaste mal, al revés.
- Ganar siempre suma al menos 1 punto y perder siempre resta al menos 1.

En el matchmaking, la **Sala de la partida** te muestra cuánto te juegas: **En juego: +X / −Y**.

### Si no jugaste la partida completa

Cuenta la parte de la partida que jugaste:

- Si jugaste menos del {{elo.min_pct}} de las rondas, tu ELO no cambia.
- Si jugaste el {{elo.full_pct}} o más, cuenta completo.
- En el medio, el cambio es proporcional a las rondas que jugaste.

### Si alguien abandona en el matchmaking

- **Quien abandona** pierde como en una derrota completa, más un castigo extra, y se lleva una sanción (ver [Buscar partida en el matchmaking](/help/jugador/buscar-partida)).
- **Su equipo** pierde menos si pierde, y gana más si gana igual. Si se rinden con `!gg`, pierden menos de lo normal.
- **El equipo rival** gana menos, porque jugó con ventaja.
- Si abandonan 2 o más del mismo equipo, ese equipo pierde la partida.
- Irse en la última ronda no cuenta como abandono: el ELO de todos se calcula normal.

## Niveles

Tu nivel sale de tu ELO:

| Nivel | ELO |
|---|---|
| 1 | Hasta 500 |
| 2 | 501 a 750 |
| 3 | 751 a 900 |
| 4 | 901 a 1050 |
| 5 | 1051 a 1200 |
| 6 | 1201 a 1350 |
| 7 | 1351 a 1530 |
| 8 | 1531 a 1750 |
| 9 | 1751 a 2000 |
| 10 | 2001 o más |

Cuando cambias de nivel te avisamos en la campana.

## Temporadas

El ranking se divide en temporadas de alrededor de un mes. En [Ranking](/ranking) ves la temporada en curso, las anteriores y el **Histórico**.

- Para entrar en el ranking de la temporada tienes que jugar una cantidad mínima de mixes en ella. El ranking te muestra cuántos.
- Al cerrar, los mejores puestos reciben una **medalla** que queda en su perfil, en la pestaña **Temporadas**. Mientras la temporada sigue abierta, el ranking te muestra qué medalla te tocaría si cerrara hoy.
- Al empezar una temporada nueva, el ELO puede reiniciarse, del todo o en parte. Cuánto, lo define la administración en cada temporada.

## Dónde ves tus números

En tu perfil público (desde **Mi perfil** › **Ver perfil público**, o tocando tu alias en cualquier lado):

- **Resumen:** tu ELO, tu nivel y tus estadísticas (rating, K/D, HS %, ADR, porcentaje de victorias). En **Evolución de ELO**, pasa el mouse (o toca) sobre la línea para ver, en cada partida, el ELO con el que quedaste, cuánto ganaste o perdiste, la fecha y el mapa.
- **Partidas:** cada partida, con cuánto ELO te dio o te quitó.
- **Mapas:** cómo te va en cada mapa.
- **Temporadas:** tu puesto y tus medallas en cada temporada.

En [Ranking](/ranking) puedes filtrar por nivel y buscar a cualquier jugador. Con **Comparar** pones a dos jugadores lado a lado.

> **Ojo:** si un admin corrige tu ELO a mano (por ejemplo, después de un problema con una partida), te avisamos en la campana con el motivo.

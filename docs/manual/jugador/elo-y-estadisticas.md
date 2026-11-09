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

Lo que ganas o pierdes sale de **esa partida**: qué equipo era favorito y cómo jugaste tú. Tu nivel general (tu historial) sirve para armar partidas parejas, no para decidir cuánto te llevas.

**1. La base: quién era favorito.** Comparamos el ELO promedio de los dos equipos al empezar.

- **Con equipos parejos**, la base es de **20**: ganar suma 20 y perder resta 20.
- **Si tu equipo era favorito**, ganar te da menos y perder te quita más. Con 200 de ELO promedio a favor (un 76 % de ganar), la base es +10 si ganas y −30 si pierdes.
- **Si era el más débil**, al revés: ganar te da más y perder te quita menos.

**2. Tu rendimiento: el rating de esa partida** (el que ves en el detalle) multiplica la base:

| Rating | Si ganas | Si pierdes |
|---|---|---|
| 0,75 o menos | ×0,75 | ×1,25 |
| 1,00 | ×1,00 | ×1,00 |
| 1,50 o más | ×1,50 | ×0,50 |

Si ganas, cuanto mejor jugaste más sumas. Si pierdes jugando bien, pierdes menos; si pierdes jugando mal, pierdes más.

**3. Topes:**

- **Máximo 30 por equipo:** si a alguien le tocaría más de 30, a todo su equipo se le achica en la misma proporción, así las diferencias entre compañeros se mantienen.
- **Mínimo 10:** en una partida terminada, ganar suma **10 o más** y perder resta **10 o más**.
- Una partida que se cortó por una caída del servidor y que el staff da por buena no tiene ese mínimo (ganar suma al menos 1 y perder resta al menos 1). Un empate tampoco: suma o resta según quién era favorito.

**Ejemplo:** equipos parejos (todos con 1000). Gana tu equipo: el que jugó con rating 1,80 suma +30; el de 1,00, +20; el de 0,65, +15. Pierde el otro: el de 1,10 resta −18 y el de 0,20, −25.

En el matchmaking, la **Sala de la partida** te muestra cuánto te juegas con un rating de 1,00: **En juego: +X / −Y**. Después, tu rating de la partida lo sube o lo baja.

### Si no jugaste la partida completa

Cuenta la parte de la partida que jugaste:

- Si jugaste menos del {{elo.min_pct}} de las rondas, tu ELO no cambia.
- Si jugaste el {{elo.full_pct}} o más, cuenta completo.
- En el medio, el cambio es proporcional a las rondas que jugaste, también el mínimo de 10 (con la mitad de las rondas, al menos 5).

### Si alguien abandona en el matchmaking

- **Quien abandona** pierde ELO y se lleva una sanción de espera, que es el castigo fuerte (ver [Buscar partida en el matchmaking](/help/jugador/buscar-partida)). Cuánto ELO pierde depende de cuándo se fue: irse al principio cuesta más que irse cerca del final.
  - Si su equipo **gana**: pierde entre {{mm.abandono_ganado_min}} y {{mm.abandono_ganado_max}} de ELO, y nunca menos de 10.
  - Si su equipo **pierde** (o empatan): pierde entre {{mm.abandono_perdido_min}} y {{mm.abandono_perdido_max}}, pero **nunca menos que una derrota normal**. Irse no sale más barato que perder.
- **Su equipo** pierde menos si pierde, y gana más si gana igual. Si se rinden con `!gg`, pierden menos de lo normal, pero al menos 10.
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
- Al cerrar, los mejores puestos reciben una **medalla** que queda en su perfil, en las pestañas **Logros** y **Temporadas**. Mientras la temporada sigue abierta, el ranking te muestra qué medalla te tocaría si cerrara hoy.
- Al empezar una temporada nueva, el ELO puede reiniciarse, del todo o en parte. Cuánto, lo define la administración en cada temporada.

## Dónde ves tus números

En tu perfil público (desde **Mi perfil** › **Ver perfil público**, o tocando tu alias en cualquier lado):

- **Resumen:** tu ELO, tu nivel y tus estadísticas (rating, K/D, HS %, ADR, porcentaje de victorias). En **Evolución de ELO**, pasa el mouse (o toca) sobre la línea para ver, en cada partida, el ELO con el que quedaste, cuánto ganaste o perdiste, la fecha y el mapa.
- **Partidas:** cada partida, con cuánto ELO te dio o te quitó.
- **Mapas:** cómo te va en cada mapa.
- **Logros:** tus medallas y lo que te falta para las que todavía no tienes. Más en [Medallas y logros](/help/jugador/logros).
- **Temporadas:** tu puesto y tus medallas en cada temporada.

En [Ranking](/ranking) puedes filtrar por nivel y buscar a cualquier jugador. Con **Comparar** pones a dos jugadores lado a lado.

> **Ojo:** si un admin corrige tu ELO a mano (por ejemplo, después de un problema con una partida), te avisamos en la campana con el motivo.

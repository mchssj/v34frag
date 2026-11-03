---
titulo: El panel del HUD y el retraso
resumen: Elegir el servidor, enfocar a un jugador, cargar la serie y ajustar el retraso del HUD a tu transmisión.
orden: 2
---

El panel es el segundo link que te dio la web al generar tu HUD (ver [Poner el HUD en OBS](/help/streamer/hud-obs)). Ábrelo en una pestaña del navegador mientras transmites.

## Elegir el servidor

En **Servidor** están los servidores con el HUD activo:

- ● recibiendo datos · ○ sin datos.
- Debajo tienes el `connect` de la SourceTV del servidor, para mirar la partida desde el juego.
- Si otro streamer está transmitiendo el mismo servidor, el panel te lo dice.

Si no aparece ningún servidor, pídele a un admin que active el HUD del que quieres transmitir.

## Enfocar a un jugador

En **Jugador enfocado** eliges a quién muestra el HUD en grande. Con la pestaña del panel al frente también puedes usar el teclado:

- **1 a 5:** jugadores de CT.
- **6 a 9 y 0:** jugadores de T.
- **Esc:** sin jugador enfocado.

## Equipos y serie

- En **Equipos** pones el nombre de cada equipo. En el medio tiempo cambian de lado: toca **⇄ Intercambiar**.
- En **Serie** eliges el formato y los mapas, con quién pickeó cada uno. El HUD busca el mapa que corre en el servidor y muestra quién lo eligió. **Ganó** suma las rayitas sobre el nombre de cada equipo.
- En **Qué se muestra** prendes o apagas partes del HUD (marcador, jugadores…).

## El retraso

En **Retraso** eliges con cuánto atraso va el HUD. Se guarda para cada servidor.

| Opción | Cuándo usarla |
|---|---|
| **SourceTV** (el valor por defecto) | Transmites desde la SourceTV. El HUD va con el mismo retraso que ella |
| **En vivo** | Transmites desde un observador dentro del juego. El HUD muestra plata y vida en tiempo real |
| **Fijo**, de 1 a 300 segundos | Tu stream tiene una demora propia que quieres compensar |

> **Ojo:** con **En vivo**, el HUD va adelantado a la SourceTV. Úsalo solo si transmites desde adentro del juego: si no, muestras información antes de que pase en tu stream.

---
titulo: Clips, demos y lo más destacado
resumen: Qué jugadas se graban solas, cuándo está el video, dónde verlo, tus clips destacados y cómo bajar la demo de una partida.
orden: 6
---

Cada partida en nuestros servidores se graba en una demo. Con ella armamos solos los videos de las mejores jugadas.

## Qué jugadas se graban

El servidor anota en cada ronda las jugadas que valen la pena:

- **Ace** (5 kills en una ronda), **4k** y **3k**.
- **Clutches ganados**, del 1v1 al 1v5: quedaste último vivo de tu equipo y ganaste la ronda.

De cada partida se eligen las mejores, hasta {{clips.por_partida}} por partida y hasta {{clips.por_jugador}} por jugador, para que no sea siempre el mismo.

## Dónde las ves

- En la sala de la partida, en **Lo más destacado de la partida**, debajo del resultado.
- En el canal de clips del Discord de CMLeague.

Cuando el servidor detecta una o más jugadas tuyas en una partida, te llega **un solo aviso** en la campana con cuántas son (por ejemplo, "Tienes 3 jugadas destacadas en de_mirage_rc1"). Al tocarlo vas a las estadísticas de esa partida. Desde la jugada puedes copiar su link para compartirla.

El video de cada jugada tarda un rato más (ver abajo): no llega otro aviso cuando está listo. Solo si un admin aprueba un clip que se volvió a grabar, te avisamos de ese clip.

## Tus clips destacados

Tu ficha pública tiene una pestaña **Clips** con tus mejores jugadas: hasta {{clips.destacados}} (hasta {{clips.destacados_vip}} con VIP). Los eliges en **Mi perfil** › [Clips](/profile/clips):

- **Automático** (el de entrada): se muestran solos tus mejores clips con video. Van primero los más valiosos (ace, después los clutch más difíciles, 4k y 3k) y, entre dos iguales, el más nuevo.
- **Elijo yo:** marcas con la estrella los que quieras y los ordenas con las flechas. El primero va arriba, en grande. Toca **Guardar**.

Si en "Elijo yo" no marcas ninguno, tu ficha no muestra la pestaña Clips. Si dejas de ser VIP, no se borra nada: se ven los primeros {{clips.destacados}}.

## Cuánto tarda el video

Las jugadas aparecen apenas termina la partida, pero el video tarda un rato más: primero se sube la demo y después se graba cada jugada. Mientras tanto, la jugada se ve con un indicador de carga.

Si una partida no tiene demo (porque falló la subida o porque ya venció), sus jugadas dicen **Esta jugada no tiene video**.

## Bajar la demo

En la sala de la partida, toca **Ver demo** (en el matchmaking) o **Descargar demo** (en un mix).

- La demo se puede bajar durante **90 días**. Después vence y ya no está. Si se llena el espacio de las demos, las más viejas vencen antes.
- Si dice **La demo se está subiendo**, vuelve en unos minutos.
- En [Partidas](/matches), la columna **Demo / TV** te muestra qué partidas tienen demo.

Para verla, cópiala a la carpeta `cstrike` de tu juego y escribe en la consola `playdemo` y el nombre del archivo.

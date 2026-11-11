---
titulo: Poner tu widget en el stream
resumen: Un recuadro para OBS con tu foto, tu nivel, tu ELO y cómo te va en los mixes, que se actualiza solo.
orden: 15
---

El widget es un recuadro que muestras en OBS (o en Streamlabs) encima del juego: tu foto de perfil, tu nivel, tu ELO, cuánto te falta para el siguiente nivel, las stats que elijas y tus últimos resultados. Se actualiza solo cada minuto.

Lo puede usar cualquier jugador, no hace falta ser streamer de la liga. Muestra lo mismo que ya se ve en tu perfil público.

## Antes de empezar

Necesitas tu perfil vinculado a tu jugador del servidor: ver [Vincular tu SteamID](/help/jugador/vincular-steamid).

## 1. Armar tu widget

1. Entra a **Mi perfil** › [Cuenta](/profile/account).
2. En **Widget para stream**, toca **Armar mi widget**.
3. Elige:
   - **Diseño:** Mini, Compacto, Completo, Stats, Barra (una tira para abajo de la pantalla) o Vertical (una columna para el costado de la cámara).
   - **Período:** Hoy (desde la medianoche de tu PC), 24 h, Temporada o Histórico.
   - **Stats grandes** y **Stats chicas**, en los diseños que las muestran. Se marcan en orden: el número dice en qué lugar sale cada una.
   - El **color**, la opacidad del **fondo**, el **tamaño** y **qué se muestra** (foto de perfil, nick, tag del equipo, nivel, bandera…).
   - Una **frase** propia. Si la dejas vacía, sale sola cuando hay algo para destacar: primero del ranking, una racha de victorias, el top 10, +50 ELO en el día o primero de tu país.
4. Mira la vista previa con tus datos y toca **Guardar**.
5. Toca **Copiar URL**. Esa URL no cambia nunca: la pegas una sola vez en OBS.

## 2. Agregarlo en OBS

1. En tu escena, agrega una fuente **Navegador** encima de la captura del juego.
2. Pega la URL.
3. Ponle el tamaño que te dice la web debajo de la URL (cambia con el diseño y el tamaño que elegiste).

El fondo de la fuente es transparente: solo se ve el recuadro.

## Tu foto

Tu foto de perfil sale dentro del anillo de tu nivel, y el número del nivel queda en una pastilla abajo. Es la misma foto de tu perfil: para cambiarla, cámbiala en [Mi perfil](/profile). Si no tienes foto, sale la inicial de tu nick.

Si no quieres que salga, apaga **Foto de perfil** en **qué se muestra** y toca **Guardar**: el nivel queda como antes, con el número dentro del anillo.

## Cambiar algo

1. Vuelve a **Armar mi widget**: se abre con lo que guardaste.
2. Cambia lo que quieras y toca **Guardar**.

No hace falta tocar OBS: tu widget cambia solo en un minuto o dos. Si cierras sin guardar, la web te pregunta antes de perder los cambios.

> **Si armaste tu widget antes del 11 de noviembre de 2026:** la URL que tienes en OBS es más larga y trae todo lo que elegiste adentro. Esa URL sigue andando igual, pero no toma lo que guardes. Reemplázala una vez por la URL nueva (la que solo trae `?id=` y tu código de ficha, sin nada más) y desde ahí todo se cambia con **Guardar**.

> **Ojo:** la URL solo muestra datos públicos, así que no pasa nada si alguien la ve. Si tu perfil es privado, el widget igual muestra tu ELO y tus stats (como tu perfil público), pero no tu bandera.

## Qué cuenta

- Cuentan los mixes terminados, también los del matchmaking. Los torneos y las PCW no.
- **Pistolas, Clutch, Sniper y Cuchillo** cuentan desde que el servidor manda esos datos: en los mixes más viejos suman 0.
- Si el widget dice **Sin conexión, reintentando…**, se arregla solo cuando vuelve la conexión. Si ya se estaba viendo, queda lo último hasta que vuelva.

---
titulo: Anticheat
resumen: Revisar las sesiones, las marcas y la evidencia, buscar un programa entre todos los jugadores, cargar firmas, elegir qué servidores lo exigen, configurar el agente y banear una máquina.
orden: 11
---

El anticheat se maneja en Administración › [Anticheat](/admin/anticheat). Tiene cinco pestañas: **Sesiones**, **Marcas**, **Firmas y hashes**, **Servidores** y **Agente**.

> **Ojo:** nada de lo que ves acá se le cuenta a un jugador. Ni qué revisa el agente, ni qué marca, ni qué firmas hay cargadas. Con esa información, un cheater busca cómo esquivarlo. Al jugador solo le llega un código (la tabla está al final).

## Revisar una sesión

1. En **Sesiones**, busca al jugador. La columna **Marcas** dice cuántas tiene sin revisar, y el punto rojo indica que hay alguna grave.
2. Toca la sesión. La evidencia se ordena así:
   - **Marcas** sin revisar, con su gravedad (de 1, leve, a 3, grave), el archivo y su hash.
   - **Máquina**: las cuentas que usaron esa PC, sus baneos y los intentos de entrar estando baneada.
   - **Acceso a la memoria del juego**: los programas que abrieron el juego, con qué permisos y si es el programa que lo abrió (un launcher, por ejemplo).
   - **Overlays**: las ventanas que se dibujan encima del juego y cuánto lo tapan.
   - **Archivos del juego**, **drivers** que no son de Microsoft, **módulos** del juego y **programas**.
   - Las **capturas**: una cada 30 a 35 segundos, de toda la pantalla.
3. Con cada marca que ya miraste, escribe una nota (opcional, pero ayuda al siguiente que la mire: qué era y qué decidiste) y toca **Revisada**.

Una marca no es una prueba. Un overlay puede ser Discord o el contador de FPS, y un programa con acceso a la memoria puede ser el launcher. Mira la captura del mismo momento antes de decidir.

Para una captura en el momento, en **Pedir una captura** escribe el motivo y toca **Pedir**. **El jugador no se entera.** Solo se toma con el juego al frente.

## Marcas de todas las sesiones

En **Marcas** ves las de todos los jugadores, de las más graves a las más leves. Arriba eliges **Todas**, **Revisar y graves** (gravedad 2 y 3, la opción de entrada) o **Solo graves**, y con **Solo sin revisar** escondes las que ya se revisaron.

| Gravedad | Ejemplos |
|---|---|
| 3, grave | Un programa con una firma de trampa, un agente modificado, un programa sin firma que abrió la memoria del juego |
| 2 | Un módulo o un driver sin firma, un overlay sin firma, un archivo del juego distinto del original, un aim muy raro, una PC parecida a otra baneada |
| 1, leve | El launcher con acceso al juego, un overlay firmado, un puerto que no coincide, una IP que no se pudo comparar (el anticheat llegó por IPv6 y el juego por IPv4), muchos headshots |

Las marcas de aim las crea el servidor al terminar el mapa, solo desde 10 kills. **Nunca expulsan solas.**

## Buscar un programa entre todos los jugadores

En **Firmas y hashes** › **Buscar un hash**, pega un hash (SHA-256) y toca **Buscar**. Ves todos los jugadores y sesiones donde apareció. Cualquier hash del panel es un enlace a esta búsqueda.

Sirve para saber si un programa raro es de un solo jugador o lo tienen todos (y entonces es algo normal).

## Cargar una firma

En **Firmas y hashes** › **Cargar una firma**:

1. El **SHA-256** o, si lo dejas vacío, el **nombre del archivo**. Con el hash es más seguro: un nombre se cambia fácil.
2. En qué tipo de evento vale (módulos, drivers, overlays…), si no es en todos.
3. **Qué es**, por ejemplo "Cheat X 2.1" o "Overlay de Discord".
4. Toca uno de los dos botones:
   - **Cargar como trampa**: cada vez que aparezca, se crea una marca grave.
   - **Cargar como conocido**: deja de marcar. Úsalo con los programas normales (overlays de Discord, de la placa de video) y con los archivos originales de ClientMod.

En **Firmas cargadas** está la lista, con **Borrar** en cada una.

Para que se marquen los archivos del juego modificados, tienen que estar cargados como **conocidos** los hashes de los archivos originales de ClientMod. Si no, esa regla no marca nada, y cada sesión se llena de marcas de módulos sin firma, porque los archivos del juego no tienen firma digital. Se cargan todos juntos con cada versión nueva de ClientMod: pídeselo a quien maneja el anticheat.

## Elegir qué servidores exigen el anticheat

En **Servidores** está cada servidor activo con su modo.

Los **servidores que toman salas del matchmaking** (hoy #1, #2 y #3) no se cambian acá: siguen a **Anticheat obligatorio** de Administración › [Matchmaking](/admin/matchmaking). Prendido, están en **Siempre**; apagado, en **No lo exige**. En la fila dice "Lo decide el matchmaking". Así la cola y el servidor piden lo mismo.

En los demás lo cambias con el menú de cada fila:

- **Siempre**: exige el anticheat desde que el jugador entra, también en el calentamiento. Es el de los servidores de partidas: así nadie queda afuera con la partida empezada.
- **No lo exige**: no abre sesiones ni expulsa a nadie por el anticheat, ni siquiera por los códigos graves.

Si un servidor aparece con **Solo en la partida**, ese modo ya no se usa: cámbialo a **Siempre**. Con él, quien entraba sin el anticheat jugaba el calentamiento y el servidor lo sacaba recién al arrancar la partida.

El cambio le llega al servidor en la próxima revisión de cada jugador, que es al entrar y cada minuto. Queda registrado quién lo cambió.

Si el anticheat tiene problemas en medio de una noche de partidas, no hace falta cambiar el modo: **Abrir mixes**, arriba, deja jugar sin él por los minutos que elijas. `AC-3`, `AC-4` y `AC-5` siguen expulsando igual.

## Configurar el agente

En **Agente** cambias lo que revisa el agente y cada cuánto, sin sacar otra versión. Les llega a todos en el próximo latido:

- Qué revisa y cada cuánto, y qué archivos del juego.
- **Capturas**: cada cuántos segundos (al azar entre el mínimo y el máximo, desde 30), a los cuántos días se borran (7 por defecto) y a los cuántos el resto de la evidencia. Una sesión conservada por un caso abierto no vence.
- **Versión mínima**: con una versión anterior, el servidor expulsa al jugador con `AC-4`. Súbela recién cuando la mayoría ya se actualizó.
- **Actualización**: la versión, el enlace (tiene que ser de `cmleague.lat`) y el hash del `.exe` nuevo. El agente se actualiza solo cuando no está en partida.
- **Hashes permitidos**: los `.exe` oficiales del agente. Si la lista tiene alguno, cualquier otro agente queda marcado como modificado y se expulsa con `AC-4`. Cada versión nueva va acá **antes** de publicarla.

## Banear una máquina

El baneo de una cuenta no alcanza si la persona se crea otra o cambia el SteamID. En la evidencia de su sesión, en **Máquina**:

1. Escribe el motivo y toca **Banear la máquina**.
2. Desde ese momento, cualquier cuenta que abra el anticheat en esa PC queda **baneada por evasión**, y el servidor la expulsa con `AC-5`. Eso incluye las cuentas nuevas.

En la misma sección:

- **Levantar el ban de la máquina**. Los baneos por evasión que ya se crearon siguen: levántalos desde el baneo de cada cuenta.
- **PC compartida**, al lado de una cuenta: la deja jugar en la máquina baneada, por ejemplo si es de un hermano que usa la misma PC. Puedes dejar una nota.

Si una cuenta usa una PC **parecida** a una baneada, pero no la misma, no se banea: queda una marca para que la revises.

## Códigos que ve el jugador

| Código | Qué pasó | Expulsa |
|---|---|---|
| `AC-0` | El servidor no pudo leer su SteamID. Le da 1 minuto desde que entró, porque Steam a veces tarda | Según el modo del servidor |
| `AC-1` | No tiene el anticheat abierto y vinculado, o no responde, o juega desde otra IP. También si su SteamID no está vinculado: ahí le pide el `!claim` y le da 1 minuto desde que entró | Según el modo del servidor |
| `AC-2` | El anticheat no ve el juego en esa PC | Según el modo del servidor |
| `AC-3` | Tiene abierto un `hl2.exe`: solo se juega con ClientMod | Siempre, aunque abras los mixes con `sm_ac_open` |
| `AC-4` | Su anticheat está modificado o es una versión vieja | Siempre |
| `AC-5` | Su PC está baneada | Siempre |
| `AC-6` | Abrió ClientMod con su anticheat (EAC), que no se puede usar en nuestros servidores | Según el modo del servidor |

"Según el modo del servidor" es en cualquier momento con **Siempre**, y nunca con **No lo exige**. Antes de expulsar, el servidor le avisa en el chat y le da 20 segundos.

Si un jugador te pregunta por un código, dile qué hacer (cerrar el otro juego, actualizar el anticheat, abrirlo y vincularlo, apagar el EAC de ClientMod), **nunca qué detectó ni cómo**. El motivo exacto está en su sesión. Al jugador le explica los códigos [Jugar con CMLeague Anticheat](/help/jugador/anticheat).

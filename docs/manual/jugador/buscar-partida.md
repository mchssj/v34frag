---
titulo: Buscar partida en el matchmaking
resumen: Solo o en grupo, aceptar la partida, el veto de mapas, conectarte al servidor, qué pasa si no llegas y los reemplazos.
orden: 3
---

El matchmaking arma partidas con jugadores de un nivel parecido al tuyo, elige el servidor y te pasa la contraseña. Tú solo buscas, aceptas y te conectas.

## Antes de buscar

- Confirma tu correo: sin eso no puedes jugar.
- No necesitas tener tu SteamID vinculado: lo haces con `!claim` en el chat de tu primera partida (ver [Vincular tu SteamID](/help/jugador/vincular-steamid)).
- Si tienes una sanción del matchmaking o un baneo en los servidores, la web te lo dice en lugar del botón.

## 1. Buscar

1. Entra a [Jugar](/play).
2. Elige el **Modo de juego** y la **Región del servidor**.
3. Toca **Buscar partida**.

Mientras buscas puedes seguir usando la web: la búsqueda sigue abierta y te avisamos cuando hay partida. Al principio solo te emparejamos con jugadores de ELO cercano; con el paso de los minutos el margen se agranda para que no esperes de más.

Para seguir buscando, la web tiene que quedar abierta, en cualquier página y en cualquier pestaña. Si la cierras o cierras la sesión, sales de la cola sin sanción. Si recargas la página o se te corta internet unos segundos, sigues buscando con tu lugar; mientras no estás, no te armamos partida. Al volver, Jugar te avisa si te sacamos de la cola.

### En grupo

Los equipos se reparten para que queden lo más parejos posible. Se mira el ELO de los diez, y si un admin lo encendió, también el rating de sus partidas 5v5 recientes: así alguien que juega mejor (o peor) de lo que dice su ELO no desequilibra la partida. El rating puede mover tu lugar en el reparto hasta unos 200 puntos de ELO; el ELO sigue pesando más, y el que ganas o pierdes se calcula igual que siempre.

Puedes buscar con un amigo: invítalo con **Invitar al grupo**. Juegan en el mismo equipo. El grupo puede ser de hasta {{mm.grupo_max}} personas, con hasta {{mm.grupo_dif_elo}} de diferencia de ELO entre ustedes.

## 2. Aceptar

Cuando aparece **Partida encontrada** tienes **{{mm.aceptar}}** para tocar **Aceptar**.

- Si todos aceptan, pasan al veto.
- Si alguien no acepta, la partida se cancela. Los que aceptaron vuelven a la búsqueda sin perder su lugar en la cola. Un grupo vuelve solo si aceptaron todos sus integrantes.

> **Ojo:** no aceptar a tiempo o rechazar la partida te da una sanción: un rato sin poder buscar (ver "Sanciones" abajo).

## 3. Veto de mapas

Cada equipo tiene un capitán: el jugador con más ELO del equipo. Los capitanes banean mapas por turnos hasta que queda uno, que es el que se juega. Empieza el equipo con menos ELO promedio.

- Cada turno dura **{{mm.veto}}**. Si el capitán no elige, se banea un mapa al azar.
- Si eres capitán, la sala te dice **Tu turno: banea un mapa.**

## 4. Conectarte al servidor

Cuando termina el veto, buscamos un servidor libre. Si están todos ocupados, la sala dice que la partida se arma cuando se libere uno; si en {{mm.espera_servidor}} no hay ninguno, la partida se cancela sin sanción para nadie.

Con el servidor listo, la **Sala de la partida** te muestra la dirección y la contraseña. Para entrar:

- Toca **Conectar**: abre el juego y entra directo al servidor.
- O toca **Copiar connect** y pega el comando en la consola del juego.

Tienes **{{mm.conectar}}** para conectarte; la sala muestra cuánto queda y quiénes ya entraron. Si todavía no vinculaste tu SteamID, o entraste desde otra PC, escribe en el chat el `!claim` que te muestra la sala.

> **Ojo:** la contraseña es solo para los jugadores de la partida. No la compartas.

## 5. Durante la partida

- Si te desconectas, tienes **{{mm.volver}}** para volver. La sala muestra cuánto te queda.
- Si no vuelves, cuenta como abandono: te llevas una sanción y pierdes ELO (entre {{mm.abandono_ganado_min}} y {{mm.abandono_ganado_max}} si tu equipo gana; si pierde, al menos lo de una derrota normal; ver [ELO y estadísticas](/help/jugador/elo-y-estadisticas)). Tu equipo puede rendirse con `!gg` sin perder ELO.
- Irte en la última ronda, o cuando ya terminó la partida, no cuenta como abandono: no hay sanción y tu ELO se calcula normal.
- Si abandonan 2 o más jugadores de un equipo, ese equipo pierde la partida. Si pasa en los dos equipos, la partida se anula.

### Reemplazos

Cuando alguien abandona, puede salir un aviso en el Discord de la liga con un link para que otro jugador entre en su lugar. Así tu equipo no juega con uno menos el resto de la partida.

- **Sin esperar:** si un compañero se desconectó y no va a volver, escribe `!callreplace` en el chat del servidor y elige quién falta. Vota solo tu equipo y pasa con más del {{mm.reemplazo_voto}} de los compañeros conectados. El que no vota cuenta como "No". Si pasa, el que se fue queda como abandono en el momento.
- **Si no hacen nada:** al terminar sus {{mm.volver}} para volver, se llama a un reemplazo solo.
- No se llama a nadie si faltan menos de {{mm.reemplazo_rondas}} para el final del tiempo reglamentario.
- Un abandono cubierto por un reemplazo no cuenta para los 2 que hacen perder la partida.
- El que abandonó se lleva igual su sanción y pierde ELO. Si vuelve después de que entró el reemplazo, queda de espectador.

### Entrar como reemplazo

1. Abre el link del aviso de Discord. Tienes que haber iniciado sesión y poder buscar partida: SteamID vinculado, sin sanciones y sin otra sala.
2. Ves la sala de la partida: el marcador, los dos equipos y, en el equipo del que se fue, un lugar libre que dice **Aquí entrarías tú**. La IP y la contraseña del servidor todavía no se ven.
3. Toca **Entrar como reemplazo**. El link es de un solo uso: si otro llegó antes, la página te lo dice. Vence a los {{mm.reemplazo_link}}.
4. Te lleva a la sala: tu fila ocupa el lugar del que se fue, con la etiqueta **Reemplazo**, y arriba ves **Entra al servidor** con la cuenta regresiva. Ahí están el servidor y la contraseña. Tienes {{mm.conectar}} para entrar. Si no entras, se te sanciona como a quien no se conecta a su partida y se busca otro reemplazo.
5. En el servidor entras directo al equipo del que abandonó.

Ganas o pierdes ELO como cualquiera, según las rondas que juegues: si entras muy tarde y juegas pocas, la partida no te cuenta.

Al terminar, la sala muestra el resultado, el MVP, los destacados y los clips.

## Ver una partida jugada

En **Partidas**, una partida del matchmaking se abre como su sala, con dos pestañas:

- **Descripción general** (la que abre): los dos equipos con lo que hizo cada uno en esa partida (rating, K/D/A, ADR, HS %, rondas) y cuánto ELO ganó o perdió, el mapa, el MVP y, si hubo reemplazos, **Cambios en la partida**: quién abandonó y quién entró, con la ronda.
- **Estadísticas**: las tablas completas (General, Avanzado, Entrada y Clutch).

## Sanciones

No aceptar, rechazar, no conectarte o abandonar te deja un rato sin poder buscar partida. Cada falta seguida dura más: {{mm.sanciones}}. Desde ahí, cada falta nueva te deja {{mm.sancion_max}} sin buscar.

El contador baja un escalón por cada semana sin faltas.

Si la sanción fue injusta (por ejemplo, se cayó Steam justo cuando apareció la partida), pídele a un moderador que la revise. Si la levanta, puedes volver a buscar enseguida y el contador baja un escalón, como si esa falta no hubiera pasado.

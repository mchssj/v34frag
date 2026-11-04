---
titulo: Buscar partida en el matchmaking
resumen: Solo o en grupo, aceptar la partida, el veto de mapas, conectarte al servidor y qué pasa si no llegas.
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
- Si no vuelves, cuenta como abandono: pierdes ELO y te llevas una sanción. Tu equipo puede rendirse con `!gg` sin perder ELO.
- Si abandonan 2 o más jugadores de un equipo, ese equipo pierde la partida. Si pasa en los dos equipos, la partida se anula.

Al terminar, la sala muestra el resultado, el MVP, los destacados y los clips.

## Sanciones

No aceptar, rechazar, no conectarte o abandonar te deja un rato sin poder buscar partida. Cada falta seguida dura más: {{mm.sanciones}}. Desde ahí, cada falta nueva te deja {{mm.sancion_max}} sin buscar.

El contador baja un escalón por cada semana sin faltas.

Si la sanción fue injusta (por ejemplo, se cayó Steam justo cuando apareció la partida), pídele a un moderador que la revise. Si la levanta, puedes volver a buscar enseguida y el contador baja un escalón, como si esa falta no hubiera pasado.

---
titulo: Banear a un jugador
resumen: Poner un baneo, elegir cuánto dura, cambiarlo, levantarlo y revisar el historial de cada jugador.
orden: 2
---

Los baneos se manejan en Administración › [Baneos](/admin/bans). Es una sola lista para todos los servidores: entran los que se ponen desde la web, los `!ban` del juego y los importados de los servidores viejos.

Un jugador baneado no puede entrar a ningún servidor de CMLeague ni buscar partida en el matchmaking.

Si está en el matchmaking cuando lo baneas, la web lo saca sola, sin que hagas nada más. Vale igual para los baneos de la web y para los `!ban` del juego:

- **Buscando partida:** sale de la cola, junto con su grupo.
- **En una sala que todavía no empezó** (aceptando, vetando mapas o conectándose): la sala se cancela y los otros vuelven a la cola con su lugar.
- **Jugando:** el servidor lo echa y su abandono cuenta en el acto, así se puede llamar antes a un reemplazo. La partida sigue.

No se le suma una sanción de la cola: el baneo ya es la sanción.

## Poner un baneo

1. Toca **Banear**.
2. En **Jugador o SteamID**, busca por el nick de su ficha o pega su SteamID64.
   - Si eliges una **ficha**, el baneo vale para todos sus SteamID y para los que sume después.
   - Si pegas un SteamID que tiene ficha, se banea la ficha entera.
3. Escribe el **motivo**. Se ve en la lista y al intentar entrar al servidor: escríbelo claro y sin insultos.
4. Elige la duración: **Horas** (escribe cuántas, de 1 a 72), **1 día**, **3 días**, **1 semana**, **1 mes** o **Hasta una fecha**. Abajo ves el día y la hora en que vence.
5. Toca **Banear**.

> **Ojo:** el baneo **Permanente** solo lo puede poner un admin. Tampoco puedes cambiar ni levantar uno permanente: pídeselo a un admin.

Si el jugador ya tenía un baneo activo, el nuevo lo reemplaza y el anterior queda como levantado.

## Revisar un baneo

Toca un baneo de la lista para ver el detalle: quién lo puso, cuándo, desde dónde (web, juego o importado), hasta cuándo dura y los demás baneos de esa persona.

Arriba filtras por **Activos**, **Vencidos**, **Levantados** o **Todos**, por origen y por servidor, y buscas por nick, motivo o SteamID.

## Cambiar o levantar

Desde el detalle del baneo:

- **Cambiar:** otro motivo u otra duración. Si solo cambias el motivo, deja la duración en **Como está** y el vencimiento no se mueve. Guarda con **Guardar cambios**.
- **Levantar baneo:** escribe el motivo (es obligatorio) y confirma. El jugador puede volver a entrar desde la próxima sincronización de los servidores. El baneo no se borra: queda en la lista como levantado, con tu motivo.

## Los baneos del soporte

El soporte también banea desde la web, pero con límites: de 1 a 120 minutos, nunca a quien ya está baneado y hasta 3 baneos de soporte por jugador en 7 días. Solo cambia o levanta los suyos. Tú puedes cambiar o levantar cualquiera de ellos. Lo que puede hacer el soporte está en la sección [Soporte](/help/soporte/banear-jugador) del manual.

Todo lo que hace el soporte (baneos, clips, fotos y logos quitados, comentarios borrados y sanciones levantadas) aparece en la pestaña **Actividad del soporte** de Baneos, con quién lo hizo, a quién, el motivo y cuándo. Puedes filtrar por acción.

## Las sanciones del matchmaking

La pestaña **Matchmaking** de Baneos tiene las sanciones que pone la cola sola y las exclusiones del matchmaking. Son otra cosa: no sacan del servidor, solo de la cola. Mira [Revisar y levantar sanciones del matchmaking](/help/moderador/sanciones-matchmaking).

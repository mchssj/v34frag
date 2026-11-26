---
titulo: Banear a un jugador
resumen: Poner un baneo, elegir cuánto dura, cambiarlo, levantarlo y revisar el historial de cada jugador.
orden: 2
---

Los baneos se manejan en Administración › [Baneos](/admin/bans). Entran los que se ponen desde la web y los importados de los servidores viejos.

Un jugador baneado no puede buscar partida en el matchmaking.

> **Ojo:** por ahora, el baneo de la web **no lo echa de los servidores**. Si está jugando o entra a un servidor, usa `!ban` en ese servidor (ver [Comandos en el servidor](/help/moderador/comandos-en-el-servidor)): vale solo en ese servidor y no aparece en esta lista. Estamos trabajando para que el baneo de la web también valga en los servidores.

Si está en el matchmaking cuando lo baneas, la web lo saca sola, sin que hagas nada más:

- **Buscando partida:** sale de la cola, junto con su grupo.
- **En una sala que todavía no empezó** (aceptando, vetando mapas o conectándose): la sala se cancela y los otros vuelven a la cola con su lugar.
- **Jugando:** su abandono cuenta en el acto, así se puede llamar antes a un reemplazo. La partida sigue. Para sacarlo del servidor, usa `!ban` ahí.

No se le suma una sanción de la cola: el baneo ya es la sanción.

## Poner un baneo

1. Toca **Banear**.
2. En **Jugador o SteamID**, busca por el nick de su ficha o pega su SteamID (`STEAM_0:…` o SteamID64).
   - Si eliges una **ficha**, el baneo vale para todos sus SteamID y para los que sume después.
   - Una ficha **sin SteamID** también se puede banear: no puede buscar partida en el matchmaking.
   - Si eres **admin**, también encuentras las **cuentas sin ficha** (nunca buscaron partida, como una cuenta recién creada): al banearla se le crea la ficha y queda baneada.
   - Si pegas un SteamID que tiene ficha, se banea la ficha entera.
3. Escribe el **motivo**. Se ve en la lista: escríbelo claro y sin insultos.
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
- **Levantar baneo:** escribe el motivo (es obligatorio) y confirma. El jugador puede volver a buscar partida. El baneo no se borra: queda en la lista como levantado, con tu motivo.

## Los baneos del soporte

El soporte también banea desde la web, pero con límites: por minutos, nunca a quien ya está baneado y con un límite de baneos de soporte por jugador. Los números los fija un admin (hoy, hasta 120 minutos y 3 baneos en 7 días) y los ves en la tarjeta **Límites del soporte**, en la pestaña **Actividad del soporte**. Solo cambia o levanta los suyos. Tú puedes cambiar o levantar cualquiera de ellos. Lo que puede hacer el soporte está en la sección [Soporte](/help/soporte/banear-jugador) del manual.

Todo lo que hace el soporte (baneos, clips, fotos y logos quitados, comentarios borrados y sanciones levantadas) aparece en la pestaña **Actividad del soporte** de Baneos, con quién lo hizo, a quién, el motivo y cuándo. Puedes filtrar por acción.

## Las sanciones del matchmaking

La pestaña **Matchmaking** de Baneos tiene las sanciones que pone la cola sola y las exclusiones del matchmaking. Son otra cosa: no sacan del servidor, solo de la cola. Mira [Revisar y levantar sanciones del matchmaking](/help/moderador/sanciones-matchmaking).

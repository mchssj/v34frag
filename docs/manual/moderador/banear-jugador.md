---
titulo: Banear a un jugador
resumen: Poner un baneo, elegir cuánto dura, cambiarlo, levantarlo y revisar el historial de cada jugador.
orden: 2
---

Los baneos se manejan en Administración › [Baneos](/admin/bans). Entran los que se ponen desde la web, los que se ponen con `!ban` en los servidores y los importados de los servidores viejos.

Un jugador baneado no puede buscar partida en el matchmaking ni entrar a ningún servidor de CMLeague. Si está en un servidor cuando lo baneas, el servidor lo echa en 5 minutos como mucho, con el motivo y hasta cuándo. Al revés también: un `!ban` en el juego vale en los tres servidores y aparece en esta lista (ver [Comandos en el servidor](/help/moderador/comandos-en-el-servidor)).

Si está en el matchmaking cuando lo baneas, la web lo saca sola, sin que hagas nada más:

- **Buscando partida:** sale de la cola, junto con su grupo.
- **En una sala que todavía no empezó** (aceptando, vetando mapas o conectándose): la sala se cancela y los otros vuelven a la cola con su lugar.
- **Jugando:** su abandono cuenta en el acto, así se puede llamar antes a un reemplazo. La partida sigue, y el servidor lo echa en 5 minutos como mucho (o en el acto con `!ban` ahí).

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

## IPs y rangos (solo admins)

En el detalle de un baneo activo, un admin ve la sección **IPs y rangos**. Sirve para frenar a quien se crea cuentas nuevas para seguir jugando.

- **IPs que usó:** las de los servidores (por sus SteamID) y las de la web (al iniciar sesión y entrar a la cola). Si otra ficha o cuenta usó la misma IP, aparece en amarillo.
- Al lado de cada IP eliges **Esta IP**, `x.y.z.*` (un rango `/24`) o `x.y.*.*` (un rango `/16`). Muchas conexiones cambian de IP pero repiten los primeros números: un rango las cubre.
- También puedes escribir otra IP o rango en **Otra IP o rango** y tocar **Revisar**. Como mucho, `/16`.
- Antes de confirmar, la web te muestra **a quién más afecta**: los jugadores de CMLeague que usaron alguna IP de ese rango. Cada uno tiene una casilla **Exceptuar**: los que no están baneados vienen marcados y siguen buscando partida desde ahí. Desmarca a quien creas que es otra cuenta del baneado.
- En cada IP o rango baneado ves sus **excepciones**: con la **X** sacas una y con **Exceptuar a alguien** sumas a otro de los que usaron ese rango (por ejemplo, si un jugador escribe por Discord que no puede buscar partida).
- Desde una IP o rango baneado nadie puede buscar partida, aceptar una, crear una cuenta ni entrar a los servidores. Vence con el baneo, como mucho a los 30 días. Con la **X** lo levantas.
- La IP que banea un admin con `!ban` en el juego aparece acá, por el mismo tiempo que el baneo (sin el tope de 30 días). Las que se banean con `!banip`, sin ficha, están en la pestaña **IPs sin ficha**, con sus excepciones.

### Banear una IP o rango sin ficha

Si no sabes quién es, entra con cuentas sin ficha o quieres cortar un rango sin banear a nadie en particular, un admin banea solo la IP o el rango:

1. En Baneos, abre la pestaña **IPs sin ficha** y toca **Banear IP o rango**.
2. Escribe la IP o el rango (como mucho `/16`, por ejemplo `181.21.0.0/16`), el **motivo** y la **duración**: 1 hora, 1 día, 7 días o 30 días. No hay permanente.
3. Toca **Revisar**. Igual que arriba, la web te muestra a quién más alcanza, con la casilla **Exceptuar** marcada para los que no están baneados.
4. Toca **Banear…**. Vale en la web y en los tres servidores (en 5 minutos como mucho).

En la misma pestaña están los que se pusieron así y los `!banip` del juego: ahí les sumas o sacas excepciones y los levantas con la **X**.

> **Ojo:** con una VPN o los datos del celular la persona cambia de IP. Es una barrera más, no la única.

## Los baneos del soporte

El soporte también banea desde la web, pero con límites: por minutos, nunca a quien ya está baneado y con un límite de baneos de soporte por jugador. Los números los fija un admin (hoy, hasta 120 minutos y 3 baneos en 7 días) y los ves en la tarjeta **Límites del soporte**, en la pestaña **Actividad del soporte**. Solo cambia o levanta los suyos. Tú puedes cambiar o levantar cualquiera de ellos. Lo que puede hacer el soporte está en la sección [Soporte](/help/soporte/banear-jugador) del manual.

Todo lo que hace el soporte (baneos, clips, fotos y logos quitados, comentarios borrados y sanciones levantadas) aparece en la pestaña **Actividad del soporte** de Baneos, con quién lo hizo, a quién, el motivo y cuándo. Puedes filtrar por acción.

## Las sanciones del matchmaking

La pestaña **Matchmaking** de Baneos tiene las sanciones que pone la cola sola y las exclusiones del matchmaking. Son otra cosa: no sacan del servidor, solo de la cola. Mira [Revisar y levantar sanciones del matchmaking](/help/moderador/sanciones-matchmaking).

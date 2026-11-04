---
titulo: Usuarios, roles y fichas
resumen: Las cuentas (alias, rol, VIP, streamer), las palabras bloqueadas, las fichas de jugador y los pedidos de SteamID.
orden: 7
---

Hay dos cosas distintas:

- La **cuenta** es con lo que alguien entra a la web: email, alias y rol. Se maneja en Administración › [Usuarios](/admin/users).
- La **ficha** es el jugador del juego: sus SteamID, sus partidas, su ELO. Se maneja en Administración › [Jugadores](/admin/players).

Una cuenta se une con su ficha cuando el jugador vincula su SteamID con `!claim`.

## Cuentas

En **Cuentas** buscas y filtras por **Admins**, **Moderadores**, **Organizadores**, **Streamers** y **Sin ficha**. Toca una cuenta para:

- **Cambiar el alias**, sin la espera de 15 días. Si tiene una palabra bloqueada, la web te pide confirmar.
- **Cambiar el rol:**

  | Rol | Qué puede hacer |
  |---|---|
  | Usuario | Juega, arma equipos y se inscribe |
  | Organizador | Además crea y gestiona sus torneos |
  | Moderador | Además banea desde la web (no permanentes), modera equipos y gestiona torneos |

  El rol de admin no se da desde la web.
- **Acceso:** ver si confirmó su correo y cuándo entró por última vez, y ayudarlo a entrar (ver abajo).
- **VIP:** darlo hasta una fecha o de por vida, y ver hasta cuándo dura.
- **Streamer del HUD:** con la marca, la cuenta puede generar su link de OBS desde Mi perfil y transmitir cualquier servidor con el HUD activo. Quitarla corta su link en 30 segundos. A la cuenta se le avisa en los dos casos.
- **Banear** a su ficha (ver [Banear a un jugador](/help/moderador/banear-jugador)).

## Ayudar a alguien a entrar

En la sección **Acceso** de la cuenta tienes tres acciones. Todas piden confirmar y queda registrado quién las hizo.

| Acción | Cuándo usarla | Qué pasa |
|---|---|---|
| **Reenviar activación** | No le llegó el correo de activación. Solo en cuentas sin confirmar | Le llega otro correo con el enlace |
| **Enviar correo de contraseña** | Se olvidó la contraseña y tiene acceso a su correo | Le llega un enlace para elegir otra. La actual sigue valiendo hasta que la cambie |
| **Contraseña aleatoria** | Se olvidó la contraseña y no puede usar su correo | La actual deja de valer y se cierran sus sesiones. La nueva se muestra **una sola vez** |

> **Ojo:** pásale la contraseña aleatoria por un canal privado y recomiéndale cambiarla en Mi perfil. No se puede usar en tu propia cuenta ni en la de otro admin. La tuya se cambia en [Cuenta](/profile/account).

## Palabras bloqueadas

En **Palabras bloqueadas** agregas palabras que nadie puede usar en su alias ni en el nombre de un equipo. La web te muestra los alias, fichas y equipos que ya contienen una palabra bloqueada, para que los corrijas. También puedes desbloquear una palabra.

## Imagen del inicio de sesión

En **Inicio de sesión** cambias la imagen que se ve al lado del formulario de entrada.

## Fichas

En Administración › Jugadores, pestaña **Fichas**, buscas por nick o SteamID y filtras por **Con cuenta**, **Sin cuenta** y **Sin SteamID**. En el detalle de una ficha editas su nick (si tiene cuenta, manda el alias de la cuenta), la foto, la biografía, los logros, sus SteamID, la cuenta vinculada y las medallas. La foto de la ficha se ve en toda la web hasta que el jugador sube una suya: gana la última que se subió.

**Nueva ficha** crea un jugador sin cuenta, al que después le sumas SteamID o una cuenta.

## Pedidos de SteamID

Cuando un jugador llegó al tope de SteamID por ficha (hoy {{claim.max_steam_ids}}) y quiere sumar otro, o pide desvincular uno, el pedido aparece en **Pedidos de SteamID**:

- **Aprobar:** suma o quita el SteamID. Las partidas de ese SteamID pasan a la ficha (o vuelven a quedar sin ficha) y se recalcula el ELO de esa ficha; los demás no cambian.
- **Rechazar:** con un motivo opcional, que ve el jugador.

Ahí mismo cambias el **tope de SteamID por ficha**.

## SteamID sin vincular

**SteamID sin vincular** lista los SteamID que jugaron en nuestros servidores y no tienen ficha, con su último nick y sus partidas. Puedes crearles una ficha.

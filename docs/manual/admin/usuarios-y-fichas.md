---
titulo: Usuarios, roles y fichas
resumen: Las cuentas (alias, rol, VIP, streamer), las palabras bloqueadas, los correos temporales bloqueados, las fichas de jugador y los pedidos de SteamID.
orden: 7
---

Hay dos cosas distintas:

- La **cuenta** es con lo que alguien entra a la web: email, alias y rol. Se maneja en Administración › [Usuarios](/admin/users).
- La **ficha** es el jugador del juego: sus SteamID, sus partidas, su ELO. Se maneja en Administración › [Jugadores](/admin/players).

Una cuenta se une con su ficha cuando el jugador vincula su SteamID con `!claim`.

## Cuentas

En **Cuentas** buscas y filtras por **Admins**, **Moderadores**, **Soporte**, **Organizadores**, **Streamers** y **Sin ficha**. Toca una cuenta para:

- **Cambiar el alias**, sin la espera de 15 días. Si tiene una palabra bloqueada, la web te pide confirmar.
- **Cambiar el rol:**

  | Rol | Qué puede hacer |
  |---|---|
  | Usuario | Juega, arma equipos y se inscribe |
  | Organizador | Además crea y gestiona sus torneos |
  | Soporte | Además banea por un rato corto (con los límites que pones en Baneos › Actividad del soporte), reprocesa y revisa clips, quita fotos y logos, borra comentarios y levanta sanciones de la cola. Lo que hace queda en Baneos › **Actividad del soporte** |
  | Moderador | Además banea desde la web (no permanentes), modera equipos y gestiona torneos |

  El rol de admin no se da desde la web. Para que alguien de soporte o moderación aparezca en Quiénes somos, su cuenta tiene que tener ficha de jugador.
- **Acceso:** ver su correo, si lo confirmó y cuándo entró por última vez, y ayudarlo a entrar (ver abajo). El correo es solo para consultarlo: no se cambia desde aquí. Es un dato personal, así que no lo compartas.
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

## Correos bloqueados

En **Correos bloqueados** están los dominios de correo con los que nadie se puede registrar ni cambiar su correo. Sirve para frenar a quien se crea cuentas nuevas con correos temporales (por ejemplo, un cheater baneado).

- Ya está cargada la **lista pública de correos temporales**, más de 10.000 dominios. Los que agrega un admin aparecen como **Agregado**.
- Bloquear un dominio bloquea también sus subdominios: `anonmart.com` frena también `mail.anonmart.com`.
- Para bloquear uno, escribe el dominio (`anonmart.com`) y, si quieres, un motivo, y toca **Bloquear**. Desde ese momento, quien intente registrarse con ese correo ve un aviso y tiene que usar otro.
- Si un dominio de la lista pública es un correo real (por ejemplo, el de una universidad), toca **Desbloquear**: queda **Permitido** y no se vuelve a bloquear cuando se actualiza la lista. Con **Volver a bloquear** lo deshaces.
- Abajo ves las **cuentas que ya usan un correo bloqueado**: se crearon antes del bloqueo y siguen funcionando. Con **Ver cuenta** la abres en **Cuentas** y, si corresponde, baneas su ficha.

## Imagen del inicio de sesión

En **Inicio de sesión** cambias la imagen que se ve al lado del formulario de entrada.

## Fichas

En Administración › Jugadores, pestaña **Fichas**, buscas por nick o SteamID y filtras por **Con cuenta**, **Sin cuenta**, **Sin SteamID** y **Verificados** (las que tienen insignia, que también se ve en la lista). En el detalle de una ficha editas su nick (si tiene cuenta, manda el alias de la cuenta), la foto, la biografía, los logros, sus SteamID, la cuenta vinculada y las medallas. En **Medallas** das una de Comunidad (staff, caster…) y, si quieres, le pones un título; las demás las da el juego. Los trofeos de torneo no se dan desde acá: son pines y llegan con cada torneo, también con los históricos (ver [Medallas](/help/admin/medallas)). La foto de la ficha se ve en toda la web hasta que el jugador sube una suya: gana la última que se subió.

## Insignia de verificado

En el perfil público de un jugador, los admins ven el botón **Verificar** (o **Insignia**, si ya tiene una). Elige:

- **Ninguna**: saca la insignia.
- **Gris**: cuenta verificada, por ejemplo después de confirmar quién es.
- **Dorada**: cuenta verificada destacada, para jugadores profesionales, casters, creadores de contenido o quien quieras destacar.

En **Qué se verificó** escribe lo que se lee en la ficha de la insignia, hasta 60 caracteres (por ejemplo, "Jugador profesional"). Vacío, dice "Verificación de identidad" en la gris y "Jugador destacado de la comunidad" en la dorada. Solo un admin la pone, la cambia o la saca: el jugador no la puede pedir desde la web. Qué es cada una lo explica [Cuentas verificadas](/help/jugador/cuentas-verificadas).

**Nueva ficha** crea un jugador sin cuenta, al que después le sumas SteamID o una cuenta.

## Agregar un SteamID a mano

En el detalle de la ficha, sección **SteamID**, toca **Agregar SteamID** y escribe el SteamID: `STEAM_0:X:Y`, SteamID64 o el link del perfil de Steam. Si la ficha ya tiene uno, el nuevo queda como adicional (hasta 4). Sus partidas pasan a la ficha y se recalcula su ELO.

Antes de agregarlo, la web revisa de quién es:

| Si el SteamID… | Qué ves |
|---|---|
| No es de ninguna ficha | Puedes agregarlo |
| Es de otra ficha | El nombre de esa ficha y **Abrir esa ficha**. No se puede agregar: primero quítalo de esa ficha y después vuelve a esta |
| Ya es de esta ficha | "Ese SteamID ya es de esta ficha" |

Sirve cuando un jugador no puede usar `!claim` porque le sale "Ese SteamID es de otra ficha": búscalo aquí y verás en cuál está.

## Pedidos de SteamID

Cuando un jugador llegó al tope de SteamID por ficha (hoy {{claim.max_steam_ids}}) y quiere sumar otro, o pide desvincular uno, el pedido aparece en **Pedidos de SteamID**:

- **Aprobar:** suma o quita el SteamID. Las partidas de ese SteamID pasan a la ficha (o vuelven a quedar sin ficha) y se recalcula el ELO de esa ficha; los demás no cambian.
- **Rechazar:** con un motivo opcional, que ve el jugador.

Ahí mismo cambias el **tope de SteamID por ficha**.

## SteamID sin vincular

**SteamID sin vincular** lista los SteamID que jugaron en nuestros servidores y no tienen ficha, con su último nick y sus partidas. Puedes crearles una ficha.

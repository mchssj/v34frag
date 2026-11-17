---
titulo: Manejar la tienda y los puntos
resumen: Cuánto se gana por mix, los precios, nombres, descripciones y si es VIP cada artículo del catálogo, sumar o restar puntos y monedas VIP, regalar o quitar artículos, quitar portadas y crear los códigos de los sorteos.
orden: 11
---

En Administración › [Tienda](/admin/shop) manejas la tienda de cosméticos: cuánto se gana, los precios y lo que tiene cada cuenta. Cada acción sobre una cuenta le llega como aviso, con el motivo, y queda en su historial.

## Cuánto se gana

En **Puntos y monedas VIP** cambias los puntos por mix, el extra por victoria, las monedas VIP por mix y por victoria, el multiplicador de puntos para los VIP, cuántos artículos salen en oferta cada semana y con qué descuento, lo que cuesta subir lo propio: el avatar animado y el fondo de miniperfil animado (en monedas VIP) y el fondo de miniperfil fijo (en puntos), y cuántos avatares y fondos de miniperfil propios guarda cada cuenta (5 y 5 al empezar). Toca **Guardar** y confirma.

En el mismo recuadro, **Lo VIP de un código se usa sin ser VIP** (encendido al empezar) deja que quien gana un artículo VIP en un sorteo lo use aunque no sea VIP. Apagado, ese artículo queda congelado hasta que la cuenta sea VIP, como lo VIP comprado. Cambia al instante para todo lo que ya se canjeó. Lo que la cuenta compra o le regalas sigue la regla de siempre.

> **Ojo:** los puntos se calculan con estos valores sobre todos los mixes, también los viejos: cambiarlos cambia el saldo de todas las cuentas al instante. Los precios de lo propio valen para lo que se suba desde ahora. Bajar el tope de lo guardado no borra nada: quien tiene más no puede subir otro hasta borrar los que sobran.

## Una cuenta

1. En **Cuentas**, busca por alias o nick. Puedes ordenar por puntos, monedas VIP o mixes, y filtrar las VIP.
2. Toca **Gestionar**.
3. Escribe el **Motivo** (obligatorio): lo ve la cuenta en el aviso y en su historial.
4. Elige qué hacer:
   - **Sumar o restar:** elige **Puntos** o **Monedas VIP**, escribe la cantidad (negativa para restar) y toca **Sumar** o **Restar**. El saldo puede quedar negativo; lo comprado no se pierde.
   - **Regalar artículo:** escribe el id del artículo (sale debajo del nombre en el catálogo, por ejemplo `marco-fuego`) y toca **Regalar artículo**. Puede ser uno que no está a la venta o uno VIP (ese se usa solo mientras la cuenta sea VIP). El Marco Oro VIP no se regala: viene con el VIP.
   - **Quitar** un artículo del inventario: también se le saca si lo tenía puesto. No le devuelve lo que pagó.
   - **Quitar portada**, si no respeta las reglas. También se quita desde el perfil del jugador, con **Quitar portada** (lo pueden hacer el soporte y los moderadores: ver [Quitar una foto de perfil, una portada o un logo](/help/soporte/quitar-fotos-y-logos)).
   - **Lo que subió:** todos sus avatares y fondos de miniperfil guardados; el que tiene puesto dice **puesto**. **Sacar** saca esa imagen (puesta o no), borra el archivo, cierra sus denuncias y le avisa. Las demás siguen guardadas. No le devuelve lo que pagó.

Las imágenes que denuncian los jugadores se revisan en Administración › Baneos, pestaña **Imágenes** (ver [Revisar imágenes denunciadas](/help/moderador/revisar-imagenes)).

Para dar o quitar el VIP, usa Administración › [Usuarios](/admin/users).

## El catálogo

En **Catálogo** buscas por nombre o id y filtras por tipo, por colección y por activos o inactivos.

- **Vista previa:** toca la miniatura o el nombre de un artículo. Lo ves en grande y cómo queda en el perfil, en la tarjeta del lobby y en una fila del ranking, con tu foto y tu nick.
- **Nombre, descripción y para quién es:** toca el lápiz al final de la fila, cambia lo que quieras y toca **Guardar**.
  - El nombre va de 1 a 60 caracteres y la descripción hasta 200; vacía, el artículo queda sin descripción. Es lo que ven los jugadores en la tienda.
  - **Para:** **Todos** se paga con puntos; **Solo VIP**, con monedas VIP y solo siendo VIP. Al cambiarlo cambia la moneda: escribe el precio nuevo (vacío, no se vende). Si pasa a Solo VIP, quien ya lo tiene lo conserva, pero sin ser VIP no lo puede usar. El Marco Oro VIP no cambia: viene con el VIP.
  - El id y el archivo no cambian.
- **Precio:** lo de todos se paga en puntos; lo VIP, en monedas VIP. Escribe el precio y sal del campo para guardarlo. Vacío: no se vende.
- **Activo:** apagado, el artículo no se ve en la tienda, pero quien ya lo tiene lo sigue usando.
- **Lo tienen:** cuántas cuentas lo tienen.

## Códigos y sorteos

Para un sorteo, creas un **código** y se lo pasas al ganador. Él lo canjea en la Tienda (ver [Usar la tienda y personalizar tu perfil](/help/jugador/tienda-y-cosmeticos)). Cada código da **un** premio; para un sorteo con varios premios, crea varios códigos.

1. En **Códigos y sorteos**, abajo de todo, toca **Nuevo código**.
2. Elige el **Premio**:
   - **Artículo de la tienda:** búscalo por nombre y elige **Para siempre** o **Por días** (de 1 a 365). Puede ser uno VIP (el ganador lo usa aunque no sea VIP, mientras esté encendido **Lo VIP de un código se usa sin ser VIP**) o uno que no está en la tienda, para un sorteo exclusivo. El Marco Oro VIP no: haz un código de VIP.
   - **Puntos** o **Monedas VIP:** la cantidad.
   - **VIP:** los días (atajos de 1 semana, 1 mes y 3 meses). Se suman a los que ya tenga la cuenta. El VIP de por vida se da en Administración › [Usuarios](/admin/users).
3. Elige cuántas veces se puede usar cada código (**Usos de cada código**) y cuántos generar (**Cuántos códigos**, hasta 100, todos con el mismo premio). Un código de 50 usos sirve para "los primeros 50 del stream"; para 10 ganadores distintos, mejor 10 códigos de 1 uso.
4. Si quieres, completa:
   - **Sirve desde** y **Sirve hasta:** antes de la primera fecha el código todavía no sirve; después de la segunda, vence. No es lo mismo que los días del premio.
   - **Solo para una cuenta:** busca al ganador por alias o nick. Nadie más lo puede usar.
   - **Código personalizado** (por ejemplo, `NAVIDAD-2026`, de 8 a 24 letras y números): se adivina más fácil que uno al azar. Úsalo solo con pocos usos o en un stream.
   - **Sorteo:** el nombre que verá el ganador en sus canjes (por ejemplo, "Sorteo Discord 17/11").
   - **Nota interna:** solo la ven los admins.
5. Revisa el resumen de abajo y toca **Generar**. Copia los códigos con **Copiar** o bájalos con **Bajar CSV**.

> **Ojo:** pásale el código al ganador por un canal privado. Si lo publicas en un canal abierto, el primero que lo escriba se lleva el premio.

En la lista ves cada código con su sorteo, su premio, los usos (**3 / 10**), cuándo vence y su estado: **Activo**, **Programado** (todavía no empieza), **Agotado**, **Vencido** o **Revocado**. Puedes buscar por código, sorteo o nota, y filtrar por estado. Toca el código para copiarlo.

- **Revocar:** el código deja de servir desde ahora, con un motivo. Lo que ya se canjeó no se quita.
- **Canjes:** quién lo canjeó y cuándo. **Revertir** un canje le quita el premio a esa cuenta (los puntos o las monedas, el período de VIP o el artículo, salvo que lo haya comprado después), con un motivo que le llega en un aviso. El código recupera ese uso, pero esa cuenta no lo puede volver a canjear.

Arriba de la lista están los **intentos fallidos** (códigos que no existen, revocados o que todavía no empiezan) y las cuentas bloqueadas ahora: 5 fallos en 15 minutos o 20 en un día bloquean el canje de esa cuenta un rato. Toca **Ver intentos** para el detalle, con los primeros 4 caracteres de lo que escribió cada uno. Si una cuenta prueba muchos, puede estar intentando adivinar códigos.

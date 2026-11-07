---
titulo: Servidores y sus usos
resumen: Dar de alta un servidor, su token y su licencia, para qué se usa (torneos, PCW, matchmaking) y el HUD para streamers.
orden: 1
---

Los servidores se manejan en Administración › [Servidores y ELO](/admin/servers), pestaña **Servidores**. Arriba ves cuántos están en línea, las licencias por vencer y lo que hay por revisar.

## Dar de alta un servidor

1. Toca **Nuevo servidor**.
2. Completa los datos:
   - **Nombre público** (de 2 a 40 caracteres), por ejemplo "CM League #4". Lo ve todo el mundo: el inicio, la sala de la partida y los avisos. Usa siempre un nombre genérico.
   - **Nombre interno** (opcional, de 2 a 60), por ejemplo "flow" o "MVZG": cómo lo llamamos nosotros. Solo se ve en Administración, y el buscador de la lista también lo encuentra.
   - **Mostrar en el inicio**: si sale en "Ahora en los servidores" de la página de inicio. Viene prendido.
   - **Dirección para conectarse**, la que usa el botón **Conectar**.
   - **Modo** y **Región**.
   - **Puerto de SourceTV**.
   - **Licencia vence**: la fecha hasta la que el servidor puede subir partidas.
3. Guarda. La web genera el **token** del servidor y las líneas para pegar.
4. Pega esas líneas en `cfg/sourcemod/csstv_reporter.cfg` del servidor y cambia de mapa.

Si es un servidor de otra persona, el detalle te da también lo necesario para su build licenciado (ver la sección **Dueño de un servidor externo** de la ayuda).

> **Ojo:** el token es la llave del servidor para subir partidas. No lo pegues en Discord ni en ningún lado público. Si se filtra, genera uno nuevo.

## El detalle de un servidor

Toca un servidor de la lista para ver sus datos, la licencia, el token, la IP permitida y sus últimas partidas. Desde ahí:

- **Guardar** cambios en sus datos.
- **Generar token nuevo:** el viejo deja de andar. Reemplázalo en el `csstv_reporter.cfg` y cambia de mapa.
- **Revocar** el servidor: deja de poder subir partidas. Un servidor con partidas no se borra: se revoca.
- **Mostrar en el inicio:** apágalo en los servidores que ya no se usan pero conservan sus partidas (los históricos). Siguen con su nombre en las partidas viejas, pero no salen en la página de inicio. En la lista llevan la marca **Oculto en el inicio**.

La lista se filtra por **En línea**, **Con avisos** y **Revocados**.

## Usos del servidor

En **Usos del servidor** marcas para qué sirve cada uno:

| Uso | Qué hace |
|---|---|
| **Torneos** | Aparece en **Iniciar la partida** de los organizadores |
| **PCW** | Lo toma la fila de PCW cuando los dos equipos están listos |
| **Matchmaking** | Recibe las salas de la cola |

Un servidor libre sirve para cualquiera de sus usos: el primero que lo pide se lo queda hasta terminar. La sección muestra si está libre, con una sala, reservado, en vivo o sin consultar.

## HUD para streamers

En el detalle del servidor, **HUD para streamers** prende el HUD de OBS para ese servidor:

1. Elige el **puerto del relay** y prende el HUD.
2. Genera la clave y toca **Copiar líneas**.
3. Pega esas líneas en el `csstv_hud.cfg` del servidor. El relay lo toma en 30 segundos.

La sección dice si están llegando datos y cuántos streamers lo están transmitiendo. **Sacar el HUD** lo apaga: el relay deja de atender ese servidor y los streamers que lo transmitían quedan sin datos.

Quién puede transmitir se decide en [Usuarios, roles y fichas](/help/admin/usuarios-y-fichas).

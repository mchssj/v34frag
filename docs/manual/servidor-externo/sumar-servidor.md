---
titulo: Sumar tu servidor a CMLeague
resumen: Qué necesitamos de ti, qué te mandamos, la licencia del servidor y qué cambia en tu servidor.
orden: 1
---

Si tienes un servidor de Counter-Strike: Source v34 y quieres que sus partidas cuenten en CMLeague (estadísticas, ELO, ranking, demos y clips), lo sumamos como **servidor externo**.

## 1. Pedirlo

Escríbele a un admin de CMLeague por Discord. Vamos a necesitar:

- La **IP y el puerto** del servidor.
- **Acceso a los archivos** del servidor: lo mejor es una API key del panel de tu hosting (Pterodactyl, por ejemplo); si no, un usuario de SFTP.
- Quién va a poder darnos la **consola** o cambiar la línea de arranque, si hace falta.

> **Ojo:** las claves y contraseñas pásaselas a un admin por mensaje privado, nunca en un canal público.

## 2. Lo que te mandamos

- Un **paquete** con el plugin de CMLeague armado para tu servidor (un build con tu licencia adentro), los demás plugins y la configuración obligatoria (ver [La configuración obligatoria](/help/servidor-externo/configuracion-obligatoria)).
- Las líneas del `csstv_reporter.cfg` con el **token** de tu servidor y su tag.

Si nos diste acceso a los archivos, lo instalamos nosotros. Si no, lo subes tú y nos avisas.

## 3. La licencia

El token de tu servidor es su licencia:

- El plugin la valida al cargar cada mapa y cada 30 minutos. Sin licencia válida, el servidor no deja empezar partidas y lo avisa en el chat.
- Está atada a la IP del servidor. Si cambias de IP o de hosting, avísanos antes.
- Tiene una fecha de vencimiento que acordamos contigo.
- Si nuestra web no responde un rato, el servidor sigue andando con la última validación buena durante 72 horas.

## Qué cambia en tu servidor

- Las partidas se suben solas a la web, con sus estadísticas, y suman al ELO y al ranking.
- El servidor puede recibir partidas del matchmaking, de torneos y de PCW, según los usos que marquemos. Mientras tiene una de esas partidas, la contraseña la maneja la web.
- Cuando actualizamos el plugin, lo actualizamos en todos los servidores a la vez, también en el tuyo. Nunca durante una partida: los cambios entran en el próximo cambio de mapa.

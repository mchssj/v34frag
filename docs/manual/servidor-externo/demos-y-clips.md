---
titulo: Demos y clips de tu servidor
resumen: Cómo llegan las demos de tu servidor a la web, qué necesitamos para bajarlas y qué pasa con el espacio en disco.
orden: 3
---

Con la demo de cada partida, los jugadores la pueden bajar desde la web y las mejores jugadas se graban como video (ver [Clips, demos y lo más destacado](/help/jugador/clips-y-demos)). Sin demo, la partida cuenta igual, pero sin video de las jugadas.

## Qué hace falta en tu servidor

- La **SourceTV** prendida en el arranque del servidor.
- La grabación de demos del plugin de CMLeague prendida.

Lo dejamos configurado al instalar. Si tu hosting no te deja cambiar la línea de arranque, se lo pedimos a quien maneje el servidor.

## Cómo llegan a la web

El servidor graba la demo de cada partida. Cada 10 minutos, nuestro sistema busca las demos nuevas y las sube a nuestro almacenamiento:

1. Primero, con la **API key del panel** de tu servidor.
2. Si no tenemos una, o falla, por **SFTP**.

Si no la encuentra, reintenta varias veces antes de marcarla como perdida.

> **Ojo:** si tu hosting tiene firewall, tiene que dejar entrar a nuestra máquina al panel o al SFTP. Te pasamos la IP al sumar el servidor.

## El espacio en disco

Después de subirla, la demo se borra de tu servidor. Así no se te llena el disco.

En la web, la demo se puede bajar durante 90 días. Después vence.

## Si cambias el acceso

Si cambias la API key del panel o la contraseña del SFTP, pásale la nueva a un admin por privado. Hasta entonces, las demos de tu servidor quedan esperando.

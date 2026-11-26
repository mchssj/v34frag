# Plan: banear una cuenta sin ficha

> Planeación original. Estado: **aprobado** por Daniel el 2026-11-26 (escrito junto con la implementación, el mismo día).

Daniel no podía banear a Tormenta, una cuenta con correo de `afronewz.com` (multicuenta de un cheater): el diálogo de baneo solo busca **fichas**, y Tormenta nunca buscó partida, así que no tiene. De las 6 cuentas con correo bloqueado, 2 están así. Además, el diálogo decía que el baneo echa del servidor y mencionaba `!syncbans`, que no existe (el plugin que aplicaría los baneos en los servidores nunca se hizo: ver [`2026-11-26-baneos-en-los-servidores`](../2026-11-26-baneos-en-los-servidores/)).

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Cómo | Solo en la web: el diálogo busca también cuentas sin ficha y, al banear una, le crea la ficha (`POST /api/v1/admin/players` con `user_id`, nick = alias) y banea esa ficha | Las dos piezas ya existen en la API; sin cambios en la base ni en la API |
| Quién | Solo admins (el listado de cuentas es de Administración) | |
| También | El panel de una cuenta en Administración › Usuarios muestra **Banear** aunque no tenga ficha | |
| Texto | El diálogo, la página de Baneos y el manual del moderador dicen lo que pasa hoy: el baneo saca del matchmaking; en los servidores, `!ban` en cada uno | Daniel: "corregirlo ya" |

## Orden

1. `BanDialog` (cuentas sin ficha y texto), `AdminBansPage` (texto), `AccountsTab` (Banear sin ficha) y pruebas.
2. Manual: `moderador/banear-jugador.md` y `admin/usuarios-y-fichas.md`.
3. Web.

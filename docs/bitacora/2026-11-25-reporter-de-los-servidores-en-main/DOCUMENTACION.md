# El reporter de los servidores, en main: documentación

## Qué hace

Deja en `main` el `csstv_reporter` **2.10.2**, el que corre en #1, #2 y #3 desde el 2026-11-13. Estaba solo en `kyan/pruebas`; `main` tenía la 2.10.0.

| Qué suma a la 2.10.0 | Archivo | Detalle |
|---|---|---|
| La ronda de cuchillo que termina por tiempo la gana el lado con más vida | `csstv/knife.inc` | [`2026-11-12-cuchillo-por-vida-y-nombre-web`](../2026-11-12-cuchillo-por-vida-y-nombre-web/) |
| En los mixes y el matchmaking se entra listo solo (`csstv_auto_ready`, 1 por defecto) | `csstv/autoready.inc` | [`2026-11-13-ready-automatico`](../2026-11-13-ready-automatico/) |
| El nombre de la ficha en el servidor (`csstv_web_names`, 1 por defecto) | `csstv/webnick.inc`, `csstv/claim.inc` | La misma del cuchillo. **No funciona todavía**: falta `csstv_web_nick` en la base de producción (replanteo `134`, sin aplicar). Mientras tanto cada uno queda con su nombre, y cada entrada deja un error en `errors_*.log` |

Las dos carpetas de Kyan se copiaron sin los `.smx`. Donde nombran el replanteo `113`, en `main` es el `134` (la `113` es otra cosa). Las versiones 2.12.0 y 2.12.1 que mencionan son de `kyan/pruebas` y no están en `main`.

## Qué cambia para cada rol

Nada nuevo en los servidores. El manual ahora cuenta lo que ya pasaba:

| Rol | Qué cambia | Página del manual |
|---|---|---|
| Jugador | Entra listo solo en mixes y matchmaking; el cuchillo por tiempo se gana por vida | `jugador/jugar-en-el-servidor.md`, `jugador/comandos-en-el-servidor.md` y `jugador/buscar-partida.md` |
| Capitán | El cuchillo por vida | `capitan/comandos-en-el-servidor.md` |
| Los demás | Nada | — |

## Términos y privacidad

Sin cambios. Lo del nombre de la web va con el replanteo `134`.

## Dónde está cada cosa

| Qué | Archivo / ubicación |
|---|---|
| Código | `server/addons/sourcemod/scripting/csstv_reporter.sp` y `csstv/` |
| Binario | `server/addons/sourcemod/plugins/csstv_reporter.smx` |
| Reporter 2.11.0 sin commit | Rama local `archivo/reporter-2.11.0` |

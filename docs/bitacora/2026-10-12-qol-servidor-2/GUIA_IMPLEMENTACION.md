# QoL del servidor, segunda tanda: guía de implementación

## Estado

Plugin 1.4.0 probado el 2026-10-12 en el servidor local, con bots y con Daniel conectado con un cliente v34 real (ClientMod). **Subido al servidor real por SFTP el 2026-10-12**; se carga en el próximo cambio de mapa. Falta verificar con `sm_csstv_status` en la consola del panel.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv/rr.inc` | Nuevo: `!rr` (foto de la ronda y restauración) |
| `server/addons/sourcemod/scripting/csstv/qol.inc` | Equipos bloqueados (`jointeam`, `chooseteam`, `joinclass`), `!team`, contador de vivos, puntos de la bomba, créditos y sus cvars |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | Versión 1.4.0; `MoveToTeam` sale de `SwapTeams` para usarla también en `!team`; `PURPOSE_REROUND`; evento `bomb_exploded`; llamadas a `rr.inc` |
| `server/addons/sourcemod/plugins/csstv_reporter.smx` | Compilado 1.4.0 (sin `CSSTV_DEBUG`) |
| `server/cfg/sourcemod/csstv_reporter.cfg` | Cvars nuevos: `csstv_alive_hud`, `csstv_lock_teams`, `csstv_bomb_frags`, `csstv_credits_interval` |
| `docs/GUIA_SERVIDOR.md` | "Durante la partida" y "Comandos" con lo nuevo |
| `docs/bitacora/2026-10-12-qol-servidor-2/pruebas/` | Plugin de prueba de armas y HUD, y escenarios de `!rr` con bots |

## Despliegue (hecho el 2026-10-12)

Por SFTP, con las credenciales `SFTP_CSS_*` del `.env` y un script con `paramiko` (en un entorno virtual aparte). El plugin no se recargó, para no cancelar una partida en curso.

1. Respaldar el plugin actual en el servidor real: `plugins/csstv_reporter.smx` → `plugins/disabled/csstv_reporter_1.3.0.smx` (47256 bytes, igual al de la 1.3.0 del repo).
2. Subir `server/addons/sourcemod/plugins/csstv_reporter.smx` (1.4.0).
3. Agregar al `cfg/sourcemod/csstv_reporter.cfg` del servidor:
   ```
   csstv_alive_hud "1"
   csstv_lock_teams "1"
   csstv_bomb_frags "3"
   csstv_credits_interval "720"
   ```
   Son los valores por defecto; agregarlos solo deja a la vista que se pueden cambiar. Se agregaron al final, bajo `// --- 1.4.0 ---`, con respaldo en `cfg/sourcemod/csstv_reporter.cfg.bak-1.3.0`.
4. Se carga en el próximo cambio de mapa (o con `sm plugins reload csstv_reporter`, que cancela la partida en curso). Verificar con `sm_csstv_status` que diga `v1.4.0`.

No hace falta migrar Supabase ni desplegar la web ni el Worker.

## Pruebas

Todas en el servidor local (`E:\CSS DEDICATED SERVER\server`) con `csstv_send 0`, compilando con `CSSTV_DEBUG=` para tener los logs de depuración.

### Prueba rápida de v34 (`pruebas/csstv_spike_armas.sp`)

| Qué | Resultado |
|---|---|
| `GivePlayerItem` (armas, granadas, `item_assaultsuit`, `item_defuser`) | Funciona con la gamedata que trae SourceMod |
| `RemovePlayerItem` | Funciona |
| `HudMsg` / `CreateHudSynchronizer` | El mensaje existe (id 6) |
| `KeyHintText` | **No existe en v34** (id -1); por eso el modo 2 del contador usa `PrintCenterText` |

### `!rr` con bots en `$2000$` (`pruebas/escenario_rr.sh`, `pruebas/escenario_rr_fin_ronda.sh`)

| Caso | Resultado |
|---|---|
| `!rr` a mitad de la ronda 2 | Plata, armas, balas del cargador y reservas iguales a la foto del inicio; marcador 1-0 igual |
| `!rr` después del fin de la ronda 2 | Marcador de 2-0 vuelve a 1-0 y el encabezado vuelve a "Ronda 2/6" |
| Equipamiento completo (chaleco 100 con casco, kit, 2 flashes, HE, AK con 30 balas) | Todo vuelve igual |
| Kills y muertes del TAB | Vuelven a los valores del inicio de la ronda (Jeff 1/2 → 0/1, Xander 1/0 → 0/0, Steve 1/1 → 1/0) |

### Con Daniel conectado (cliente v34 con ClientMod)

| Qué | Resultado |
|---|---|
| Contador de vivos arriba al centro | Se ve. En la primera versión aparecía unos segundos; Daniel pidió que quede fijo y se cambió (ver abajo) |
| Elegir modelo en el menú del medio tiempo estando vivo | El plugin frena el `joinclass` (log: `clase 5 · equipo 3 · vivo 1`) y Daniel siguió vivo |
| `M` durante la partida | Bloqueado con el mensaje |
| Créditos | Aparecen en el chat |
| `!rr` y `!team` en de_dust2 | "Todo funcionó bien" (Daniel) |

### Puntos de la bomba, con bots en de_dust2

Ron (T, sin kills) plantó y la bomba explotó. Log: `TAB 3 en el evento, 3 después; queda en 0`. El juego suma los puntos **antes** del evento; el descuento se hace igual 0.1 s después, así que funciona en los dos órdenes. La desactivación no se llegó a ver con bots: usa el mismo código.

## En qué se apartó del plan

- **`!team` (nuevo).** Al ver el mensaje del bloqueo, Daniel preguntó cómo lo mueve un admin. SourceMod no trae ese comando de base, así que se agregó al plugin.
- **Contador de vivos fijo.** El plan aprobado lo mostraba al inicio de la ronda y 3 segundos después de cada muerte, con `csstv_alive_hud_time`. Después de verlo, Daniel prefirió que esté siempre: se reenvía cada segundo y se quitó `csstv_alive_hud_time`.
- **Modo 2 del contador.** El plan proponía `KeyHintText` (arriba a la derecha), pero no existe en v34; se usa `PrintCenterText`.
- **Puntos de la bomba en el TAB (nuevo).** Pedido por Daniel durante la prueba: `csstv_bomb_frags`.
- **Sin plan B de `!rr`.** `GivePlayerItem` y `RemovePlayerItem` funcionan en v34, así que se devuelven las armas y no su valor en plata.

## Incidentes durante las pruebas

- **Partidas de bots en la cola local.** Recargar el plugin con una partida en curso la cancela y guarda el resultado en la cola. Con `csstv_send 0` no se envió nada. Los archivos se borraron de `data/csstv/queue/` y, al final, el `csstv_reporter.cfg` local volvió a su `csstv_send "1"` original.
- **`$2000$` no tiene zona de compra.** Para probar `!rr` comprando, Daniel usó de_dust2.

## Cómo revertir

1. En el servidor, volver a poner `plugins/disabled/csstv_reporter_1.3.0.smx` como `plugins/csstv_reporter.smx` (y, si se quiere, `csstv_reporter.cfg.bak-1.3.0` como `csstv_reporter.cfg`) y cambiar de mapa. Los cvars nuevos del cfg se pueden dejar: sin el plugin 1.4.0 no existen y el servidor los ignora.
2. En el repo: `git revert` del commit de esta tanda.

Para apagar una sola mejora sin revertir: `csstv_lock_teams 0`, `csstv_alive_hud 0`, `csstv_bomb_frags 0` o `csstv_credits_interval 0`.

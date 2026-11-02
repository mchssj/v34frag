# Aviso de arranque, pausa automática y charla del medio tiempo: guía de implementación

## Estado

Probado con bots en local y **subido el 2026-11-02 como 2.7.3 a flow y MVZG, y a `disabled/` en `aurav34`**. Entra en el próximo cambio de mapa. Falta la prueba con jugadores.

**2.7.4 (2.8.3 en `kyan/pruebas`):** cambia la charla del medio tiempo, porque con la 2.7.3 Kyan casi no pudo comprar en la primera ronda de la mitad (ver "Cambio a la 2.7.4"). **Subida el 2026-11-02 a flow, MVZG y `disabled/` en `aurav34`.** En MVZG reemplazó al 2.8.2 de matchmaking de Daniel, por decisión de Kyan.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv/qol.inc` | Pausa automática, campana y charla |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | Versión 2.8.1 y llamadas |
| `server/addons/sourcemod/scripting/csstv/knife.inc` | Aviso al empezar el cuchillo |
| `server/cfg/sourcemod/csstv_reporter.cfg` | Tres ConVars nuevas |

## Despliegue (hecho el 2026-11-02)

La 2.8.x trae matchmaking sin desplegar, así que producción recibió la **2.7.3**: la 2.7.2 (`6898c05`) con estos cambios. El código está en `pruebas/reporter-2.7.3.patch`: para recompilarla, `git worktree add --detach <carpeta> 6898c05`, `git apply` del parche ahí y `server/build_licenciado.sh` (o `spcomp` para el genérico). La rama `kyan/reporter-2-7-3` donde se commiteó primero se borró el 2026-11-02, a pedido de Kyan. `kyan/pruebas` queda con los mismos cambios como 2.8.1. Kyan avisó a Daniel.

| Servidor | Acceso | Qué se subió |
|---|---|---|
| flow (`#2`) | `SERVER2_*` | Build licenciado (`7b01c85b-…`), 126816 bytes, y cfg |
| MVZG (`#1`) | `SERVER3_*` | Build licenciado (`96bb5060-…`), 126814 bytes, y cfg |
| `aurav34` (`#3`) | `SFTP_CSS_*` | Genérico en `plugins/disabled/csstv_reporter.smx`, 126759 bytes, y cfg. Corre solo retake: **el reporter sigue desactivado** |

Se comparó cada archivo subido con el original. No se recargó nada: entra en el próximo cambio de mapa.

Respaldos: `plugins/disabled/csstv_reporter_2.7.2.smx` y `cfg/sourcemod/csstv_reporter.cfg.bak_autopause` en cada servidor.

## Cambio a la 2.7.4

En la 2.7.3 la charla estiraba 10 s el freezetime de la primera ronda de la mitad y bloqueaba la compra. `mp_buytime 0.25` (15 s) cuenta desde que empieza el freezetime, y en los servidores el freezetime es de 15 s (`mp_freezetime 15` en el `live.cfg` de flow y MVZG; el del repo dice 6). Así que, al terminar la charla, quedaban unos 2 s para comprar.

Kyan pidió que el alltalk empiece al terminar la última ronda, que la siguiente tarde 10 s y que el alltalk se apague cuando quedan 10 s de freezetime. Cómo quedó está en la documentación. Además hay una ConVar nueva, `csstv_half_alltalk_off "10"`, que va en el cfg de cada servidor.

- Código de producción: `pruebas/reporter-2.7.4.patch`, desde `6898c05`, igual que el de la 2.7.3.
- Builds compilados el 2026-11-02: licenciado de flow, 127090 bytes; licenciado de MVZG, 127091 bytes; genérico, 127041 bytes.
- Despliegue del 2026-11-02, sin recargar nada (entra en el próximo cambio de mapa). Se comparó cada archivo subido con el original.

| Servidor | Qué se subió | Respaldo |
|---|---|---|
| flow (`#2`, `SERVER2_*`) | Build licenciado 2.7.4 y la línea nueva del cfg | `plugins/disabled/csstv_reporter_2.7.3.smx` y `cfg/sourcemod/csstv_reporter.cfg.bak_274` |
| `aurav34` (`#3`, `SFTP_CSS_*`) | Genérico 2.7.4 en `plugins/disabled/` (el reporter sigue desactivado) y la línea del cfg | Los mismos |
| MVZG (`#1`, `SERVER3_*`) | Build licenciado 2.7.4 (127091 bytes) y la línea del cfg. Ahí corría un 2.8.2 licenciado para MVZG (136613 bytes), el matchmaking de Daniel (`feat/mm-claim-en-sala`, sobre la 2.8.1), con la charla de la 2.7.3. Kyan decidió subir la 2.7.4 igual, así que **MVZG queda sin el matchmaking** hasta que se arme un 2.8.x con este cambio | `plugins/disabled/csstv_reporter_2.8.2_mm.smx` (el 2.8.2 de Daniel) y `cfg/sourcemod/csstv_reporter.cfg.bak_274` |

## Pruebas

### Con bots (`C:\Users\Agus\Downloads\cssds`, 2026-11-02)

Con `pruebas/escenario.sh`, en la 2.8.1 y en la 2.7.3, build `CSSTV_DEBUG`, `csstv_send 0` y la URL de Supabase apuntando a `127.0.0.1`, sin contacto con la base real. El cfg del servidor local se restaura al terminar.

| Caso | Resultado |
|---|---|
| Se va a mitad de ronda y vuelve antes | Sin pausa y sin gastarla |
| Se va en freezetime | Pausa; "Volvió el jugador" a los 6 s, al volver |
| Se va otro después | Sin pausa |
| Partida nueva, se va a mitad de ronda y no vuelve | Pausa en la próxima ronda, termina por tiempo (12 s de prueba) |
| Medio tiempo (2.7.3) | `sv_alltalk` en 1 durante 10 s, y de nuevo en 0 |
| Medio tiempo (2.8.3 y 2.7.4, `pruebas/medio_tiempo.sh`, freezetime 15) | Fin de la mitad 14:52:05, ronda nueva con los lados cambiados 14:52:15 (sin una ronda intermedia a los 5 s) y alltalk apagado 14:52:20. Medido desde el `bot_kill`: `sv_alltalk` en 1 hasta +15/16 s y después en 0 |

### Falta probar con jugadores

Se subió sin esta prueba, por decisión de Kyan. Los bots no prueban lo siguiente:

1. La campana se escucha, incluso con el juego en segundo plano. El motor puede silenciar el juego sin foco.
2. El texto en el centro aparece.
3. En el medio tiempo se oye al otro equipo por voz desde el final de la ronda hasta que quedan 10 s de freezetime.
4. En la primera ronda de la mitad se puede comprar durante todo el freezetime.
5. Un jugador real se desconecta y vuelve: la pausa termina al volver y sigue en su equipo.

## En qué se apartó del plan

- La charla del medio tiempo se pidió durante la implementación, y en la 2.7.4 se rehízo como se cuenta arriba.
- La campana suena tres veces, porque dura 0,69 s y se pidió que se escuche bien.

## Incidentes durante las pruebas

La vuelta del jugador no se detectaba si ya entraba en su equipo, porque `Recon_Place` salía antes de avisar. Se corrigió y se repitió la prueba.

## Cómo revertir

Poner `csstv_autopause "0"` y `csstv_half_alltalk "0"` en el cfg. Para sacar también la campana, volver a poner `plugins/disabled/csstv_reporter_2.7.2.smx` como `csstv_reporter.smx` en el cambio de mapa.

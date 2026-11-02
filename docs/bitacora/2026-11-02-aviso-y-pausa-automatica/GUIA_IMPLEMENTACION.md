# Aviso de arranque, pausa automática y charla del medio tiempo: guía de implementación

## Estado

Probado con bots en local y **subido el 2026-11-02 como 2.7.3 a flow y MVZG, y a `disabled/` en `aurav34`**. Entra en el próximo cambio de mapa. Falta la prueba con jugadores.

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

## Pruebas

### Con bots (`C:\Users\Agus\Downloads\cssds`, 2026-11-02)

Con `pruebas/escenario.sh`, en la 2.8.1 y en la 2.7.3, build `CSSTV_DEBUG`, `csstv_send 0` y la URL de Supabase apuntando a `127.0.0.1`, sin contacto con la base real. El cfg del servidor local se restaura al terminar.

| Caso | Resultado |
|---|---|
| Se va a mitad de ronda y vuelve antes | Sin pausa y sin gastarla |
| Se va en freezetime | Pausa; "Volvió el jugador" a los 6 s, al volver |
| Se va otro después | Sin pausa |
| Partida nueva, se va a mitad de ronda y no vuelve | Pausa en la próxima ronda, termina por tiempo (12 s de prueba) |
| Medio tiempo | `sv_alltalk` en 1 durante 10 s, y de nuevo en 0 |

### Falta probar con jugadores

Se subió sin esta prueba, por decisión de Kyan. Los bots no prueban lo siguiente:

1. La campana se escucha, incluso con el juego en segundo plano. El motor puede silenciar el juego sin foco.
2. El texto en el centro aparece.
3. En el medio tiempo nadie puede moverse ni comprar durante los 10 s, y se oye al otro equipo por voz.
4. Después de la charla queda el freezetime normal y se puede comprar.
5. Un jugador real se desconecta y vuelve: la pausa termina al volver y sigue en su equipo.

## En qué se apartó del plan

- La charla del medio tiempo se pidió durante la implementación.
- La campana suena tres veces, porque dura 0,69 s y se pidió que se escuche bien.

## Incidentes durante las pruebas

La vuelta del jugador no se detectaba si ya entraba en su equipo, porque `Recon_Place` salía antes de avisar. Se corrigió y se repitió la prueba.

## Cómo revertir

Poner `csstv_autopause "0"` y `csstv_half_alltalk "0"` en el cfg. Para sacar también la campana, volver a poner `plugins/disabled/csstv_reporter_2.7.2.smx` como `csstv_reporter.smx` en el cambio de mapa.

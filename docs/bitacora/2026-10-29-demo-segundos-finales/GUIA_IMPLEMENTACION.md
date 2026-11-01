# La demo sigue grabando unos segundos después del final del mix: guía de implementación

## Estado

**Desplegado el 2026-10-30 como reporter 2.7.1** en **el real y flow**, en la misma tanda (RBK dejó de usarse el 2026-10-29). Se carga en el próximo cambio de mapa de cada servidor. Sin commit.

Falta:
1. Ver en el primer mix de cada servidor que el log diga 2.7.1 y que la demo termine unos 5 s después del final (con `render/leer_demo.py`).
2. Publicar `CHANGELOG_DISCORD.txt`.

## Por qué la 2.7.1 (2026-10-30)

El cambio se hizo el 2026-10-29 a las 23:01, después de compilar los builds de la 2.7.0 (20:17 y 20:59), y esos builds viejos fueron los que se desplegaron con las medallas. Daniel lo notó el 2026-10-30: su clutch 1vs2 de la ronda 29, la última del mix de tuscan en flow (`flow-20261030T184103-029a`, 16-13), se cortaba 1 o 2 s antes de la última kill. La inspección confirmó que el real y flow tenían los md5 de la 2.7.0 (`1f74ced7` y `f02def68`). Para distinguirla, la versión pasó a 2.7.1; el único cambio respecto de la 2.7.0 desplegada es este.

Ese clip no se arregla con el plugin: su demo ya terminó en la última kill. Necesita el render que llega al último tick (`PENDIENTES.md`, punto 1.32) y un reproceso.

## Builds y despliegue (2026-10-30)

| Servidor | Archivo | md5 |
|---|---|---|
| Real | `server/addons/sourcemod/plugins/csstv_reporter.smx` | `9418edaa` |
| flow | `server/licencias/flow/csstv_reporter.smx` (`build_licenciado.sh 7b01c85b-… flow`) | `087ffe0b` |

Con [`pruebas/desplegar_2_7_1.py`](pruebas/desplegar_2_7_1.py) (`paramiko` en un entorno virtual del scratchpad), primero `inspect` y después `apply`:
- la 2.7.0 quedó en `plugins/disabled/csstv_reporter_2.7.0.smx` en los dos, y se borró `disabled/csstv_reporter_2.5.0.smx` (quedan como mucho 3 anteriores);
- el md5 se verificó bajando el archivo de nuevo;
- el cfg no cambió. Copia local de las 2.7.0 en el scratchpad de la sesión.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv/qol.inc` | El corte pendiente: `DEMO_TAIL_SECONDS` (5 s), `g_hDemoStopTimer`, `Demo_StopLater` y `Timer_DemoStop`. `Demo_Stop` borra el timer y `Demo_Start` corta antes una demo que siga grabando |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | `FinishMatch` llama a `Demo_StopLater` |

## Prueba con bots (2026-10-29)

En el servidor local (tickrate 66), con el build normal de la 2.7.0 con este cambio.
- Antes: se respaldaron `csstv_reporter.cfg` y el `.smx`, y la cola estaba vacía.
- El cfg de prueba tenía `csstv_send "0"` y `csstv_api_url` apuntando a `127.0.0.1:9`, una dirección que no responde, así que nada pudo llegar a producción.
- También `csstv_include_bots "1"`, `csstv_min_players "2"` y `csstv_ready_system "0"`.
- Seis bots y `sm_live mr3` por RCON.

| Prueba | Resultado |
|---|---|
| Mix terminado 1-4 (`srv1-20261029T230650-ee79`) | El aviso de fin a las 23:12:36 y la demo cerrada a las 23:12:41. Con `leer_demo.py`, la demo llega **330 ticks (5,0 s) después del último `round_end`**, sin errores de lectura |
| Mix terminado 0-4 y `changelevel` 1,8 s después (`srv1-20261029T231318-7243`) | La demo se cerró con el cambio de mapa (0,76 s después del final). En de_inferno no empezó otra grabación, y el log de errores no tiene nada del timer |

- En el log de errores solo aparece "No se pudo validar la licencia: sin conexión", por la URL muerta del cfg de prueba.
- Después se restauraron el cfg y el `.smx`, idénticos byte a byte. Los dos resultados de la cola y las dos demos de prueba se sacaron del servidor local y quedaron en el scratchpad de la sesión.

## Cómo revertir

Volver a `plugins/disabled/csstv_reporter_2.7.0.smx` en el real y flow (se carga en el próximo cambio de mapa). En el código:

En `FinishMatch`, volver a `Demo_Stop()`. El resto puede quedar: sin `Demo_StopLater`, el timer nunca se crea.

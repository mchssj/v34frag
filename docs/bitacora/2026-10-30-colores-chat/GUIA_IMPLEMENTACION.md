# Colores del chat: guía de implementación

## Estado

**Desplegado el 2026-10-30 como reporter 2.7.2** en **el real y flow**, en la misma tanda. Se carga en el próximo cambio de mapa de cada servidor. Probado con bots el mismo día (el texto). Sin commit.

Falta:
1. Ver los colores en el primer mix de cada servidor (con ClientMod y sin él) y que el log diga 2.7.2.
2. Publicar `CHANGELOG_DISCORD.txt`.
3. Pasarle el artifact a kyan para el retake.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv/qol.inc` | Etiqueta `{#gris}`. `Qol_DamageReport` con el formato nuevo y `DamageAmount`. `Qol_TeamMoney` sin total, una línea por jugador, con `Tú` y `ColoredMoney`. Se quitaron `PrintTeamLine` y `PrintToTeam`, que ya no se usaban |
| `server/addons/sourcemod/scripting/csstv/stats.inc` | `g_bPrevAlive[]`, que llena `Stats_SnapshotRound` |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | `PLUGIN_VERSION` 2.7.2 |
| `server/addons/sourcemod/plugins/csstv_reporter.smx` | Build genérico de la 2.7.2 |

## Compilación

Con el spcomp 1.8 del servidor local, sin errores ni avisos:

```bash
S="/e/CSS DEDICATED SERVER/server/cstrike/addons/sourcemod/scripting"
cd server/addons/sourcemod/scripting
"$S/spcomp.exe" csstv_reporter.sp -i"$S/include" -o"../plugins/csstv_reporter.smx"
```

## Pruebas

### Con bots en el servidor local (2026-10-30)

Con el build de depuración de la 2.7.2 (`CSSTV_DEBUG=`), que escribe en el log cada mensaje de chat de cada jugador (bots incluidos) sin las etiquetas de color.

- **Antes:** se respaldaron `csstv_reporter.cfg` y el `.smx`. La cola estaba vacía.
- **cfg de prueba:**
  - `csstv_send "0"` y `csstv_api_url "http://127.0.0.1:9/rest/v1/rpc/ingest_server_chunk"`, una dirección que no responde, así que nada pudo llegar a producción. La URL tiene que llevar `/rpc/`: sin eso la licencia queda "falta configurar" y no deja empezar.
  - `csstv_include_bots "1"`, `csstv_min_players "2"` y `csstv_ready_system "0"`.
  - Con `sm_csstv_license` la licencia queda en gracia (última validación buena de hace 26 h).
- **Partida:** seis bots (3 contra 3) y `sm_live mr3` por RCON (`srv1-20261030T221303-4e9d`), 4 rondas y después `sm_cancelmatch`.

| Prueba | Resultado |
|---|---|
| Reporte de daño | 11 reportes, cada uno con su título `— Daño de la ronda —`. Ejemplo para Kevin: `Dado 100 en 3 · Recibido 39 en 3 · Steve muerto`, `Dado 0 · Recibido 19 en 1 · Mike vivo` |
| Vivo o muerto | 12 `vivo` y 16 `muerto`. Los `vivo` son los que quedaron vivos en el equipo ganador de la ronda |
| Plata del equipo | Una línea por compañero, de mayor a menor, y `Tú` en la propia (18 veces). No salió ninguna línea con el total |
| Formato viejo | Ni "Damage Given" ni "Plata del equipo" en el log |
| Errores | Ninguno del reporter, salvo "No se pudo validar la licencia: sin conexión", por la URL muerta |

- **Sin probar:**
  - Los colores en sí: los mensajes a los bots no se envían y el log los guarda sin etiquetas. Falta que alguien entre al servidor con ClientMod y sin él.
  - Los montos en verde y amarillo: los bots nunca juntaron $2.500 en esas rondas.
- **Después:** se restauraron el cfg y el `.smx`, idénticos byte a byte (md5). El resultado de la cola y la demo de prueba se sacaron del servidor local y quedaron en el scratchpad de la sesión.

## Despliegue (hecho el 2026-10-30)

Pedido por Daniel. El build de flow se compiló de nuevo desde el código de la 2.7.2 antes de subir:

```bash
bash server/build_licenciado.sh 7b01c85b-bc3e-4aa3-9ab5-3c2044157034 flow
```

| Servidor | Archivo | md5 |
|---|---|---|
| Real | `server/addons/sourcemod/plugins/csstv_reporter.smx` (genérico) | `5d2136e7` |
| flow (CMLeague #3) | `server/licencias/flow/csstv_reporter.smx` (licenciado) | `ba676761` |

Con [`pruebas/desplegar_2_7_2.py`](pruebas/desplegar_2_7_2.py) (`paramiko` en un entorno virtual del scratchpad), primero `inspect` y después `apply`:

- los dos tenían la 2.7.1 (`9418edaa` en el real, `087ffe0b` en flow), que quedó en `plugins/disabled/csstv_reporter_2.7.1.smx`;
- se borró `disabled/csstv_reporter_2.6.0.smx` en los dos (quedan como mucho 3 anteriores);
- el md5 se verificó bajando el archivo de nuevo;
- el cfg no cambió y el plugin no se recargó: se carga en el próximo cambio de mapa. Copia local de las 2.7.1 en el scratchpad de la sesión.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

Volver a `plugins/disabled/csstv_reporter_2.7.1.smx` en el real y en flow (se carga en el próximo cambio de mapa), o revertir los cambios de `qol.inc`, `stats.inc` y `csstv_reporter.sp` y recompilar.

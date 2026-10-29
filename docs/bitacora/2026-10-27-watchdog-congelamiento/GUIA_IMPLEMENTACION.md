# Watchdog para tener un volcado cuando el servidor real se congela: guía de implementación

## Estado

**Desplegado en el #1 y en modo normal desde el 2026-10-27, 02:31** (hora del servidor). Probado de punta a punta en el #1 con el servidor vacío: congelamiento, `SIGABRT`, volcado, reinicio y subida a R2 (`20261027T052710-8ee924f6`). Falta el primer congelamiento real.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/watchdog/watchdog.sh` | Nuevo: el watchdog |
| `server/watchdog/.gitattributes` | `*.sh` con LF (con `core.autocrlf` el checkout le pondría CRLF y bash fallaría) |
| `docs/bitacora/2026-10-27-watchdog-congelamiento/pruebas/parchear_srcds_run.py` | Agrega la línea del watchdog a `srcds_run` antes de `run`; no la repite |
| `.../pruebas/desplegar_watchdog.py` | `inspect` y `apply` por SFTP (`SFTP_CSS_*`), con md5 verificado y reemplazo por renombre |
| `.../pruebas/prueba_docker.sh` y `juego_falso.pl` | La prueba en Docker con la imagen del panel |
| `.../pruebas/.gitattributes` | `.sh` y `.pl` con LF |
| En el #1 | `watchdog.sh`, `srcds_run` (con la línea), `srcds_run.bak_20261026`, `core.cfg` con `MinidumpUrl` por http y `core.cfg.bak_20261027` |

## Despliegue (hecho el 2026-10-27)

1. **Averiguar cómo arranca el panel.** Kyan no lo sabe: es cliente de extremehost, como nosotros. Se averiguó con la API de cliente de Pterodactyl (`PTERO_PANEL_*`, solo lectura):
   - `GET /api/client/servers/{id}` y `/startup`;
   - comando fijo `./srcds_run -game cstrike ... -port 27062 -tickrate 101 ...`;
   - imagen `ulisesadrian/debian7-css:v34`;
   - `threads: 2`.

   La imagen se bajó y tiene `bash` 4.2 con `/dev/udp`, `timeout`, `pidof`, `kill`, `dd`, `od` y `awk`. No tiene `pgrep` ni `ps`. Su `entrypoint.sh` hace `eval` del comando en `/home/container`.
2. **Prueba en Docker** con la imagen del panel, el `srcds_run` real parcheado y el juego falso: 31 comprobaciones en verde (sección "Pruebas").
3. **Subirlo en modo de prueba:**

   ```bash
   python -I docs/bitacora/2026-10-27-watchdog-congelamiento/pruebas/desplegar_watchdog.py inspect <carpeta>
   python -I docs/bitacora/2026-10-27-watchdog-congelamiento/pruebas/desplegar_watchdog.py apply <carpeta>
   ```

   Primero crea `watchdog_dry`, después sube `watchdog.sh` y por último reemplaza `srcds_run`, dejando la copia. Los dos se suben como archivo nuevo y se renombran encima: bash lee el script mientras lo ejecuta, y pisar el que corre lo rompería. Se subió dos veces: la primera sin el disparador de prueba y la segunda con él.
4. **Reiniciar el contenedor** desde el panel con **Kill** y **Start** (ver "Incidentes").
5. **Medir los cambios de mapa:** tres `changelevel` (`de_tuscan`, `de_season` y `de_dust2_ob`), sin ninguna consulta sin respuesta.
6. **Prueba de punta a punta:** crear `cstrike/cfg/csstv/watchdog_test` por SFTP. La primera vez la subida falló por HTTPS (ver "Incidentes").
7. **`core.cfg`:** la `MinidumpUrl` pasa de `https://` a `http://` (una línea, con copia). Se repite la prueba: `Uploaded crash dump`.
8. **Modo normal:** borrar `cstrike/cfg/csstv/watchdog_dry` (02:31:32).

## Pruebas

### Docker (imagen del panel)

`pruebas/prueba_docker.sh`, con tiempos cortos (cada 2 s, actúa a los 10 s, margen de 6 s y `SIGKILL` a los 5 s). Usa el `srcds_run` real del #1 parcheado. **31 comprobaciones en verde:**
- arranca con `srcds_run`, encuentra el juego y su puerto, y hay uno solo por contenedor;
- el juego contesta y SourceTV no cuenta como jugador;
- **modo de prueba:** solo anota, el juego sigue vivo y anota cuánto duró el congelamiento;
- **disparador:**
  - con jugadores, lo cancela y lo borra sin tocar el juego;
  - con el servidor vacío, congela el juego;
  - apagarlo a mitad de la prueba lo descongela;
  - con el watchdog apagado, lo ignora;
  - de punta a punta actúa aunque esté en modo de prueba, y el juego detenido recibe la señal con `SIGCONT` y escribe el volcado;
- **modo normal:** `SIGABRT` a los 10 s, volcado y reinicio;
- un proceso que ignora `SIGABRT` recibe `SIGKILL` y se reinicia;
- el watchdog termina con `srcds_run`.

```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "<carpeta con srcds_run parcheado>:/srv:ro" -v "<repo>:/repo:ro" --entrypoint "" \
  ulisesadrian/debian7-css:v34 bash /repo/docs/bitacora/2026-10-27-watchdog-congelamiento/pruebas/prueba_docker.sh
```

### En el #1

- **`A2S_INFO` desde afuera con el servidor vacío:** 1 jugador y 1 bot (SourceTV).
- **Watchdog en modo de prueba:** "juego nuevo… puerto 27062" y "el juego contesta (… 0 jugadores)".
- **Cambios de mapa:** ninguna consulta sin respuesta.
- **De punta a punta (02:26 a 02:27):**
  - `SIGSTOP` y "sin respuesta" a los 7 s;
  - `SIGABRT` a los 35 s; el proceso terminó en 1 s;
  - reinicio a los 10 s y `Uploaded crash dump: Crash ID: 20261027T052710-8ee924f6` (139 KB).

  `leer_volcado.py` con los `.so` del #1: excepción `0x6`, binario `srcds_i686` y pila con símbolos (`main` → `CDedicatedAppSystemGroup::Main` → `RunServer` → `libc`).

## En qué se apartó del plan

- **Cómo se lanza:** el plan suponía que el panel podía lanzarlo o que usaba `start.sh`. El panel ejecuta `./srcds_run` con un comando fijo, así que el watchdog se lanza con una línea en nuestro `srcds_run` (por SFTP), sin tocar el panel.
- **Modo de prueba:** por archivo (`watchdog_dry`), no por la variable `WATCHDOG_DRY`. El panel no deja poner variables de entorno nuevas.
- **Puerto:** 27062, no 27015. Lo saca de la línea de comandos del juego.
- **Prueba de punta a punta:** el plan decía `kill -STOP` a mano, pero el panel no da consola de shell. La dispara el propio watchdog con `watchdog_test`, solo con el servidor vacío (lee los jugadores de `A2S_INFO`).
- **`SIGCONT` después de `SIGABRT`:** un proceso detenido recibe la señal recién al continuar.
- **`pidof -x`:** hace falta para la prueba en Docker, donde el juego falso es un script. En el #1 el juego es un binario y no cambia nada.
- **Accelerator por http:** no estaba en el plan. Sin eso, los volcados del #1 no se subían y se perdían.
- **Modo normal el mismo día:** el plan decía 1 o 2 días en modo de prueba. Daniel decidió pasarlo a modo normal después de la prueba de punta a punta, para no perder el volcado del próximo congelamiento.

## Incidentes durante las pruebas

- **Stop y Restart del panel no apagan el contenedor:** el panel le pide al juego que se cierre, y el bucle de `srcds_run` lo vuelve a lanzar. El panel queda en "stopping" y **a los ~10 minutos mata el contenedor a la fuerza**: pasó a las 02:06, 10 minutos después de un Restart de las 01:56.

  No es del watchdog: también pasó a las 01:51, con el `srcds_run` original. **Para reiniciar el #1: Kill y después Start.**
- **Accelerator no subía por HTTPS:** `Failed to upload crash dump: Protocol https not supported or disabled in libcurl (1)`, y el volcado se borró igual. Se pasó la `MinidumpUrl` a `http://` y la segunda prueba subió bien.
- **Escapes `\x` al editar con Python desde Git Bash:** dos reemplazos fallaron (sin escribir nada). Se rehicieron con Edit y Write.

## Cómo revertir

- **Apagarlo al instante:** crear `cstrike/cfg/csstv/watchdog_off`.
- **Sacarlo del todo:**
  1. renombrar `srcds_run.bak_20261026` a `srcds_run`;
  2. borrar `watchdog.sh` y los archivos `watchdog_*` de `cstrike/cfg/csstv/`;
  3. Kill y Start en el panel.
- **Accelerator por https otra vez:** renombrar `core.cfg.bak_20261027` a `core.cfg`. Los volcados del #1 vuelven a perderse.

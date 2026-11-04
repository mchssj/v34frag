# Plugin de deathmatch: guía de implementación

## Estado

Probado con bots en `cssds` y subido a ethereal el 2026-10-31, por decisión de Kyan, antes de las pruebas con un jugador. Se carga en el próximo cambio de mapa y solo actúa en `$2000$`.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/v34_dm.sp` | Nuevo |
| `server/addons/sourcemod/scripting/dm/rank.inc` | Nuevo |
| `docs/PENDIENTES.md`, `docs/bitacora/README.md` | Estado |

## Despliegue (hecho el 2026-10-31)

Destino: ethereal (`FLOW_SERVER`), SFTP `190.104.34.3:2022`, que tiene `$2000$`, SDK Hooks, `dbi.sqlite` y `clientprefs`. Subir `v34_dm.smx` a `plugins/`. No hace falta tocar ningún cfg. Se carga en el próximo cambio de mapa.

Ese servidor juega mixes con `csstv_reporter`. Es otra excepción a la regla de `CLAUDE.md` de desplegar a todos los servidores en la misma tanda.

## Pruebas

### Con bots, en `cssds`

| Qué | Resultado |
|---|---|
| En `de_dust2_ob` | `sm_dm 1` rechazado |
| En `$2000$` | Se prende solo, con `mp_timelimit` 0 |
| Muere todo un equipo (`sm_slay @t`) | Fin de ronda bloqueado y siguen jugando. Sin reinicio |
| Mueren todos (`sm_slay @all`) | Bloqueado 2 veces más, todos reaparecen |
| Tiempo de ronda en 1 minuto | A los 72 s, sin reinicio ni fin de ronda |
| Solo cabeza para todos | 60 bajas en 150 s, las 60 a la cabeza |
| Sin solo cabeza | 47 bajas en 60 s, 16 a la cabeza |
| Apagar | Restaura los cvars |
| Errores y caídas | Ninguno |

**Sin explicar:** en la primera corrida, con solo cabeza, hubo 0 bajas en 60 s. En la segunda corrida hubo 60 en 150 s, todas a la cabeza. Puede ser que los bots estuvieran dispersos.

### Sin probar

- `!guns`, `!hs` individual, `!rank`, `!top` y `!admin`.
- Protección al aparecer.
- Entrar con el juego en marcha, elegir modelo y aparecer.
- Rechazo con un mix en curso y bloqueo de comandos con el reporter 1.8.0.
- Bajas con recarga y vida.
- Linux.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

Quitar `plugins/v34_dm.smx` y cambiar de mapa. Datos: `data/sqlite/v34_dm.sq3` y `cfg/sourcemod/v34_dm.cfg`.

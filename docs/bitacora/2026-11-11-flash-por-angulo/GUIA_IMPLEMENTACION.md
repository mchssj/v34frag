# Flash según el ángulo y la distancia: guía de implementación

## Estado

Probado en el servidor local el 2026-11-11, con bots (flashes simuladas) y por Kyan con flashes de verdad. **Subido a #1, #2 y #3 el 2026-11-11**; cada uno lo carga en su próximo cambio de mapa (falta verificarlo). **No está desplegado** en ningún servidor.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv_flash.sp` | Nuevo, 1.0.0 |
| `server/addons/sourcemod/plugins/csstv_flash.smx` | Nuevo: `spcomp` 1.8.0.5963 del servidor local, sin errores ni avisos. 8512 bytes, md5 `c8a43695b8b6b0ce8070fe9aa6b62a90` (con el tope y sin SourceTV) |
| `server/cfg/sourcemod/csstv_flash.cfg` | Nuevo: el que genera `AutoExecConfig`, con los valores por defecto |
| `docs/bitacora/2026-11-11-flash-por-angulo/pruebas/flash_test.sp` | Plugin de prueba: `sm_flashsim` simula una flash. Solo para el servidor local |

Compilar:

```bash
SP=/c/Users/Agus/Downloads/cssds/cstrike/addons/sourcemod/scripting
cd server/addons/sourcemod/scripting && "$SP/spcomp.exe" csstv_flash.sp -i"$SP/include" -o"../plugins/csstv_flash.smx"
```

## Despliegue (hecho el 2026-11-11)

Aprobado por Kyan. Subido en la misma tanda a **#1** (`157703b5`), **#2** (`cd1be322`) y **#3** (`16c850ff`) por la **API del panel** (`SFTP_CSS_API_KEY`, `GET /api/client/servers/<id>/files/upload` y `POST` del archivo a la URL firmada):

1. `csstv_flash.smx` a `/cstrike/addons/sourcemod/plugins/` (no existía antes). Los tres quedaron con 8512 bytes.
2. `csstv_flash.cfg` a `/cstrike/cfg/sourcemod/` (no existía). Los tres quedaron con el mismo md5 que el del repo (`8d1f774e…`).
3. **No se recargó nada:** uno de los tres tenía una partida en curso. Subir un plugin nuevo no lo carga; cada servidor lo carga en su próximo cambio de mapa.
4. **Falta verificar** en cada uno, después del cambio de mapa, que `sm plugins list` muestre "CSSTV Flash" 1.0.0.

El de retake (ExtremeHost) no lo recibió: se daba de baja alrededor del 2026-11-10 y no juega mixes.

Antes se intentó por SFTP: el #2 y el #3 respondieron, pero el #1 rechazó la contraseña (`SFTP_CSS_PASSWORD_MVZG` con el usuario de `157703b5`). Por la regla de usar primero la API, se subió todo por la API. El rechazo del SFTP del #1 queda para revisar.

En el mismo commit: la sección "La flash" en `docs/manual/jugador/jugar-en-el-servidor.md`, `docs/PENDIENTES.md` y el estado en `docs/bitacora/README.md`.

## Pruebas

### Con bots, servidor local (`C:\Users\Agus\Downloads\cssds`), 2026-11-11

- `csstv_flash` carga en el v34: existen `m_flFlashDuration` y `m_flFlashMaxAlpha` en `CCSPlayer`, y los eventos `player_blind` y `flashbang_detonate` (`cstrike/resource/modevents.res`).
- Una flash de verdad no se puede crear desde un plugin: `flashbang_projectile` creado con `CreateEntityByName` no explota (el temporizador lo pone el código del arma). Por eso `flash_test.sp` simula lo que hace el juego: pone los valores, dispara `player_blind` y después `flashbang_detonate`.
- Bot quieto (`bot_stop 1`), base 3 s, `csstv_flash_debug 1`:

| Ángulo, distancia | Juego | Final |
|---|---|---|
| 0°, 200 | 3,00 s / 255 | 3,00 s / 255 |
| 50°, 200 | 3,00 / 255 | 2,99 / 254 |
| 70°, 200 | 2,09 / 255 | 2,64 / 238 |
| 90°, 200 | 2,09 / 255 | 1,83 / 202 |
| 110°, 200 | 2,09 / 255 | 0,98 / 164 |
| 135°, 200 | 1,20 / 200 | 0,45 / 140 |
| 180°, 200 | 1,20 / 200 | 0,45 / 140 |
| 0°, 800 | 3,00 / 255 | 2,34 / 255 |
| 0°, 1200 | 3,00 / 255 | 1,69 / 255 |
| 0°, 1500 y 2000 | 3,00 / 255 | 1,19 / 255 |
| 180°, 1500 | 1,20 / 200 | 0,17 / 140 |
| 180°, 200 con `csstv_flash_enable 0` | 1,20 / 200 | 1,20 / 200 (sin cambio) |

### Con una persona, servidor local, 2026-11-11

Kyan tiró 14 flashes de verdad (con granadas infinitas del plugin de prueba) y se las comió de frente, de costado y de espaldas, de cerca y de lejos. Resultado del log de SourceMod:

- **El orden de los eventos se cumple en el v34:** las 14 flashes se recalcularon y no hubo ninguna línea "sin flashbang_detonate".
- **Los escalones del juego son los supuestos:** a 1010 u, de frente 2,33 s y de espaldas 0,93 s (0,40); a ≈ 230 u, de frente 6,05 s y de costado 4,23 s (0,70).
- Ejemplos: de frente a 229 u, 6,05 s → 6,05 s; de costado (90°) a 240 u, 4,20 → 3,62 s; de espaldas (154°–165°) a ≈ 230 u, 2,4 s/200 → 0,9 s/140; de espaldas a ≈ 1000 u, 0,9 s/200 → 0,22 s/140.
- **Problema encontrado:** entre 60° y 85° el plugin alarga la flash respecto del juego (72° a 229 u: 4,23 → 5,12 s), porque ahí el juego ya aplica el escalón de costado y la curva todavía da ≈ 88 %. También recalcula a SourceTV (inofensivo).
- **ClientMod dibuja con los valores nuevos:** Kyan vio la diferencia en pantalla de costado y de espaldas.

### Tope, servidor local, 2026-11-11

Corregido el problema: la duración nueva nunca pasa la del juego, y SourceTV no se recalcula. Simulado con un bot a 230 u y 6,05 s de frente:

| Ángulo | Juego | Final |
|---|---|---|
| 0° y 50° | 6,05 s / 255 | 6,05 s / 255 |
| 65° | 4,23 / 255 | 4,23 / 245 |
| 72° | 4,23 / 255 | 4,23 / 235 |
| 80° | 4,23 / 255 | 4,23 / 222 |
| 90° | 4,23 / 255 | 3,70 / 202 |
| 180° | 2,42 / 200 | 0,90 / 140 |

## En qué se apartó del plan

- La depuración escribe con `LogMessage` (log de SourceMod) en vez de la consola del servidor: se puede leer en los servidores sin estar en la consola.
- El plugin de prueba simula la flash en vez de crear una de verdad (ver Pruebas). También da granadas infinitas, para la prueba con una persona.
- Tope nuevo: la flash nunca dura más que en el juego (el plan no lo tenía; sin él, entre 60° y 85° la alargaba). SourceTV no se recalcula.

## Cómo revertir

- Rápido: `csstv_flash_enable 0` en `cfg/sourcemod/csstv_flash.cfg` de cada servidor (toma efecto al cambiar la cvar).
- Del todo: mover `csstv_flash.smx` a `plugins/disabled/` en los tres, y se descarga en el próximo cambio de mapa.

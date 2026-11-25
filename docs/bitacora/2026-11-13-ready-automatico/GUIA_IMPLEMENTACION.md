# !ready automático al entrar: guía de implementación

## Estado

Reporter **2.10.2 desplegado en #1, #2 y #3** el 2026-11-13: entra en el próximo cambio de mapa de cada uno. **2.12.1** en `kyan/pruebas`. Probado con bots en el servidor local; falta probar `!unready` con una persona, el bloqueo con el deathmatch y una sala del matchmaking.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv/autoready.inc` | Nuevo: `csstv_auto_ready`, evento `player_team`, barrido y condición |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | 2.12.1: include, `AutoReady_Init`, `AutoReady_ClientReset`, `!ready`/`!unready` prenden y apagan el automático, recordatorio con barrido y texto nuevo, `AutoReady_Reset` en `ResetMatch` |
| `server/addons/sourcemod/plugins/csstv_reporter.smx` | 2.12.1 compilado |
| `build_2.10.2/` | `sobre_2.10.1.patch` y el `.smx` de la 2.10.2 desplegado |
| `docs/manual/jugador/jugar-en-el-servidor.md`, `comandos-en-el-servidor.md` | Se entra listo; `!unready` para frenar |

## Cómo se armó la 2.10.2

```bash
git archive origin/main server/addons/sourcemod/scripting | tar -x -C <dir>
cd <dir>
patch -p1 < docs/bitacora/2026-11-12-cuchillo-por-vida-y-nombre-web/build_2.10.1/sobre_main_2.10.0.patch
patch -p1 < docs/bitacora/2026-11-13-ready-automatico/build_2.10.2/sobre_2.10.1.patch
cd server/addons/sourcemod/scripting && spcomp csstv_reporter.sp -i<include de SourceMod 1.10> -iinclude
```

Compilado con `spcomp` 1.10.0.6490 (el de `Downloads\cssds`). Cuando Daniel lleve el cambio a `main`, `feat/frontend-fase-1` y `feat/mm-claim-en-sala`, se aplica este parche (o el diff de `kyan/pruebas`).

## Despliegue (hecho el 2026-11-13)

Por la API del panel de MVZG, sin recargar el plugin ni cambiar de mapa:

1. En cada servidor se bajó el `csstv_reporter.smx` y se comprobó que era la 2.10.1.
2. Respaldo en `plugins/disabled/csstv_reporter_2.10.1.smx`.
3. Se subió la 2.10.2 y se volvió a bajar: igual byte a byte en los tres.

## Pruebas

En `C:\Users\Agus\Downloads\cssds`, con `csstv_send 0`, `csstv_include_bots 1` y `bot_quota 8` (se volvió todo como estaba al terminar).

| Prueba | Resultado |
|---|---|
| 2.10.2, 8 bots en `de_dust2`, nadie escribe `!ready` | Arrancó solo (ronda de cuchillo) a los ~20 s de cargar el mapa |
| 2.10.2 con `csstv_auto_ready 0` | No arrancó en 75 s |
| 2.12.1, 8 bots | Arrancó solo |

Sin probar: `!unready` con una persona, el bloqueo con `sm_dm_on`/`sm_retake_on`/`sm_2v2_on` y una sala del matchmaking.

## Incidentes

**Se culpó por error a la 2.10.2 (2026-11-13).** A las 14:47 el #3 tomó una sala en `de_dust2_ob` y los jugadores se quedaron en "conectando". Era el primer cambio de mapa del #3 con la 2.10.2 y se volvió a la 2.10.1 en los tres. La causa real era `sv_pure 1`: un cambio de `sv_pure` en `server.cfg` entra un mapa después, y el #3 no había cambiado de mapa desde que se volvió a `sv_pure 2` (ver [`2026-11-13-sv-pure-skins-armas`](../2026-11-13-sv-pure-skins-armas/GUIA_IMPLEMENTACION.md)). Ese mismo día se volvió a subir la 2.10.2 a los tres, igual byte a byte; entra en el próximo cambio de mapa de cada uno.

## En qué se apartó del plan

Se sumó un barrido en el recordatorio del calentamiento (cada 30 s) para los que ya estaban en un equipo cuando empezó a valer, porque ahí no hay evento de equipo.

## Cómo revertir

- **Rápido, sin compilar:** `csstv_auto_ready 0` en `cfg/sourcemod/csstv_reporter.cfg` de cada servidor.
- **Volver a la 2.10.1:** copiar `plugins/disabled/csstv_reporter_2.10.1.smx` sobre `plugins/csstv_reporter.smx` en los tres. Entra en el próximo cambio de mapa, nunca con una partida en curso.
- **Repo:** revertir el commit.

# Serie de mapas en el HUD: guía de implementación

## Estado

**Implementado, probado en local y desplegado en el VPS (2026-10-30)**: relay 2.2.0, build `7b6540df4295-local10301756` (con cambios sin commit). Falta verlo en OBS con la SourceTV real y, después del commit, volver a desplegar para que el build lleve el nombre del commit.

## Archivos

| Archivo | Cambio |
|---|---|
| `hud/relay/src/control.ts` | `Series`, `SeriesMap`, `showSeries` y `series` en `Control`; `mergeSeries`; "Intercambiar" da vuelta picks y ganadores |
| `hud/relay/src/main.ts` | `VERSION` 2.2.0 |
| `hud/relay/test/relay.test.ts` | Dos pruebas: validación de la serie y el intercambio |
| `hud/relay/public/control.html` | Sección "Serie" y sus estilos |
| `hud/relay/public/control.js` | `renderSeries`, sugerencias del `mapcycle.txt`, botón "Serie"; las teclas 1 a 0 no actúan con un `select` enfocado |
| `hud/relay/public/hud.js` | `infoParts` (la caja) y `seriesPips` (rayitas) |
| `hud/relay/public/hud.css` | `#info` sin mayúsculas forzadas, estilos del pick y `#score .pips` |
| `hud/relay/README.md` | La serie en la guía del streamer |
| `docs/bitacora/2026-10-30-hud-serie-mapas/pruebas/` | Capturas y `cdp_control.mjs` |

## Despliegue (hecho el 2026-10-30)

Lo corrió Daniel desde su PC: `deploy/vps/desplegar.sh hud`. Las 34 pruebas pasaron y se subió a `/srv/cmleague/hud/releases/7b6540df4295-local10301756` (la anterior era `ea72879c8f86-local10301427`). `/healthz` respondió `"version":"2.2.0"`. Los avisos de `tar` ("time stamp … in the future") son por el reloj de la PC, unos 2,5 s adelantado al del VPS.

No toca los servidores de juego, así que no aplica la regla de desplegar en el real y flow en la misma tanda.

1. Desde la PC: `deploy/vps/desplegar.sh hud` (corre las pruebas, arma `dist-node/`, lo sube y reinicia `cmleague-hud`).
2. `curl https://hud.cmleague.lat/healthz` tiene que decir `"version":"2.2.0"`.
3. Refrescar la fuente de navegador del HUD en OBS y la página de control.
4. Si algún streamer usa `relay.exe` en su PC: armarlo de nuevo con `pnpm build:exe` y pasárselo.

Los `control.json` que ya existen se cargan sin problema: a los que no tienen `series`, `mergeControl` les pone la serie vacía (BO1).

## Pruebas

### Tipos y pruebas del relay

`pnpm typecheck` sin errores y `pnpm test`: 34 de 34 (32 de antes y 2 nuevas).

### Pantalla, con el relay en local

Relay en modo local (HTTP 8099, UDP 27599, retraso 0) y `pnpm simular` (mapa `de_dust2`). La serie se cargó con `POST /api/control` y las capturas se sacaron con `docs/bitacora/2026-10-30-hud-version-2/pruebas/cdp_shots.mjs`.

| Caso | Captura | Resultado |
|---|---|---|
| BO3, de_dust2 elegido por FLUXO (T), Arena Pro ganó el mapa 1 | [`bo3.png`](pruebas/bo3.png) | `CMLEAGUE \| BO3 \| Jugando en de_dust2 \| Pick de FLUXO` con FLUXO en rojo; una rayita azul sobre Arena Pro |
| Después de "Intercambiar" | [`swap.png`](pruebas/swap.png) | FLUXO pasa a CT y su nombre en la caja a azul; la rayita de Arena Pro pasa a la derecha y en rojo |
| BO5, de_dust2 como decider | [`decider.png`](pruebas/decider.png) | `… \| Decider`; tres rayitas por equipo |
| BO1 (de_dust2 estaba en el renglón 2) | [`bo1.png`](pruebas/bo1.png) | `CMLEAGUE \| BO1 \| Jugando en de_dust2`, sin pick y sin rayitas |
| "Serie" apagado | [`off.png`](pruebas/off.png) | `CMLEAGUE \| de_dust2`, sin rayitas |
| Página de control | [`control.png`](pruebas/control.png) | Sección "Serie" con el mapa 2 marcado "en juego" y el resultado `FLUXO 1 – 1 Arena Pro` |

### Clics en la página de control

[`pruebas/cdp_control.mjs`](pruebas/cdp_control.mjs), en Edge sin ventana: elegir el ganador del mapa 3, escribir `de_nuke_old_blue_ep` en el mapa 1 y tocar BO5. Resultado: los tres cambios llegaron al relay, el mapa 5 quedó como decider y el resultado pasó a `FLUXO 2 – 1 Arena Pro`.

Sin probar:
- Con la SourceTV real ni en OBS.
- Con dos pestañas de control abiertas a la vez editando la serie.

## En qué se apartó del plan

- **La caja ya no fuerza mayúsculas:** antes decía `CMLEAGUE | DE_DUST2`; ahora `CMLEAGUE` va en mayúsculas y el resto como en `hudv2mapas.png` (`Jugando en de_dust2`). También con "Serie" apagado el mapa va en minúsculas.

## Cómo revertir

`git checkout` de los archivos de la tabla a la versión anterior (relay 2.1.0) y desplegar con `desplegar.sh hud`. Los `control.json` con `series` no molestan a la 2.1.0: los campos que no conoce se ignoran.

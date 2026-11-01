# El kill feed del HUD dura lo que tiene que durar: guía de implementación

## Estado

2026-10-30: **implementado y desplegado en el VPS** (34 pruebas del relay en verde): relay 2.2.1, build `1a3d9e92badb-local10302031` (con cambios sin commit; la anterior era `7b6540df4295-local10301756`). `/healthz` respondió `"version":"2.2.1"` y el `hud.js` servido tiene `KILL_MS = 12000` y `relayNow`. Falta verlo en OBS con una partida y, después del commit, volver a desplegar para que el build lleve el nombre del commit.

## Cambios respecto del plan

- La duración quedó en **12 s** y no en 7 s: lo recomendó kyan y Daniel lo aprobó el 2026-10-30. Como el relay guarda hasta 6 kills (`MAX_KILLS`), si hay más de 6 en 12 s las más viejas salen antes.

## Cómo se encontró

Daniel vio que las kills se borraban muy rápido. En el código, el HUD las mostraba 5 s según el reloj de la PC (`Date.now() - k.at < 5000`), pero `at` lo pone el relay. La PC de Daniel estaba unos 4 s adelantada al VPS (hora local contra el `Date` de `hud.cmleague.lat`), así que quedaba cerca de 1 s.

## Cambios

| Archivo | Cambio |
|---|---|
| `hud/relay/public/hud.js` | `relayNow()` con el desfase estimado (mínimo de las últimas 40 muestras de `Date.now() - updatedAt`); lo usan `renderKills`, `renderBanner` y `tick`. `KILL_MS` de 5000 a 12000 |
| `hud/relay/src/main.ts`, `package.json` | 2.2.0 → 2.2.1 |

No cambian el protocolo, la base ni el plugin, así que no aplica la regla de desplegar en el real y flow en la misma tanda.

## Despliegue

1. Desde la PC: `deploy/vps/desplegar.sh hud`.
2. `https://hud.cmleague.lat/healthz` tiene que decir `"version":"2.2.1"`.
3. En OBS, con una partida en flow: cada kill queda unos 12 s y el reloj de la ronda coincide con el del juego (con el retraso de 45 s).

## Cómo volver atrás

`git checkout` de los archivos de la tabla a la 2.2.0 y `desplegar.sh hud`.

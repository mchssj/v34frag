# El nivel con el anillo de 10 segmentos: guía de implementación

## Estado

Implementado y probado en local el 2026-11-07, en la copia de `main` (`v34frag-mainwt`). **Sin commit ni despliegue.**

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/index.css` | `--level-1`, `--level-2`, `--level-4`, `--level-8`, `--level-10` y `--level-off`, en claro y en oscuro |
| `web/frontend/src/components/brand/LevelBadge.tsx` | El anillo en SVG, `levelTier` y `levelColor` |
| `web/frontend/src/components/brand/LevelBadge.test.tsx` | Nueva: tramos, segmentos encendidos y número |
| `web/frontend/src/features/matchmaking/EloMeter.tsx` | La barra con el color del nivel |
| `web/frontend/src/features/player/pages/PlayerProfile.tsx` | La tarjeta Nivel con `LevelBadge` (60 px) y la escalera con el color del nivel |
| `web/frontend/src/features/player/components/tabs/SeasonsTab.tsx` | El nivel de cada temporada con `LevelBadge` |
| `web/frontend/src/features/shell/components/AccountMenu.tsx` | El nivel del menú de la cuenta con `LevelBadge` |
| `web/frontend/src/components/illustrations/index.tsx` | `NoLevelBadge`: el anillo apagado con "?" |
| `GroupSlots.tsx`, `RoomOverview.tsx` | Sin el `rounded-full` que ya no aplica |

## Despliegue (pendiente)

Solo la web, desde `main` (y la copia en `feat/frontend-fase-1`): `deploy/vps/desplegar.sh web`. No toca la base, la API ni los servidores.

## Pruebas

- `tsc -b` y `eslint` sin errores; 660 pruebas en verde (3 nuevas) con `vitest run --maxWorkers=2`.
- En la web local (Playwright, `jugador@prueba.local`), el ranking de jugadores en oscuro y en claro: `pruebas/niveles_dark.png` y `pruebas/niveles_light.png`. En la captura salen los niveles 5 y 6, que son los primeros del ranking; los demás tramos se probaron solo en las pruebas unitarias.

- El perfil público de kyan (nivel 6), en oscuro y en claro: `pruebas/perfil_dark.png` y `pruebas/perfil_light.png`.

## En qué se apartó del plan

En la primera pasada quedaron tres lugares que dibujaban el nivel a mano, sin `LevelBadge`: el perfil público, la pestaña Temporadas y el menú de la cuenta. Daniel lo vio en el perfil y se cambiaron, junto con "Sin nivel todavía". Se buscaron todos los que muestran el nivel; ya no queda ninguno a mano.

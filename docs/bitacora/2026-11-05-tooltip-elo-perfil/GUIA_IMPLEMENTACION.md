# El tooltip de ELO en el perfil: guía de implementación

## Estado

Hecho en `main` el 2026-11-05. Typecheck, lint y toda la suite en verde (611 pruebas, 100 archivos). **Desplegado el 2026-11-05:** web `ac5d6202b2d2` desde `main` (antes `06c2da7b23db`), con las 612 pruebas en verde dentro de `desplegar.sh web`. `https://cmleague.lat` responde 200, junto con [`2026-11-05-comunidad-para-ti`](../2026-11-05-comunidad-para-ti/). **Falta:** mirarlo en el navegador y publicar el changelog.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/components/brand/EloTooltip.tsx` | Nuevo: el globo, sacado de la gráfica de "Para ti" sin cambios de aspecto |
| `web/frontend/src/components/brand/EloTooltip.test.tsx` | Nuevo: 3 pruebas |
| `web/frontend/src/features/home/components/EloChart.tsx` | Usa `EloTooltip` en lugar de su globo propio |
| `web/frontend/src/features/player/components/EloChart.tsx` | Usa `EloTooltip`, suma `onPointerDown` y deja la prop `onHover` |
| `web/frontend/src/features/player/pages/PlayerProfile.tsx` | `EloCard` deja de guardar y mostrar el texto gris; sale el `useState` que ya no se usa |
| `docs/manual/jugador/elo-y-estadisticas.md` | Una línea sobre la gráfica en "Dónde ves tus números" |

## Despliegue (hecho el 2026-11-05, web `ac5d6202b2d2`)

Solo la web, desde `main`, como el de "Para ti" ([`2026-11-03-para-ti`](../2026-11-03-para-ti/)). No toca la base, la API ni los servidores de juego (#1, #2 y #3).

1. `v34frag-deploy` en ese commit y `pnpm install --frozen-lockfile` en `web/frontend`.
2. En Git Bash, con `VPS_HOST` del `.env` de `v34frag`: `deploy/vps/desplegar.sh web`.
3. Abrir un perfil con 2 o más mixes y pasar el mouse por Evolución de ELO, en claro y oscuro, en escritorio y en el celular.
4. Publicar `CHANGELOG_DISCORD.txt`.

## Pruebas

- **`EloTooltip`:** ELO, `+18` en verde, "3 nov · de_dust2"; `-22` en rojo; `+0` sin cambio.
- **Gráfica del perfil:** con el ancho simulado (jsdom no mide), un `pointerdown` cerca del borde derecho muestra el globo de la última partida, y `pointerleave` lo saca.
- La e2e `player.spec.ts` solo busca el título "Evolución de ELO", que no cambia. No se corrió.

## En qué se apartó del plan

En nada.

## Cómo revertir

Revertir el commit. Sin el commit: `git checkout` de los cuatro archivos de la web y del manual, y borrar `EloTooltip.tsx`, `EloTooltip.test.tsx` y esta carpeta.

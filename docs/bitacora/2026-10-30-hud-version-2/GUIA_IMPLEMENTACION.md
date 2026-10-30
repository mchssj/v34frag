# HUD de observer, versión 2: guía de implementación

## Estado

**Implementado, probado en local y desplegado en el VPS (2026-10-30)**: relay 2.1.0, build `ea72879c8f86-local10301427` (con cambios sin commit). Falta verlo en OBS con la SourceTV real.

## Archivos

| Archivo | Cambio |
|---|---|
| `hud/relay/public/hud.html` | Contenedores `#info` y `#alive`. Los lados pasan a `side ct` y `side t` |
| `hud/relay/public/hud.css` | Reescrito con el diseño. Lleva la foto embebida (`--avatar`, unos 4,5 KB en base64) |
| `hud/relay/public/hud.js` | Tarjetas, tarjeta grande, marcador, vivos, clutch y cartel nuevos. El feed, la conexión, la carga de las fuentes y el reloj siguen igual |
| `hud/relay/src/main.ts` | `VERSION` 2.1.0 |
| `docs/bitacora/2026-10-30-hud-version-2/avatar.webp` | La imagen original de Daniel (`hudversion2 avatar.jpg` de la raíz, que es WebP de 400×400) |
| `docs/bitacora/2026-10-30-hud-version-2/pruebas/` | Scripts y capturas de las pruebas |

## Despliegue (hecho el 2026-10-30)

Lo corrió Daniel desde su PC: `deploy/vps/desplegar.sh hud`. Las 32 pruebas pasaron, se armó `dist-node/` y se subió a `/srv/cmleague/hud/releases/ea72879c8f86-local10301427` (la anterior era `91498a41bca2`). `/healthz` respondió `"version":"2.1.0"`. Los avisos de `tar` ("time stamp … in the future") son porque el reloj de la PC va unos 3 s adelantado al del VPS.

No toca los servidores de juego, así que no aplica la regla de desplegar en el real y flow en la misma tanda.

1. Desde la PC: `deploy/vps/desplegar.sh hud`, que arma `dist-node/` (`pnpm build:node`), lo sube y reinicia `cmleague-hud`. Ver [`2026-10-29-hud-relay-vps`](../2026-10-29-hud-relay-vps/GUIA_IMPLEMENTACION.md).
2. `curl https://hud.cmleague.lat/healthz` tiene que decir `"version":"2.1.0"`.
3. El que tenga el HUD abierto en OBS: refrescar la fuente de navegador.
4. Hay que volver a desplegar después del commit, para que el build tenga el nombre del commit y no `-local`.
5. Si algún streamer usa el `relay.exe` en su PC: armarlo de nuevo con `pnpm build:exe` y pasárselo.

## Pruebas

### Tipos y pruebas del relay

`pnpm typecheck` sin errores y `pnpm test`: 32 de 32.

### Pantalla, con el relay en local

Relay en modo local (`relay.json` en una carpeta del scratchpad, UDP 27599 y HTTP 8099) y `pnpm simular`. Las capturas se sacaron con Edge sin ventana por el protocolo de DevTools ([`pruebas/cdp_shots.mjs`](pruebas/cdp_shots.mjs)), porque `--screenshot` se queda esperando para siempre por la conexión SSE. Los nombres de los equipos y el enfocado se cargaron con `POST /api/control`.

| Caso | Captura | Resultado |
|---|---|---|
| Compra | [`compra.png`](pruebas/compra.png) | Reloj con "COMPRA" en verde, todos con 100 y las tarjetas llenas |
| En juego | [`en_juego.png`](pruebas/en_juego.png) | La vida oscurece cada tarjeta hasta su línea (9, 21, 35, 42, 54, 64, 70 y 76). C4, kit y enfocado bien |
| Fin de ronda | [`fin_de_ronda.png`](pruebas/fin_de_ronda.png) | Cartel "KRAKEN ESPORTS GANA LA RONDA", muertos con el daño, la tarjeta grande oculta porque el enfocado murió y "0 VS 3" |
| Bomba plantada y clutch | [`bomba_y_clutch.png`](pruebas/bomba_y_clutch.png) | Escena fija ([`pruebas/escena.mjs`](pruebas/escena.mjs)): reloj rojo con la C4, "1 VS 2" con CLUTCH, HE en la mano (el rifle se ve apagado) y las cuatro granadas en la franja |
| Sin las fuentes | [`sin_fuentes.png`](pruebas/sin_fuentes.png) | Relay con `gameDir` en una carpeta vacía (`killfeedIcons: false`): nombres de las armas, "H F×2 S", "A+H" y "KIT" |

Corregido durante las pruebas:
- **Un "null" debajo de los vivos:** `replaceChildren` no descarta `null` como `el()`.
- **Con las cuatro granadas, la franja de abajo se cortaba:** el arma bajó a 26 px y las granadas a 18 px.
- **En la tarjeta grande, las granadas se salían:** la vida y el chaleco bajaron a 34 px.

Sin probar:
- Con la SourceTV real ni en OBS.
- El cartel con "Desactivaron la bomba" y "La bomba explotó": la simulación no llegó a una ronda con bomba en las capturas.

## En qué se apartó del plan

- **Vivos y clutch:** se cuentan entre los cinco de cada lado que muestra el HUD, igual que las tarjetas.
- **Motivo del cartel:** se muestra solo si el evento de la bomba llegó a menos de 15 s del fin de ronda. Antes podía quedar el de una ronda anterior.

## Cómo revertir

`git checkout` de `hud/relay/public/hud.html`, `hud.css`, `hud.js` y `hud/relay/src/main.ts` a la versión anterior (relay 2.0.0, commit `dce0825`), y desplegar con `desplegar.sh hud`.

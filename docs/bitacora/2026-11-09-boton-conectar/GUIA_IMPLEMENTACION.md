# El botón Conectar abre el v34: guía de implementación

## Estado

Hecho y probado en la web local (`/demo/matchmaking`) el 2026-11-09, en `kyan/pruebas`. Sin desplegar: falta pasarlo a `feat/frontend-fase-1` (Daniel o Kyan con su OK).

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/features/matchmaking/labels.ts` | `cmleagueConnectUrl` y `CONECTAR_DESCARGA` reemplazan a `steamConnectUrl` |
| `web/frontend/src/features/matchmaking/ConectarHint.tsx` | Nuevo: texto con la descarga |
| `web/frontend/src/features/matchmaking/room/RoomOverview.tsx` | Botón Conectar con `cmleague://` y el texto debajo |
| `web/frontend/src/features/matchmaking/ReconnectBanner.tsx` | "Volver a la partida" con `cmleague://` |
| `web/frontend/src/features/pcw/components/SeriesPanel.tsx` | "Entrar" con `cmleague://` y el texto debajo |
| `web/frontend/src/features/shell/components/NowBar.tsx` | "Conectar" con `cmleague://` (sin contraseña) |
| `labels.test.ts`, `PlayPage.test.tsx` | Esperan `cmleague://` y el link de descarga |
| `docs/manual/jugador/buscar-partida.md`, `docs/manual/capitan/jugar-pcw.md` | Cómo instalar CMLeague Conectar |

## Despliegue

Solo web: sale con el próximo despliegue del frontend. No toca base, API ni servidores.

## Pruebas

- `pnpm typecheck` sin errores; `vitest` de `matchmaking`, `pcw` y `shell`: 162 pruebas bien.
- `/demo/matchmaking`: la sala muestra Conectar con `cmleague://connect/45.235.98.12:27062/<contraseña>` y el link a `/descargas/cmleague-conectar.zip`, que el servidor de Vite sirve (200, 3746 bytes).
- No se probó el clic con CMLeague Conectar instalado en esta tanda: el programa no cambió desde el 2026-11-03, cuando se probó.

## En qué se apartó del plan

El texto de ayuda quedó en tuteo, como el resto de la web (el de 2026-11-03 estaba con voseo).

## Cómo revertir

Revertir el commit. El programa y el `.zip` no cambian.

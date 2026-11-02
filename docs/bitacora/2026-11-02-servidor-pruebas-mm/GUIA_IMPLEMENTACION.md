# aurav34 como único servidor de prueba del matchmaking: guía de implementación

## Estado

Hecho el 2026-11-02. Los archivos subidos se compararon con los locales. **Todo entra en el próximo cambio de mapa de `aurav34`**: no se recargó nada. Falta ver el plugin cargado y una sala real desde la web de staging.

## Qué se hizo

| Dónde | Cambio | Respaldo |
|---|---|---|
| Staging, `game_servers` | flow y `CMLeague #1` (MVZG): `mm_enabled = false`. `aurav34`: `mm_enabled = true`, `region = 'Sudamerica'`, `mode = 'competitive'` (antes `false`, sin región y `retakes`) | — |
| MVZG, `csstv_reporter.cfg` | `csstv_mm "0"` y `csstv_claim "0"` | `csstv_reporter.cfg.bak_sin_mm` |
| `aurav34`, `plugins/csstv_reporter.smx` | Reporter 2.8.4 genérico, 136793 bytes (antes no había: el reporter estaba en `disabled/`) | La 2.7.4 sigue en `plugins/disabled/csstv_reporter.smx` |
| `aurav34`, `plugins/csstv_password.smx` | 1.1.0, 10879 bytes | `plugins/disabled/csstv_password_antes_mm.smx` |
| `aurav34`, `csstv_reporter.cfg` | `csstv_api_url`, `csstv_api_key` y `csstv_server_token` de staging (los del `csstv_reporter.cfg.mm_staging` de Daniel; el token coincide con el `token_hash` de staging), `csstv_claim "1"`, `csstv_mm "1"` y `csstv_mm_poll "5"` | `csstv_reporter.cfg.bak_antes_mm2` |
| `aurav34`, `v34_retake.cfg` | `sm_retake_autostart "0"` | `v34_retake.cfg.bak_antes_mm` |

**Retake, 2026-11-02 (más tarde):** Kyan pidió dejar el retake como estaba. `v34_retake.cfg` volvió a `sm_retake_autostart "1"` (desde `v34_retake.cfg.bak_antes_mm`). Con el retake prendido solo, una sala del matchmaking que llegue a `aurav34` puede jugarse en modo retake.

Antes de subir se revisó que `aurav34` no tuviera nada en `data/csstv/live` ni en `queue`, para que no se mandara a staging nada viejo de producción.

## Cómo rearmar el 2.8.4

```bash
git worktree add --detach <carpeta> 7338f86
cd <carpeta>
git apply docs/bitacora/2026-11-02-servidor-pruebas-mm/pruebas/reporter-2.8.4.patch   # ruta desde este repo
```

Después se compila `csstv_reporter.sp` y `csstv_password.sp` con `spcomp`. Es el genérico: `aurav34` no lleva build licenciado.

## Pruebas

| Prueba | Resultado |
|---|---|
| Medio tiempo con bots en `cssds` (`2026-11-02-aviso-y-pausa-automatica/pruebas/medio_tiempo.sh`, build `CSSTV_DEBUG`, `csstv_mm` en 0) | `sv_alltalk` en 1 desde el final de la mitad hasta 15/16 s después, y después en 0. Sin errores |
| Matchmaking en local | **No se repitió.** Daniel lo probó el 2026-11-01 sobre la 2.8.0 (`docs/bitacora/2026-10-28-matchmaking/` en su rama `feat/mm-claim-en-sala`) |

## Falta

1. Confirmar en el próximo mapa que carga el 2.8.4 (`sm_csstv_status`) y que en staging aparece `mm_server_state.last_poll_at` de `aurav34`.
2. Una sala completa desde la web de staging.
3. Que Daniel sume a su rama la charla nueva del medio tiempo (está en `kyan/pruebas`, commit `00460b7`).

## Cómo revertir

- En `aurav34`: borrar `plugins/csstv_reporter.smx`, y volver a poner `csstv_password_antes_mm.smx`, `csstv_reporter.cfg.bak_antes_mm2` y `v34_retake.cfg.bak_antes_mm` en su lugar, en un cambio de mapa.
- En staging: `mm_enabled = false`, `region = null` y `mode = 'retakes'` para `aurav34`.

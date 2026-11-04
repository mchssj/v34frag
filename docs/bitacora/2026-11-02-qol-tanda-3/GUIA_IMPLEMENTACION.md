# QOL, tercera tanda: guía de implementación

## Estado

Hecho y probado con bots en local el 2026-11-02. **Subido el 2026-11-02 a flow, MVZG y `aurav34`**: entra en el próximo cambio de mapa, sin recargar nada. Falta la prueba con jugadores.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv/qol.inc` | `!tech` y la cuenta atrás |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | Versión 2.8.6 |
| `server/addons/sourcemod/scripting/csstv_qol.sp` | 1.1.0: reconexión, equipamiento, clutch y granadas |
| `server/addons/sourcemod/scripting/csstv_pedir.sp` | Plugin nuevo 1.0.0 |

## Versiones del reporter

| Línea | Versión | Cómo se arma |
|---|---|---|
| Producción (flow y MVZG, y `disabled/` en `aurav34`) | 2.7.6 | `git worktree add --detach <carpeta> 6898c05` y `git apply pruebas/reporter-2.7.6.patch` (incluye la 2.7.5) |
| `kyan/pruebas` | 2.8.6 | En la rama |

Ya no hay línea para `aurav34`: el matchmaking está apagado y su reporter está en `disabled/`.

Builds compilados el 2026-11-02: 2.7.6 licenciado de flow, 128684 bytes; licenciado de MVZG, 128684; genérico, 128662; `csstv_qol` 1.1.0, 21812; `csstv_pedir`, 10376.

## Despliegue (hecho el 2026-11-02)

A pedido de Kyan, en la misma tanda. Antes de reemplazar se comprobó que el reporter que había era la 2.7.5. Cada archivo subido se comparó con el local.

| Servidor | Qué recibió | Respaldo |
|---|---|---|
| flow (`SERVER2_*`) | Reporter 2.7.6 licenciado (128684 bytes), `csstv_qol` 1.1.0 y `csstv_pedir` | `plugins/disabled/csstv_reporter_2.7.5.smx`, `csstv_reporter.cfg.bak_276` |
| MVZG (`SERVER3_*`) | Reporter 2.7.6 licenciado (128684 bytes), `csstv_qol` 1.1.0 y `csstv_pedir` | Los mismos |
| `aurav34` (`SFTP_CSS_*`) | Reporter 2.7.6 genérico en `plugins/disabled/` (128662 bytes, sigue desactivado), `csstv_qol` 1.1.0 y `csstv_pedir` | Los mismos |

- En los tres, `csstv_qol.cfg` recibió las ConVars nuevas al final. `csstv_qol_end_kick` sigue en `40` en MVZG y en `0` en flow y `aurav34`.
- `csstv_reporter.cfg` recibió `csstv_tech_time "120"`.
- `csstv_pedir.cfg` lo crea el plugin la primera vez.
- En `aurav34` el reporter no está cargado, así que ahí `csstv_qol` y `csstv_pedir` no hacen nada (sin reporter no hay calentamiento ni partida en vivo), salvo la C4 de un jugador quieto, que se saltea con el retake prendido.

## Pruebas con bots (`cssds`, 2026-11-02)

`pruebas/qol3.sh` con el reporter de depuración (2.8.6 y después 2.7.6), `csstv_qol`, `csstv_pedir` con `PEDIR_DEBUG` (`sm_pedir_fake` y `sm_pedir_fakeuse` hacen de la R y la E) y `pruebas/qol_prueba.sp`.

| Prueba | Resultado |
|---|---|
| `!tech` a mitad de ronda | "Bert pidió una pausa técnica… Empieza al inicio de la próxima ronda", y en la siguiente "Pausa técnica del Equipo Bert. Dura 120 segundos…" |
| `!unpause` de los dos | "Los dos equipos están listos. Se sigue en 3 segundos." |
| Segunda `!tech` en la misma mitad | "Tu equipo ya usó su pausa técnica en esta mitad." |
| Pedir un arma | Albert pide AK-47 y Allen aprieta E: Allen pasa de $5000 a $2500, y Albert tiene `weapon_ak47` |
| `sm_eq` | "[T] Albert: AK-47 · Glock · sin chaleco · $150", "[CT] Bert: XM1014 · USP · chaleco y casco · humo · $50"… |
| Clutch | `sm_qol_status`: "clutch: Albert 1 vs 2" |
| Reconexión (vivo, con AK y $3700) | Se lo saca y vuelve a entrar. En la ronda siguiente: `weapon_ak47` y $3700 (con 2.8.6) |
| Granadas | **No se pudo probar con bots:** no tiran granadas por comando |
| Errores | Ninguno |

### Falta probar con jugadores

1. La R y la E de verdad, y que la R en el freezetime no moleste.
2. La cuenta atrás y la campana.
3. `!nades`: que vuelva la granada, la trayectoria y `!rethrow`.
4. El equipamiento en el chat de cada equipo.
5. Volver después de irse muerto (solo la plata).

## Cómo revertir

- `csstv_pedir "0"`, o sacar `csstv_pedir.smx`.
- Las ConVars de `csstv_qol` en 0, o volver a la 1.0.1.
- El reporter anterior desde `plugins/disabled/` (2.7.5).

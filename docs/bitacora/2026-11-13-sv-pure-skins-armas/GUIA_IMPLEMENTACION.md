# sv_pure con skins de armas: guía de implementación

## Estado

**Revertido** el 2026-11-13: los tres servidores volvieron a `sv_pure 2`, y las skins de armas no se pueden usar. Se revirtió porque con `sv_pure 1` los jugadores se quedaban en "conectando" en varios mapas nuevos. Kyan lo confirmó probando: con `sv_pure 1` no entraban, con `0` y con `2` sí (ver "Incidentes").

Se desplegó en #1, #2 y #3 el 2026-11-13 a las 03:05 (hora del panel) sin probar con un jugador.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/pure_server_whitelist.txt` | Nuevo: la whitelist |
| `CLAUDE.md` | Configuración obligatoria: `sv_pure 1` con la whitelist |
| `docs/manual/jugador/skins-de-armas.md` | Nueva página |
| `docs/manual/servidor-externo/configuracion-obligatoria.md` | `sv_pure 1` con la whitelist |
| `web/frontend/src/features/legal/pages/TermsPage.tsx`, `terms/terminos.html` | Excepción de las skins de armas en "Juego limpio" |
| `docs/bitacora/2026-11-13-sv-pure-skins-armas/` | Esta carpeta |

## Despliegue (hecho el 2026-11-13)

Por la API del panel de MVZG, en los tres servidores, sin reiniciar ni cambiar de mapa. Cada archivo se volvió a bajar para comparar.

1. `cstrike/pure_server_whitelist.txt` (copia de `server/pure_server_whitelist.txt`).
2. `sv_pure 2` → `sv_pure 1` (y `"2"` → `"1"`) en `cfg/server.cfg` (dos líneas), `cfg/autoexec.cfg` y, solo en el #1, `cfg/game.cfg`. Respaldo de cada uno en `cfg/<archivo>.bak_pure`.

## Pruebas

No se probó en el servidor local: Kyan decidió que no hacía falta por ser solo configuración. Para comprobarlo en un servidor, después del cambio de mapa:

1. Con una skin de AK en `cstrike/`: tiene que verse la skin.
2. Con una textura de pared modificada: tiene que verse la original.
3. `sv_pure` en la consola del servidor tiene que decir `1`.

## En qué se apartó del plan

Ninguno.

## Incidentes durante las pruebas

**Con `sv_pure 1` nadie podía entrar (2026-11-13).** Desde el primer cambio de mapa después del despliegue, los jugadores se quedaban en "conectando" en los tres servidores (cbble_go_t1 en el #3 a las 03:33, train_t5 en el #1 a las 03:41, nuke_cs2 en el #2 a las 03:47, tuscan_ob en el #3 a las 03:52, con salas del matchmaking tomadas). Al reintentar, el anticheat (`kigen-ac_redux_legacy`) los echaba un minuto por "spam connecting" y el juego mostraba "Banned by server".

- Se comparó la hora del cambio de `sv_pure` en el panel (03:04–03:05) con la de los logs de SourceMod como si fueran el mismo reloj, y pareció que todo había fallado justo después. **No es así:** el panel está en UTC y los logs de SourceMod en hora de Argentina (UTC−3). El cambio fue a las 00:04 hora local, y después se jugaron season, tuscan, mirage y un mix entero de `de_inferno_plus` sin problemas. Las fallas empezaron a las 03:33 hora local, en algunos mapas (`de_cbble_go_t1`, `de_train_t5`, `de_nuke_cs2`, `de_tuscan_ob`).
- Se volvió a `sv_pure 2` desde los respaldos `.bak_pure` en los tres, con el ok de Kyan, y se revirtieron el manual, los términos y `CLAUDE.md`. La `pure_server_whitelist.txt` quedó en `cstrike/` de cada servidor: con `sv_pure 2` el juego no la lee.
- Con `sv_pure 2`, Kyan informó que funcionan todos los mapas.
- **Confirmado por Kyan:** con `sv_pure 1` los mapas nuevos no funcionaban y con `sv_pure 0` sí (probado con cbble).

**Causa:** `sv_pure 1` con esta whitelist. Con `de_inferno_plus` no falló, así que depende del mapa. Hipótesis no comprobada: la regla `materials\... from_steam` choca con los materiales que esos mapas traen dentro del `.bsp` y que pisan rutas del juego original; con `sv_pure 2` la whitelist no se usa y con `0` no hay control. No se llegó a ver la consola de un jugador trabado.

Lecciones:

- Los logs de SourceMod (`L*.log`) están en hora de Argentina y el panel de MVZG en UTC.
- `sv_pure 1` no se pone en producción sin probar antes con un jugador en cada mapa del `mapcycle`, guardando la consola (`con_logfile`) si se traba.

## Cómo revertir

En cada servidor, copiar `cfg/server.cfg.bak_pure`, `cfg/autoexec.cfg.bak_pure` (y en el #1 `cfg/game.cfg.bak_pure`) sobre sus originales y borrar `cstrike/pure_server_whitelist.txt`. Revertir el commit en el repo.

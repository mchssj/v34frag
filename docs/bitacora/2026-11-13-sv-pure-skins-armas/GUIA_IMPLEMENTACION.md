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

- Las horas del panel y de los logs de SourceMod son las dos de Argentina (el `modified_at` del panel trae `-03:00`). En un momento se cortó ese desfase al leerlo, se creyó que había 3 horas de diferencia y se dudó del diagnóstico. Era un error: la línea de tiempo de arriba es la correcta. El mix entero de `de_inferno_plus` (02:35–03:17) fue **antes** del cambio.
- Se volvió a `sv_pure 2` desde los respaldos `.bak_pure` en los tres (04:01), con el ok de Kyan, y se revirtieron el manual, los términos y `CLAUDE.md`. La `pure_server_whitelist.txt` quedó en `cstrike/` de cada servidor: con `sv_pure 2` el juego no la lee.
- **Confirmado por Kyan:** con `sv_pure 1` los mapas nuevos no funcionaban y con `sv_pure 0` sí (probado con cbble en el #2). Con `sv_pure 2`, funcionan todos.

**`sv_pure` entra un cambio de mapa después.** El mapa que ejecuta `server.cfg` usa el valor que había antes. Por eso:

- El #2 cambió de mapa a las 04:04 y 04:05: el primero siguió con `sv_pure 1`, desde el segundo funcionó.
- El **#3** no cambió de mapa entre las 03:54 y las 14:47. En ese cambio (sala del matchmaking en `de_dust2_ob`) todavía corría `sv_pure 1` y los jugadores se quedaron en "conectando". Se culpó por error al reporter 2.10.2, que se había subido a las 11:52 (ver [`2026-11-13-ready-automatico`](../2026-11-13-ready-automatico/)), y se volvió a la 2.10.1 en los tres. La misma gente entró sin problemas en el #2 a las 14:54.
- El #1 no había cambiado de mapa desde las 03:59: se le mandó `sv_pure 2` por la consola (API del panel) para que el próximo mapa ya lo use.

**Causa:** `sv_pure 1` con esta whitelist. Con `de_inferno_plus` no se llegó a probar con `sv_pure 1`. Hipótesis no comprobada: la regla `materials\... from_steam` choca con los materiales que esos mapas traen dentro del `.bsp` y que pisan rutas del juego original; con `sv_pure 2` la whitelist no se usa y con `0` no hay control. No se llegó a ver la consola de un jugador trabado.

Lecciones:

- Los logs de SourceMod y el panel de MVZG están en la misma hora: no cortar el `-03:00` del panel.
- Un cambio de `sv_pure` en `server.cfg` entra en el segundo cambio de mapa: mandarlo también por consola.
- `sv_pure 1` no se pone en producción sin probar antes con un jugador en cada mapa del `mapcycle`, guardando la consola (`con_logfile`) si se traba.

## Cómo revertir

En cada servidor, copiar `cfg/server.cfg.bak_pure`, `cfg/autoexec.cfg.bak_pure` (y en el #1 `cfg/game.cfg.bak_pure`) sobre sus originales y borrar `cstrike/pure_server_whitelist.txt`. Revertir el commit en el repo.

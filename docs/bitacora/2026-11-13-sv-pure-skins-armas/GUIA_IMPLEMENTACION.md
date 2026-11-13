# sv_pure con skins de armas: guía de implementación

## Estado

**Revertido** el 2026-11-13: los tres servidores volvieron a `sv_pure 2`. Con `sv_pure 1` los jugadores se quedaban en "conectando" (ver "Incidentes"). Las skins de armas no se pueden usar.

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

- Primero pareció un problema de los mapas nuevos, pero los jugadores tenían los mismos archivos que el servidor, y `de_inferno_plus` había jugado un mix entero a las 02:35, antes del cambio, con el FastDL nuevo ya puesto.
- Todo lo que falló fue después del cambio de `sv_pure` (03:04–03:05).
- Se volvió a `sv_pure 2` desde los respaldos `.bak_pure` en los tres, con el ok de Kyan. La `pure_server_whitelist.txt` quedó en `cstrike/` de cada servidor: con `sv_pure 2` el juego no la lee.
- Se revirtieron el manual, los términos y `CLAUDE.md`.

Conclusión: el juego v34 con ClientMod no soporta `sv_pure 1` con una whitelist propia, o se traba al comprobarla. Para volver a intentarlo, probar antes en el servidor local con un jugador entrando.

## Cómo revertir

En cada servidor, copiar `cfg/server.cfg.bak_pure`, `cfg/autoexec.cfg.bak_pure` (y en el #1 `cfg/game.cfg.bak_pure`) sobre sus originales y borrar `cstrike/pure_server_whitelist.txt`. Revertir el commit en el repo.

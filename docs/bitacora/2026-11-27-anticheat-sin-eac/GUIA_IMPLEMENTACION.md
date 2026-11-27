# Anticheat sin el EAC de ClientMod: guía de implementación

Implementado en la rama `kyan/ac` (worktree `v34frag-ac`) el 2026-11-27, **sin commit y sin desplegar**. Sigue a los tres requerimientos de Kyan del mismo día ([ver el juego](../2026-11-27-anticheat-ver-el-juego/), [ventana nueva](../2026-11-27-anticheat-ventana-nueva/) y [detección](../2026-11-27-anticheat-deteccion/)), que tampoco están desplegados.

## Qué cambió respecto del plan

| Plan | Qué se hizo | Por qué |
|---|---|---|
| `ac_server_policy.enforce text` (`off`, `mixes`, `always`) en lugar de `enforce_mixes` | `enforce_always boolean`, al lado de `enforce_mixes`. El modo se calcula (`ac_server_mode`) | No rompe la demo (`anticheat-demo.mts`) ni las pruebas de integración de Kyan, que insertan `enforce_mixes` |
| IPv6: apagarlo en Cloudflare o mandar aparte la IPv4 | Con familias distintas no se compara: juega y queda la marca `ip_family` | No depende de un cambio en Cloudflare que afecta a toda la web. Se puede endurecer después |
| El servicio de EAC como señal por sí sola | Solo si no se pudo leer `clientmod.ini` | Otro juego con EAC (Fortnite, por ejemplo) también prende el servicio: habría expulsado con `AC-6` a quien tiene el EAC de ClientMod apagado |
| `denied` como señal por sí sola | Solo con el servicio de EAC corriendo | Sin el servicio, la causa suele ser el juego abierto como administrador |
| La política de #1, #2 y #3 por SQL | Desde el panel, pestaña **Servidores** | Daniel lo pidió (2026-11-27) |
| (No estaba) | `AC-0` para el SteamID que no se lee, y `OnMapStart` borra los avisos pendientes | Salieron en la revisión del Bridge |
| (No estaba) | `/seguridad` y las preguntas frecuentes, además de `/terminos` y `/privacidad` | Decían lo mismo que la privacidad vieja |
| Tres modos en el panel | Solo **Siempre** y **No lo exige**. "Solo en la partida" se muestra si un servidor ya lo tiene, sin dejar elegirlo | Daniel (2026-11-27), en la prueba: quien entra sin el anticheat juega el calentamiento y lo expulsan al arrancar el mix |
| (No estaba) | Bridge 1.4.0: 1 minuto para el `!claim` a quien entra con un SteamID sin vincular, y `AC-0` también en Siempre | Daniel (2026-11-27): con Siempre, la 1.3.0 sacaba a los 20 s a quien venía a su primera partida o desde otra PC |
| (No estaba) | `cml_aimstats` 1.0.1: el envío en lotes de 12 (System2 corta en 2048 bytes), el historial de la mira borrado al empezar el mix y cada ronda, y sin las kills a un compañero ni las de granada | Revisión del plugin de Kyan antes de subirlo (Daniel, 2026-11-27) |
| (No estaba) | Plantillas `server/cfg/sourcemod/cml_anticheat.cfg` y `cml_aimstats.cfg` | Para el despliegue: antes solo estaba descrito |
| (No estaba) | El latido firmado con el token vencido responde 401 | Salió en la prueba en el servidor local: con 403, el agente se quedaba sin latidos a los 15 minutos |

## Pruebas hechas

| Qué | Cómo | Resultado |
|---|---|---|
| Base: la `159` sin "Solo en la partida" y con `always` en la respuesta | La copia local ya tenía la `159`: su inversa, la `159` y los casos, con `rollback` | 26 de 26 (3 nuevos: `always` en la respuesta y el SteamID sin vincular). Las dos funciones nuevas quedaron aplicadas en la copia local |
| Base: `155` a `159` (la primera vez) | `pruebas/armar_prueba.sh`: las cinco migraciones sobre la copia local de producción, 23 casos de `pruebas/bridge_159.sql`, la inversa de la `159` y `rollback` | 23 de 23. La inversa deja la base sin las columnas nuevas. **Es la primera vez que se aplican la `155` a la `158`**, y van bien sobre la copia de producción |
| Firmas | El `.sql` de 1.5.14 dos veces sobre las migraciones, con `rollback` | 72 firmas, sin duplicados |
| API | `tsc --noEmit` y `vitest run test/unit` | Sin errores; 582 pruebas, con las 2 del latido con el token vencido (`test/unit/anticheat-heartbeat.test.ts`) |
| Web | `tsc --noEmit`, `eslint` y `vitest` de `features/admin/anticheat` y `features/legal` | Sin errores; 3 pruebas nuevas de **Servidores** y las 11 de las páginas legales |
| Manual | La misma validación del build de la API (`cargarManual`) | 59 páginas, sin errores |
| Bridge 1.4.0 (también la de pruebas, `BRIDGE_DEBUG`) y `cml_aimstats` 1.0.1 | `spcomp` 1.8 del servidor de pruebas (`E:\CSS DEDICATED SERVER\server`) | Compilan sin advertencias |
| Agente 0.6.0 | `agent/build.bat` (`/W4 /WX`) | Compila sin advertencias |
| Detección del EAC | `CMLeagueAC_test.exe --detect` con un juego falso (`pruebas/juego_falso.c`, copiado como `CMLauncher.exe` y `ClientModEAC.exe`) | Sin `.ini`: no es el juego. `Anticheat=true`: `eac` por `ini`, sin buscar accesos. `Anticheat=false`: sin EAC, la búsqueda de accesos tarda 78 ms. Lanzado por `ClientModEAC.exe`: `eac` por `parent` |
| Ventana | `--render eac` | [`pruebas/ventana-eac.png`](pruebas/ventana-eac.png) |
| API de Servidores, de punta a punta | Con permiso de Daniel (2026-11-27), la `155` a la `159` quedaron **aplicadas en la copia local de producción**. API local (`wrangler dev` en el 8788) con un token de admin local | El listado trae los servidores reales; #1, #2 y #3 pasan a **Siempre** (solo en la base local), el filtro por modo trae esos tres, un modo inválido da 400, un servidor que no existe da 404 y los tres cambios quedan registrados |
| **De punta a punta, en el servidor local** (con Daniel, 2026-11-27) | API y base locales, con `AC_API_SECRET` y `AC_HWID_SALT` locales. El agente de pruebas portátil (`--portable --api http://127.0.0.1:8788`), vinculado a una cuenta admin de la copia local. El Bridge de pruebas (`BRIDGE_DEBUG`) en el servidor de pruebas, contra un servidor de prueba en **Siempre** y con el reporter en `csstv_send 0`. Daniel entró con ClientMod 3.0.1 | **EAC apagado:** juega, y la sesión se renueva cada minuto. **EAC prendido:** el agente lo ve por `ini` y el Bridge expulsa con `AC-6`, con el aviso en el chat. **Agente sin latidos:** `AC-1` con "Para jugar aquí…". **Token vencido:** el agente se quedaba sin latidos a los 15 minutos; arreglado en la API, se recuperó solo. Al terminar se borró todo de la copia local y del servidor de pruebas |
| **Bridge 1.4.0 en el servidor local** (con Daniel, 2026-11-27) | Lo mismo, con la versión de pruebas informando un SteamID sin vincular y el `!claim` del reporter apagado (`csstv_claim 0`). Un script vinculaba ese SteamID en la copia local al ver el `!claim` en el log del juego (`log on`, `sv_logflush 1`) | **Sin `!claim`:** aviso en el chat y expulsión a los 63 s de entrar, con "Para jugar aquí vincula tu SteamID con !claim…". **Con `!claim`:** a los 5 s el Bridge lo revisó de nuevo, abrió la sesión y siguió jugando. Al terminar se borró todo de la copia local y del servidor de pruebas |

## Qué no se probó

- **Lo que dejó la prueba con ClientMod de verdad:**
  - `ClientModEAC.exe` **no** queda vivo como padre del juego: el EAC se detectó por `clientmod.ini`, la señal que queda.
  - Un ClientMod con el EAC prendido **entra igual** a un servidor `-insecure`: el EAC no impide jugar en el nuestro, y por eso hace falta `AC-6`.
  - Falta mirar si, con el EAC apagado, la lista de módulos y la búsqueda de accesos traen lo esperable (la evidencia llegó: 910 eventos de procesos en unos minutos), y si con el EAC prendido la ventana del agente se pone naranja (Daniel no la miró).
- **`AC-0` en Siempre**, con un jugador: en el servidor de pruebas no se puede, porque sin Steam la versión de pruebas informa un SteamID fijo. Lo cubre la prueba de la base (`always` en la respuesta).
- **El servidor de pruebas se cerró una vez** después de una expulsión, sin dump ni error en los logs. No se repitió en las demás expulsiones, que fueron por el mismo camino: no parece el Bridge, pero hay que mirarlo en #1, #2 y #3 después del despliegue.
- La señal `denied`: el EAC se detecta antes por el `.ini`.
- El Bridge en #1, #2 o #3: solo en el servidor de pruebas.
- La pestaña **Servidores** en el navegador: la extensión de Chrome no estaba conectada. Se probó con la API simulada (pruebas de la web) y la API local contra la base local (ver arriba).
- **Para repetir la prueba local:** el servidor de pruebas con `+ip 26.228.23.45` (Radmin), y con `+clientport 27006 +tv_port 27025` si ClientMod ya está abierto: el juego toma el 27005 y el 27020, y con los mismos puertos no se puede entrar ("Retrying"). El agente de pruebas, con `--portable`: sin él se ofrece a instalarse, y la copia instalada se abre sin `--api` y apunta a la API real.
- Las pruebas de integración del anticheat (`test/integration/anticheat.test.ts`): escriben en la base local.
- Una captura de CM Launcher para el manual del jugador. El texto ya dice dónde está (el botón gris, `Anticheat: Disabled` debajo de **Play**), según lo que contó Daniel.

## Despliegue (pendiente)

Todo junto con lo de Kyan, y **en este orden**. Si los servidores pasan a **Siempre** antes de que los jugadores tengan el agente, expulsan a todos.

1. **Llevar el anticheat a `main`** commit por commit. `kyan/ac` sale de `kyan/pruebas` (tienda, VIP y demás): no se mezcla entera.
   - **Renumerar las migraciones.** El 2026-11-27 `main` usó la `155` para otra cosa (`155_mm_sala_oculta_al_aceptar.sql`, aplicada en producción a las 19:58 UTC). Las del anticheat pasan a ser la siguiente libre en adelante, en el mismo orden: hoy, `156_anticheat_juego`, `157_anticheat_deteccion`, `158_anticheat_maquinas`, `159_anticheat_aim` y `160_anticheat_sin_eac`, con sus inversas y las referencias en la bitácora y los comentarios. No tocan ninguna función de esa `155`.
   - La copia local de producción tiene las del anticheat con los números viejos y no tiene la `155` de `main`: al refrescarla, se vuelven a aplicar con los nuevos.
2. **Base, en el VPS** (backup antes, `sudo sb`): confirmar que la `45` a la `47` están aplicadas en producción y aplicar las cinco del anticheat, en orden y con sus números nuevos (ver el paso 1).
3. **API:** `AC_HWID_SALT` en `/etc/cmleague/api.env` (generada en el VPS, `openssl rand -hex 32`) y desplegar desde `main`.
4. **Web:** desplegar desde `main` (Servidores, manual, términos y privacidad).
5. **Firmas de ClientMod:** bajar ClientMod limpio, correr `agent\firmas-clientmod.ps1 -Carpeta <carpeta> -Salida firmas.sql` y aplicarlo por el túnel.
6. **Agente 0.6.0:** el certificado de firma de código (lo compra el equipo), firmarlo, publicarlo en `cmleague.lat` y cargar su hash en **Agente** › hashes permitidos.
7. **Servidores #1, #2 y #3**, en la misma tanda, por SFTP (`SFTP_CSS_*_MVZG`) y **sin un mix en curso**:
   - `addons/sourcemod/plugins/cml_anticheat_bridge.smx` y `cml_aimstats.smx`.
   - `cfg/sourcemod/cml_anticheat.cfg`, de la plantilla `server/cfg/sourcemod/cml_anticheat.cfg`: ya trae `cml_ac_api_url "https://db.cmleague.lat/rest/v1/rpc/"`; en cada servidor se pegan `cml_ac_api_key` (la anon, la misma de `csstv_api_key`) y `cml_ac_server_token` (el mismo `csstv_server_token` de cada uno).
   - `cfg/sourcemod/cml_aimstats.cfg`, la plantilla tal cual (`cml_aim_snap "25.0"`).
   - `cfg/csstv/live.cfg` con `cml_ac_mix 1` al final.
   - Se cargan solos en el próximo cambio de mapa. **No recargar el plugin con una partida en curso.**
   - El de retake, mientras exista, no lo lleva: no es un servidor de partidas.
8. **Avisar a los jugadores** (el `CHANGELOG_DISCORD.txt`, con 2.9.79: `main` usó la 2.9.78 el 2026-11-27 para la sala oculta; si ya se usó, el siguiente libre) y darles unos días para instalarlo.
9. **Panel › Anticheat › Servidores:** #1, #2 y #3 en **Siempre**. Hasta acá, en **No lo exige**.
   - **A decidir por Daniel:** prender también `require_anticheat` del matchmaking (Administración › Matchmaking; en producción está en `false`). Con eso, la cola no deja buscar partida sin el agente vinculado y con latido de los últimos 90 s (`mm_can_queue`, replanteo `48`): quien no lo tiene se entera antes de que le toque una sala, no cuando ya entró al servidor.
10. Quitar "En preparación" de la sección del anticheat en `/terminos`, `/privacidad`, `/seguridad` y las preguntas frecuentes, en el mismo commit.

## Vuelta atrás

- **Rápida, sin desplegar nada:** Panel › Anticheat › Servidores en **No lo exige**, o `sm_ac_open <minutos>` en el servidor.
- **Base:** la inversa de `anticheat_sin_eac` (`reversas/159_anticheat_sin_eac.sql`, con su número nuevo) y después las de Kyan, de la última a la primera.
- **Servidores:** sacar `cml_anticheat_bridge.smx` y `cml_aimstats.smx` de `plugins/` (a `disabled/`), en el próximo cambio de mapa.

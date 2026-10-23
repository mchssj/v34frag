# Íconos en el feed de kills del HUD: guía de implementación

## Estado

**`csstv_hud` 1.1.0 subido el 2026-10-23 al servidor real y a RBK**: se carga en el próximo cambio de mapa. El relay y el HUD 1.1.0 están probados con la partida simulada, y `relay.exe` está armado. Falta pasarle el `.exe` nuevo al streamer y ver una kill real con los campos de ClientMod.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv_hud.sp` | 1.1.0: el evento `kill` lleva `assister`, `assistedflash`, `penetrated`, `attackerblind`, `smoke` y `noscope` |
| `server/addons/sourcemod/plugins/csstv_hud.smx` | Compilado: 14794 bytes, md5 `cce849f760bbef2b5d038a992c96c4bf` |
| `hud/relay/src/protocol.ts` | `KillExtras` en el evento `kill`. Los campos que faltan quedan en 0 |
| `hud/relay/src/state.ts` | `Kill` con los agregados |
| `hud/relay/src/font.ts` | Nuevo: busca y lee `clientmodkillfeed.ttf` |
| `hud/relay/src/config.ts` | `gameDir` en `relay.json` (por defecto `null`) |
| `hud/relay/src/server.ts` | `GET /font/killfeed.ttf` |
| `hud/relay/src/main.ts` | 1.1.0: aviso de la fuente en la consola y `killfeedIcons` en `/api/status` |
| `hud/relay/public/common.js` | Letra de cada arma y de los íconos extra |
| `hud/relay/public/hud.js` y `hud.css` | Feed con íconos, o con texto si no hay fuente |
| `hud/relay/scripts/simular.ts` | Kills con asistencias, flash, wallbang, ciego, humo y no scope |
| `hud/relay/test/relay.test.ts` | Evento nuevo, evento viejo y búsqueda de la fuente (19 pruebas) |
| `hud/relay/README.md` | `gameDir` y el aviso nuevo de la consola |

## Pruebas (PC de Daniel, 2026-10-23)

- **Plugin:** compila sin errores con el spcomp 1.8 del servidor local. **No se probó en un servidor**: no se vio un `player_death` real con los campos de ClientMod.
- **Campos en los servidores:** se leyó por SFTP, sin cambiar nada, `cstrike/resource/modevents.res` del servidor real y de RBK. Los dos tienen `assister`, `assistedflash`, `penetrated`, `attackerblind`, `smoke` y `noscope`, y tienen `clientmod_deathnotice.smx` (script: `modevents_check.py`, en el scratchpad de la sesión).
- **Relay:** 19 pruebas y el typecheck, sin errores.
- **HUD:**
  - Con el relay, `pnpm simular 1` y `gameDir: null`, el relay encontró la fuente en `C:\CSSv34_ClientMod`, `/font/killfeed.ttf` respondió 200 y el feed salió con íconos.
  - Una vista fija con todos los casos (asistencia, asistencia con flash, wallbang, no scope, humo, ciego, HE, calavera y cuchillo), con el mismo `hud.css`: se ve bien.
- **`relay.exe` 1.1.0:** 92,7 MB, md5 `0d5b6c8491fd8c2fcc5d71e112e10e85`. Arranca, encuentra la fuente y `/api/status` dice `killfeedIcons: true`.

## Despliegue (hecho el 2026-10-23)

Con `subir_hud_110.py` (en el scratchpad de la sesión). Antes de subir nada, comprobó que el `.smx` del real fuera la 1.0.0 y que en RBK no existieran ni el plugin ni el cfg. Después de subir cada archivo, lo volvió a bajar y comparó el md5.

1. **Servidor real** (`SFTP_CSS_*`): `cstrike/addons/sourcemod/plugins/csstv_hud.smx` (md5 `cce849f760bbef2b5d038a992c96c4bf`). El cfg no cambia. Se carga en el próximo cambio de mapa o con `sm plugins reload csstv_hud`, que no corta partidas porque es un plugin aparte del reporter.
2. **RBK** (`SERVER1_*`), en la misma tanda, **por primera vez**:
   - El mismo `.smx` (es sin licencia).
   - `cstrike/cfg/sourcemod/csstv_hud.cfg` con `csstv_hud "0"` y sin host ni clave (744 bytes, md5 `b083509e3962c5df2af154d5d7ad9467`). No manda nada.
   - Ya tenía `socket.ext.so`.
3. **Streamer (pendiente):** el `relay.exe` nuevo. Su `relay.json` sirve igual. Si ClientMod no está en `X:\CSSv34_ClientMod`, hay que agregar `"gameDir"`.

El relay 1.0.0 con el plugin 1.1.0, o al revés, funciona: los campos nuevos se ignoran o quedan en 0.

## Segunda parte: relay 1.2.0 (2026-10-23)

Daniel pidió, después de probar la 1.1.0:
- Bajar el feed de kills, porque tapaba la barra negra de arriba del espectador. Decidió combinar el HUD del juego con el nuestro para que se siga viendo el nombre del jugador mirado, y apagar el deathnotice del juego.
- Íconos también en la lista de jugadores.

| Archivo | Cambio |
|---|---|
| `hud/relay/src/font.ts` | `findFont(gameDir, "killfeed" o "cs")`: busca también `cs.ttf`, para el kit |
| `hud/relay/src/server.ts` | `/font/killfeed.ttf` y `/font/cs.ttf`. Cualquier otro nombre da 404 |
| `hud/relay/src/main.ts` | 1.2.0. `kitIcon` en `/api/status` |
| `hud/relay/public/common.js` | `EQUIP` (chaleco, casco, granadas y C4) y `DEFUSER` |
| `hud/relay/public/hud.js` | Tarjetas y enfocado con íconos (`cardIcons`, `nadeIcons`, `armorIcon` y `kit`). Con texto si no hay fuente |
| `hud/relay/public/hud.css` | Feed en `top: 122px`. Estilos de los íconos, sin `text-transform`, porque en la fuente `w` (M4A1) y `W` son íconos distintos |
| `hud/relay/test/relay.test.ts` | Búsqueda de las dos fuentes (19 pruebas) |

**Pruebas:**
- 19 pruebas y el typecheck, sin errores.
- El HUD con `pnpm simular 1` encima de una captura del juego (`image.png` de Daniel) escalada a 1920×1080. El feed queda debajo de la barra negra. Las armas, las granadas, el chaleco, la C4 y el kit salen con íconos.
- Un error encontrado en la prueba: el `text-transform: uppercase` de la columna del arma convertía la `w` en `W`, y salía un ícono de munición. Corregido.
- **`relay.exe` 1.2.0:** 92,7 MB, md5 `cb27ec4f389d74a0cf414f0c18ce24e8`. Arranca y `/api/status` dice `killfeedIcons: true` y `kitIcon: true`. Tiene ícono para las 24 armas de fuego, el cuchillo, las tres granadas y la C4. La flash y el humo en la mano usan los íconos de equipamiento (`P` y `Q`), porque no tienen ícono de kill.

- **Flash y humo:** en la fuente son dos latas casi iguales. A pedido de Daniel, que pasó fotos de referencia de los modelos del juego (`fb.jpg` y `sg.jpg`), la flash lleva un borde ámbar (`#f2a91d`, el de sus franjas) y el humo uno gris (`#9a9d98`), alrededor de la silueta blanca. Probado con capturas ampliadas: se distinguen.

**Despliegue:** solo el `relay.exe` 1.2.0 para el streamer. El plugin no cambia.

## En qué se apartó del plan

- La bomba (`c4` y `env_explosion`) usa el ícono de la C4 (`I`) en lugar de la calavera.
- La 1.2.0 (feed más abajo e íconos en las tarjetas) no estaba en el plan: la pidió Daniel después de probar la 1.1.0.

## Cómo revertir

- **Plugin:** volver a subir el `csstv_hud.smx` 1.0.0 (md5 `72645cac9e61aa5ad768586eee72d06d`, del commit `b25b970`).
- **Relay:** volver al `relay.exe` 1.0.0, o borrar `"gameDir"` y renombrar la fuente para que el feed vuelva a los nombres.
- **Repo:** revertir el commit de este requerimiento.

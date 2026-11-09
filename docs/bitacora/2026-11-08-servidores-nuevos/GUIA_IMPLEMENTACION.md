# Servidores nuevos #2 y #3: guía de implementación

## Estado

**Armados el 2026-11-08** (Kyan lo aprobó ese día). Los dos están prendidos, con la configuración del #1, pero todavía no mandan datos a la base ni toman salas.

## Qué se hizo

1. **Copia del #1:** se bajó por SFTP a una carpeta temporal fuera del repo. Del #1 solo se leyó: no se tocó nada.
2. **Limpieza:** se sacaron los logs, la cola y los envíos del reporter, `sqlite`, los `.bak` y las versiones viejas de `plugins/disabled/` (quedó `Anti_Wallhack_Lite.smx`, como en el #1).
3. **Lo propio de cada uno:** los cambios de la tabla de [`DOCUMENTACION.md`](DOCUMENTACION.md).
4. **Subida a #2 y #3** por SFTP. Antes se renombraron los archivos originales que se iban a reemplazar a `.bak_original`.
5. **Mapas:** los 17 que faltaban, unos 235 MB, entre ellos `de_dust2_ob`, `de_mirage_rc1`, `de_cache`, `de_season` y `$2000$`.
6. **Variables de arranque** por la API: `SERVER_NAME`, `SRV_STARTMAP` y `Boot_Custom_Command`. `TICKRATE` devolvió "read-only".
7. **Dos reinicios** por la API, con los dos vacíos. `clientmod_deathnotice` parchea el evento en el primer arranque y pide reiniciar. En el segundo cargó sin error.

## Pruebas hechas

- **Lo subido:** se volvió a bajar todo de #2 y #3 y coincide byte a byte con la copia preparada (`diff -r`). Los 17 mapas tienen el mismo tamaño en los tres servidores.
- **Los logs de SourceMod** de los nuevos, después del segundo arranque:
  - Sin errores nuevos.
  - Los dos avisos que quedan, el `adminmenu_cfgs.txt` mal formado y el permiso de `CM_PickupWeapon`, también aparecen todos los días en el #1, así que no son de la copia.
  - `csstv_perf` mide: `fps_max 600` y tasas 100/101 como el #1, pero el tickrate en 64.
- **El log del juego** (`logs/L*.log`) está apagado (`log off`), igual que en el #1.
- **No se probó:** un mix con jugadores, el reporter mandando a la base, las salas del matchmaking ni las demos. Faltan el token y que se saque `-nohltv`.

## Lo que falta

### MVZG (lo pide Daniel o Kyan)

- Sacar `-nohltv` de la línea de arranque de `cd1be322` y `16c850ff`. Sin eso no hay SourceTV ni demos.
- Pasar `TICKRATE` a 100 en los dos.

### Daniel o Kyan, en la web

1. Administración › Servidores, "Agregar":
   - "Server CM League #2": `190.104.34.3:27030`, tag `srv2`, `tv_port` `27066`.
   - "Server CM League #3": `190.104.34.3:27031`, tag `srv3`, `tv_port` `27067`.
   - Al crearlos, la web da el token y el HUD (`csstv_hud_port` y `csstv_hud_key`) de cada uno. Pasárselos a Claude o ponerlos en el `.env`, sin pegarlos en el chat.
2. Pasar la fila de flow (`cedf12a8-…`) a "flow (histórico)", fuera del matchmaking. Lo mismo con el de retake cuando se dé de baja.

### Con el token (Claude o quien lo tenga)

1. En `cfg/sourcemod/csstv_reporter.cfg` de cada uno:
   - `csstv_server_token` con su token;
   - `csstv_send "1"`, `csstv_mm "1"` y `csstv_claim "1"`, como en el #1.
2. En `cfg/sourcemod/csstv_hud.cfg`: `csstv_hud "1"`, con su puerto y su clave.
3. Esperar al próximo cambio de mapa, o reiniciar si están vacíos. Después, revisar que `last_seen_at` se actualice en la base.
4. Un mix de prueba en cada uno antes de abrirlos al matchmaking.

### Worker de demos (`v34frag-demos`)

- `wrangler secret put PTERO_KEY_cd1be322` y `PTERO_KEY_16c850ff`, con la misma key que `PTERO_KEY_157703b5`.
- `wrangler secret delete PTERO_KEY_f337a7d9` (flow).

### Despliegues desde ahora

Todo plugin o cambio de configuración va a #1, #2 y #3 en la misma tanda, con el `.smx` genérico. Al de retake también, mientras exista. Ya está así en el `CLAUDE.md`.

## Cambios respecto del plan

- `TICKRATE` no se pudo cambiar por la API: es de solo lectura.
- El mapa de inicio quedó en `de_dust2` en lugar de `de_dust2_ob`, para no depender de un mapa que se subía en el mismo momento. Se puede cambiar por la API.
- No se usó `comparar.py`, porque compara por SFTP con los accesos viejos. Se comparó con `diff -r` contra la copia del #1.

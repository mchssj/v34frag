# RBK igual a nuestro servidor: guía de implementación

## Estado

**Subido el 2026-10-22.**
- **Servidor real:** las dos cvars se cargan en el próximo cambio de mapa.
- **RBK:** **falta que Daniel lo reinicie desde el panel**. Metamod (Stripper) y las extensiones nuevas solo cargan al arrancar.

## Cómo se hizo

1. **Comparación de solo lectura** ([`pruebas/comparar.py`](pruebas/comparar.py)):
   - Archivo por archivo, de `addons/`, `cfg/`, `mapcycle.txt` y la carpeta raíz, sin mapas, sonidos ni logs.
   - Salieron 231 diferencias, la mayoría restos sin uso y el respaldo `addons/sourcemod_1.8_backup/` de RBK.
   - Después se bajaron aparte `cfg/csstv/`, `start.sh` y `addons/stripper/`, que la comparación había salteado.
2. **Plan aprobado por Daniel:**
   - RBK igual en todo, con Stripper.
   - En los dos servidores, 12000 de plata en la prórroga y 5 s de pausa en el medio tiempo.
   - Daniel reinicia RBK.
3. **[`pruebas/rbk_igual.py`](pruebas/rbk_igual.py), en dos pasadas:**
   - `inspect`, solo lectura: comprueba que los archivos nuevos no existan, que cada línea a cambiar aparezca una sola vez y que se puedan hacer los movimientos.
   - `apply`: sube cada archivo, lo vuelve a bajar y compara el md5. Si algo no coincide, se detiene.
4. **[`pruebas/verif_cfgs.py`](pruebas/verif_cfgs.py):** se bajaron de nuevo los cfgs de los dos servidores y se compararon (resultado abajo).

Respaldos de todo lo reemplazado o movido: solo en local, carpeta `respaldo_rbk_2026-10-22/` del scratchpad de la sesión. No van al repo porque los cfgs tienen contraseñas.

## Cambios

### Servidor real (`SFTP_CSS_*`)

`cfg/sourcemod/csstv_reporter.cfg`:
- `csstv_ot_startmoney`: 16000 → **12000**.
- `csstv_halftime_delay`: 10.0 → **5.0**.

### RBK (`SERVER1_*`)

| Qué | Archivos |
|---|---|
| **Stripper (nuevo)** | `addons/stripper/bin/*.so` (los 14 binarios Linux del real), `addons/stripper/global_filters.cfg`, `addons/stripper/maps/de_dust2_ob.cfg`, `de_dust.cfg` y `de_dust2_ob`, `addons/metamod/stripper.vdf` y `addons/metamod/metaplugins.ini` |
| **Plugins nuevos** | `csstv_perf`, `SendFileExploitFixV3.3` (+ `gamedata/SendFileExploitFix_csgo_1_2_2021.txt`), `soft_detector` (+ `extensions/soft_detector.autoload`, `.ext.1.ep1.so` y `.ext.2.ep1.so`), `clientmod_emulator` (+ `cfg/sourcemod/plugin.clientmod_emulator.cfg`), `convar_detector` |
| **Plugins reemplazados por los del real** (SourceMod 1.10) | `admin-flatfile`, `adminhelp`, `adminmenu`, `antiflood`, `basebans`, `basechat`, `basecomm`, `basecommands`, `basetriggers`, `clientprefs`, `funcommands`, `funvotes`, `nextmap`, `playercommands`, `reservedslots`, `sounds`, `clientmod`, `clientmod_deathnotice` |
| **Extensión reemplazada** | `updater.ext.so` |
| **Movidos** | `plugins/IGN.smx` → `plugins/disabled/`. `extensions/accelerator.autoload`, `accelerator.ext.so` y `gamedata/accelerator.games.txt` → `addons/sourcemod/accelerator_retirado/` |
| **Cfgs copiados del real** | `cfg/csstv/live.cfg`, `mapcycle.txt`, `cfg/sourcemod/funvotes.cfg` y `addons/sourcemod/configs/adminmenu_custom.txt` |
| **`cfg/sourcemod/csstv_reporter.cfg`** | `ot_maxrounds` 24 → 6, `ot_startmoney` 10000 → 12000 y `halftime_delay` 3.0 → 5.0. Se agregaron `abandon_players "4"`, `abandon_seconds "180"` y `end_delay "15"`, copiadas del real |
| **`cfg/server.cfg`** | `mp_c4timer 40`, `mp_friendlyfire 1`, `sv_pure "2"` (ya estaba en 2 por una línea posterior), `phys_timescale 1.7` y `tv_title "CMLeague SourceTV #2"` |
| **`cfg/game.cfg`** | `sv_pure 2` |

### Verificación (2026-10-22, después de subir)

- **Plugins:** la lista de `.smx` cargados en `plugins/` es idéntica en los dos servidores.
- **Cfgs idénticos:** `live.cfg`, `warmup.cfg`, `end.cfg`, `mapcycle.txt` y `Kigen-AC_Redux.cfg`. `game.cfg` solo difiere en el salto de línea final.
- **`server.cfg`:** solo cambian `hostname`, `sv_password`, `sv_downloadurl` y `tv_title`.
- **`autoexec.cfg`:** solo cambia el `tv_password` de RBK.
- **`csstv_reporter.cfg`:** solo cambian `csstv_demo`, el tag y el token, más las líneas de RBK que tienen los mismos valores que el real usa por defecto.

### Repo

`server/cfg/sourcemod/csstv_reporter.cfg`: `ot_maxrounds "6"`, `ot_startmoney "12000"` y `halftime_delay "5.0"`, igual que los servidores.

## Después del reinicio de RBK (Daniel)

Verificar por SFTP:
- `addons/sourcemod/logs/errors_AAAAMMDD.log` sin errores nuevos (Stripper, `soft_detector`, plugins base).
- `data/csstv/license.txt` actualizado (el reporter validó su licencia).
- `addons/stripper/dumps/` o el log de Metamod muestran que Stripper cargó.
- `logs/csstv_perf_AAAAMMDD.log`: `fps_max 150 → 600`.

En el juego: entrar a un mapa que tenía niebla y comprobar que no está.

## Cómo revertir

Los respaldos tienen los archivos originales de RBK con la misma ruta.
- **Stripper:** borrar `addons/metamod/metaplugins.ini` y `stripper.vdf` (o vaciar `metaplugins.ini`) y reiniciar.
- **Plugins:** devolver los originales del respaldo.
- **Accelerator:** devolver los tres archivos a `extensions/` y `gamedata/`.
- **Cvars:** cambiar las líneas.

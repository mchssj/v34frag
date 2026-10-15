# Servidor RBK: guía de implementación

## Estado

Instalado el 2026-10-13 (plugin 1.7.0 licenciado). **Pendiente:** que el servidor cambie de mapa o se reinicie para cargarlo, y confirmar con `sm_csstv_status` (o con `addons/sourcemod/data/csstv/license.txt` y los logs por SFTP) que dice `v1.7.0` y `Licencia: válida`.

## Archivos

| Archivo en RBK | Cambio |
|---|---|
| `cstrike/addons/sourcemod/plugins/csstv_reporter.smx` | Nuevo: 1.7.0 licenciado para `be0fd76c-…` (83966 bytes, md5 `0666e0022952e0512ead406d52d42701`) |
| `cstrike/addons/sourcemod/extensions/system2.ext.so` | Nuevo: copia de la de nuestro servidor (4044741 bytes) |
| `cstrike/cfg/sourcemod/csstv_reporter.cfg` | Nuevo: el del repo con la anon key, el token de RBK, `csstv_server_tag "rbk"` y `csstv_demo "0"` |
| `cstrike/cfg/csstv/warmup.cfg`, `live.cfg`, `end.cfg` | Nuevos: los del repo |
| `cstrike/addons/sourcemod/logs/` | Carpeta nueva vacía: no existía y SourceMod tenía los logs desactivados ("Logging has been disabled" en `sourcemod_fatal.log`) |
| `cstrike/addons/sourcemod/configs/admins_simple.ini` | Se agregaron kyan (`STEAM_0:0:1342036699`, `99:z`) y daniloev (`STEAM_0:0:875046575`, `98:z`), con los mismos permisos que en nuestro servidor. Los nombres van en líneas de comentario aparte: después de los flags, SourceMod lee el siguiente token como contraseña. Original respaldado como `admins_simple.ini.bak`. |
| `cstrike/addons/sourcemod/data/system2/` | Carpeta nueva vacía (el script la crea; System2 no la necesita para HTTP) |

En el repo no cambia nada: el build licenciado queda en `server/licencias/` (ignorado por git).

## Despliegue (hecho el 2026-10-13)

1. `csstv_license` con el token de RBK: `{"ok": true, "name": "RBK SERVER -> SV V34frag #2", "server_id": "be0fd76c-6bdc-477e-a843-6efc309b5ca9", "expires_at": null}`.
2. `bash server/build_licenciado.sh be0fd76c-6bdc-477e-a843-6efc309b5ca9 rbk`.
3. Script SFTP (`paramiko`, entorno virtual aparte) que aborta si algún archivo ya existe en RBK, sube cada archivo y lo vuelve a bajar para comparar el md5. Todos OK.
4. No se reinició ni se cambió de mapa en RBK (es un servidor de terceros, puede haber gente jugando).

## Pruebas

Ninguna en RBK todavía (no hay consola ni RCON nuestro). El mismo plugin 1.7.0 se probó en el servidor local y corre en el nuestro.

## Incidentes

- SourceMod 1.8 en RBK y 1.10 en el nuestro: se comprobó que los includes del compilador son de 1.8 (`version.inc`), así que los natives existen en RBK.
- En nuestro servidor `data/system2/` solo tiene 7-Zip y no hay `ca-bundle.crt`; el envío HTTPS funciona igual, así que en RBK no se copió.

## Accelerator (2026-10-14)

Instalado con la regla de desplegar también a los servidores externos. El detalle y la reversión están en [`2026-10-14-crash-servidor-accelerator`](../2026-10-14-crash-servidor-accelerator/GUIA_IMPLEMENTACION.md). Se carga en el próximo reinicio de RBK.

## Hallazgo: plugins que SourceMod 1.8 no puede cargar (2026-10-14)

Revisión por SFTP de `logs/errors_20261014.log` en RBK. En cada cambio de mapa aparece:

```
[SM] Failed to load plugin "clientmod.smx": Unable to load plugin (no debug string table).
```

Pasa lo mismo con `CM_PickupWeapon.smx`, `IGN.smx`, `basevotes.smx` y `clientmod_deathnotice.smx`. Son los mismos archivos que en nuestro servidor (mismos tamaños), compilados con un compilador más nuevo que SourceMod 1.8 no sabe leer. Es decir, **RBK hoy funciona sin ClientMod ni esos plugins**.

### Viabilidad de pasar RBK a SourceMod 1.10

| Punto | RBK | Nuestro servidor | Conclusión |
|---|---|---|---|
| Metamod | `metamod.1.ep1.so` 287920 bytes | El mismo binario | Compatible: nuestro 1.10 ya corre sobre él |
| SourceMod | 1.8 (`sourcemod.logic.so` 632288) | 1.10 (`sourcemod.logic.so` 645312) | Hay que reemplazar `bin/` |
| Extensiones de SourceMod | Las de 1.8 | Las de 1.10 | Reemplazar las de la distribución; `socket` y `system2` son iguales |
| Plugins de terceros | Iguales a los nuestros | | Funcionarían todos con 1.10 |
| `csstv_reporter` licenciado | Compilado con includes de 1.8 | El genérico corre en 1.10 | Sin cambios |
| Configs | Propias de RBK | | Se conservan, no se tocan |

### Paso a SourceMod 1.10 (hecho el 2026-10-14, aprobado por Daniel)

Versiones leídas de `sourcemod.logic.so`: RBK tenía **1.8.0.6040**; nuestro servidor tiene **1.10.0.6490**.

- Se bajaron de nuestro servidor `bin/` (5), las 14 extensiones de la distribución de SourceMod, `gamedata/` de la distribución (`core.games/`, `sdkhooks.games/`, `sdktools.games/`, `sm-cstrike.games/`, `funcommands.games.txt`) y `translations/` completo.
- En RBK se subieron 754 archivos: 76 reemplazan a uno existente y 678 son nuevos (casi todos traducciones de otros idiomas). Todos con el md5 verificado.
- Cada archivo reemplazado **se renombró** (no se sobrescribió) a `cstrike/addons/sourcemod_1.8_backup/<misma ruta>`. Renombrar no afecta al proceso que tiene cargado el `.so`; sobrescribirlo en caliente podía tumbar el servidor. El listado de reemplazados y nuevos está en `sourcemod_1.8_backup/MANIFIESTO.txt`.
- **No se tocaron los plugins base** ni `configs/` ni `cfg/`. SourceMod vuelve a cargar en cada cambio de mapa los plugins que cambiaron, y hasta el reinicio sigue corriendo el 1.8 en memoria: los plugins base de 1.10 podrían no cargar en ese intervalo. Los de 1.8 funcionan en 1.10.
- Se activa en el **próximo reinicio** de RBK (no tenemos panel ni RCON de RBK; lo reinicia su dueño).
- Scripts usados (scratchpad de la sesión): `sm110_bajar.py` y `rbk_sm110.py`.

**Verificar después del reinicio** (por SFTP, en `logs/`):
- `errors_*.log` ya no tiene "no debug string table" para `clientmod.smx`, `CM_PickupWeapon.smx`, `IGN.smx`, `basevotes.smx` y `clientmod_deathnotice.smx`.
- No hay errores al cargar extensiones (incluida Accelerator) ni de gamedata.
- `data/csstv/license.txt` se actualiza (licencia validada con la 1.8.0).

**Revertir:** por cada ruta de la primera sección de `MANIFIESTO.txt`, devolver el archivo desde `sourcemod_1.8_backup/` a `addons/sourcemod/`; borrar los de la segunda sección (opcional, son traducciones y no estorban); reiniciar.

### Verificación del 2026-10-14 (por SFTP, solo lectura)

Se comprobó que el despliegue no pisó nada propio de RBK:

| Qué | Resultado |
|---|---|
| `plugins/csstv_reporter.smx` | Es el build licenciado (md5 `2830de86…`), lleva adentro el ID de RBK (`be0fd76c-…`) y es la 1.8.0. No es el genérico |
| `cfg/sourcemod/csstv_reporter.cfg` | Sin tocar (última modificación 2026-10-13 20:48): `csstv_server_tag "rbk"` y el token propio de RBK, distinto del nuestro |
| `data/csstv/license.txt` | Actualizado por el plugin al reiniciar (licencia validada con el token de RBK) |
| Archivos reemplazados (`MANIFIESTO.txt`) | 76, todos de la distribución de SourceMod: 5 de `bin/`, 14 extensiones, 14 de `gamedata/` y 43 traducciones de SourceMod. Ninguno fuera de esas carpetas |
| `configs/core.cfg` | Solo se agregaron las dos líneas `Minidump…`; no se quitó ninguna |
| `configs/admins_simple.ini` | No lo tocamos (lo modificó alguien de RBK a las 12:53) |

**RBK reinició a las 20:09 (hora de Colombia):** `L20261014.log` dice `Version "1.10.0.6490"`, Accelerator cargó (aviso `[CRASH] Sigscan for GetSpew failed`, que solo significa que los reportes no traen la salida de consola) y `basevotes.smx` ya carga.

**Problema encontrado y corregido:** `clientmod.smx` ahora sí intentaba cargar, pero fallaba con `Unable to open clientmod: File could not be opened` porque en RBK nunca existió `gamedata/clientmod.txt`. Por eso tampoco cargaban `CM_PickupWeapon.smx`, `IGN.smx` ni `clientmod_deathnotice.smx` ("Could not find required plugin clientmod"). Se copiaron de nuestro servidor `gamedata/clientmod.txt` (md5 `c75e8edd…`) y `gamedata/clientmod_pickup.txt` (md5 `c1694aed…`), que son archivos nuevos en RBK. Verificado tras los reinicios de las 20:14 y 20:17 (hora de Colombia):
- 20:14: `clientmod.smx`, `CM_PickupWeapon.smx` e `IGN.smx` cargaron. `clientmod_deathnotice.smx` parchó el evento `player_death` y pidió reiniciar ("Player_death event successfully patched. Please restart server"), que es lo que hace la primera vez.
- 20:17: cargaron todos. El único aviso es `Failed to auto generate config for CM_PickupWeapon.smx` (permisos de escritura), el mismo que sale en nuestro servidor y no afecta al plugin.
- `license.txt` se actualizó en cada arranque (licencia validada).

### Plugin 1.8.0 licenciado (2026-10-14)

`server/build_licenciado.sh be0fd76c-6bdc-477e-a843-6efc309b5ca9 rbk` → 84060 bytes, md5 `2830de863d1ba8ed347a4672a09df271`. La 1.7.0 quedó en `plugins/disabled/csstv_reporter_1.7.0.smx`. Se carga en el próximo cambio de mapa (o en el reinicio).

## Cómo revertir

Admins: volver a poner `configs/admins_simple.ini.bak` como `admins_simple.ini` (y `sm_reloadadmins` o cambiar de mapa).

En RBK, por SFTP: borrar `plugins/csstv_reporter.smx` (o moverlo a `plugins/disabled/`) y cambiar de mapa. Opcional: borrar `extensions/system2.ext.so`, `cfg/sourcemod/csstv_reporter.cfg` y `cfg/csstv/`. Para cortarle el acceso sin tocar el servidor, revocar su token en Admin > Servidores: el plugin deja de permitir mixes.

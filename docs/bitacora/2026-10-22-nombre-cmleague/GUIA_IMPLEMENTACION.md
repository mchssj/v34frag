# Nombre visible CMLeague: guía de implementación

## Estado

**Hecho, probado con bots y desplegado el 2026-10-22 en el servidor real y en RBK.** Se carga en el próximo cambio de mapa: no se recargó nada.

Decisiones de Daniel: el link de Discord sigue siendo `dsc.gg/v34frag`, y los plugins salen ahora, no con el próximo cambio.

## Archivos del repo

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | 2.4.1. `g_sTag` y `g_sPrefix` por defecto en `CMLeague` |
| `server/addons/sourcemod/scripting/csstv/qol.inc` | `csstv_chat_tag` por defecto `CMLeague` (y su descripción) |
| `server/addons/sourcemod/scripting/csstv/maps.inc` | Motivo del cambio de mapa por votación |
| `server/addons/sourcemod/scripting/csstv/summary.inc`, `csstv/menu.inc` | Comentarios |
| `server/addons/sourcemod/scripting/csstv_sell.sp` | 1.0.1. Autor y prefijo de respaldo |
| `server/addons/sourcemod/scripting/csstv_calladmin.sp` | 1.0.1. Autor, prefijo de respaldo y descripción de `csstv_calladmin_server` |
| `server/addons/sourcemod/scripting/csstv_allchat.sp` | 1.0.2. Autor |
| `server/addons/sourcemod/plugins/*.smx` | Los cuatro compilados con el `spcomp` 1.8 del servidor local, sin errores ni avisos |
| `server/cfg/sourcemod/csstv_reporter.cfg` y `csstv_calladmin.cfg` | `csstv_chat_tag "CMLeague"` y el comentario de `csstv_calladmin_server` |
| `CLAUDE.md` | Título del changelog: `CMLeague X.Y.Z --  Changelog` |

Los cambios en los fuentes los hizo [`pruebas/renombrar_fuentes.py`](pruebas/renombrar_fuentes.py). El script aborta si algún texto no aparece las veces esperadas.

## Despliegue (hecho el 2026-10-22)

### Cfgs: [`pruebas/renombrar_cfg.py`](pruebas/renombrar_cfg.py)

El script reemplaza la línea exacta (una sola coincidencia por línea, si no, aborta), vuelve a bajar cada archivo y lo compara. Los respaldos quedaron solo en local, porque `server.cfg` tiene la contraseña de RCON: carpeta `respaldo_nombre_2026-10-22/` del scratchpad de la sesión.

| Archivo | Servidor real | RBK |
|---|---|---|
| `cfg/server.cfg` | `hostname "CMLeague #1 By ExtremeHost"` y `tv_title "CMLeague SourceTV #1"` | `hostname "CMLeague #2 By ExtremeHost"` |
| `cfg/sourcemod/csstv_reporter.cfg` | `csstv_chat_tag "CMLeague"` | Igual |
| `cfg/sourcemod/csstv_calladmin.cfg` | `csstv_calladmin_server "CMLeague #1"` y el comentario | `"CMLeague #2"` y el comentario |

### Plugins: [`pruebas/desplegar_cmleague.py`](pruebas/desplegar_cmleague.py)

Primero solo inspeccionó y comprobó que cada servidor tuviera las versiones esperadas; si no, no tocaba nada. Después, en cada servidor y por cada plugin:
1. Pasó la versión anterior a `plugins/disabled/<plugin>_<versión>.smx`.
2. Subió la nueva y la volvió a bajar para comparar el md5.
3. Dejó como mucho 3 versiones anteriores de cada plugin en `disabled/`.

| Plugin | Servidor real (`SFTP_CSS_*`) | RBK (`SERVER1_*`) |
|---|---|---|
| `csstv_reporter` 2.4.1 | Genérico, md5 `3a539a8e4d929f3a5c3c6c89d6e9bbb9` (antes 2.4.0 `0c4b2bb4…`) | Licenciado (`build_licenciado.sh be0fd76c-6bdc-477e-a843-6efc309b5ca9 rbk`), md5 `9762bc2bd622fd936060ff9b41fea1a3` (antes `3bbaeaee…`) |
| `csstv_sell` 1.0.1 | md5 `680e9b20e2adcff5979ca1e2262cf0d1` (antes `b0131aaa…`) | Igual |
| `csstv_calladmin` 1.0.1 | md5 `4cfdd0e495efa88d9f3315587809db1c` (antes `bcbf3360…`) | Igual |
| `csstv_allchat` 1.0.2 | md5 `9e2cfff6f076c0a20f9eedbfb1aa8f68` (antes `7ee90391…`) | Igual |

En los dos se borró `disabled/csstv_reporter_2.1.1.smx`. En `disabled/` quedaron las versiones 2.3.0, 2.3.1 y 2.4.0 del reporter, 1.0.0 y 1.0.1 de allchat, y la 1.0.0 de sell y de calladmin.

## Pruebas

### Servidor local con bots (2026-10-22)

`$2000$` con 3 bots T contra 1 CT. Reporter compilado con `CSSTV_DEBUG=`, que deja el chat en el log. `csstv_send "0"` en el cfg local mientras duró la prueba. El cfg local no define `csstv_chat_tag`, así que se probó el valor por defecto. Tiempos cortos: partida `mr2`, `csstv_end_delay 2`, `csstv_lo3 0` y `mp_freezetime 1`.

Script: [`pruebas/nombre.sh`](pruebas/nombre.sh). Salida: [`pruebas/resultado.txt`](pruebas/resultado.txt).

| # | Caso | Resultado |
|---|---|---|
| 1 | `sm plugins list` | All Chat 1.0.2, CallAdmin 1.0.1 y Sell 1.0.1 "by CMLeague"; Match Reporter 2.4.1 "by CSSTV" ✔ |
| 2 | Valor por defecto de `csstv_chat_tag` | `CMLeague`, con la descripción nueva ✔ |
| 3 | Partida `mr2` completa | Todos los mensajes y el resumen final salen con `[CMLeague]`. La última línea mantiene `dsc.gg/v34frag` ✔ |
| 4 | `csstv_chat_tag Prueba` | El prefijo cambia a `[Prueba]`: los servidores toman el nombre del cfg ✔ |

- La primera corrida falló porque el RCON apuntaba a 127.0.0.1. El servidor local escucha en la IP de Radmin.
- **No se probó:**
  - el menú de admin (necesita un jugador);
  - el aviso de `!calladmin` en Discord (el cfg local tiene su propio nombre de servidor);
  - el motivo del cambio de mapa por votación.

  Son el mismo texto leído de la misma cvar o una constante.
- **Limpieza:**
  - El servidor local quedó apagado, con los `.smx` genéricos nuevos de reporter, sell y calladmin. Allchat no estaba instalado y se sacó de nuevo.
  - El cfg local volvió a `csstv_send "1"` y es idéntico al original.
  - La partida de bots de la cola (`srv1-20261022T130851-9547.json`) se movió al scratchpad. No se envió nada.

## Verificar después del cambio de mapa

- El servidor aparece como "CMLeague #1/#2 By ExtremeHost" en la lista.
- El chat sale con `[CMLeague]`.
- `sm plugins list` muestra reporter 2.4.1, sell 1.0.1, calladmin 1.0.1 y allchat 1.0.2.
- En RBK no hay consola: revisar por SFTP que `addons/sourcemod/logs/` no tenga errores de los plugins y que `data/csstv/license.txt` se actualice (licencia validada).

## Cómo revertir

- **Nombre:** cambiar las líneas de los cfgs (o `csstv_chat_tag v34frag` en la consola, al instante).
- **Plugins:** volver a poner `plugins/disabled/<plugin>_<versión anterior>.smx` en `plugins/`. Las versiones anteriores solo difieren en textos.

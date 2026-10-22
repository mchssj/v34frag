# Anti-wallhack apagados y humo más denso: guía de implementación

## Estado

**Aplicado el 2026-10-22 en los dos servidores** (el real y RBK). Se carga en el próximo cambio de mapa: no se recargó nada.

**Ese mismo día, en el servidor real, los anti-wallhack se volvieron a prender como prueba A/B** (ver abajo). Después, también a pedido de Daniel, se volvió a apagar el de KACR en el servidor real. **Estado actual:**
- **Humo:** `2` en los dos servidores.
- **KACR:** `kacr_eyes_antiwall "0"` en los dos servidores.
- **`Anti_Wallhack_Lite.smx`:** cargado en los dos servidores. A RBK se subió el 2026-10-22 (ver abajo).

**Resultado (2026-10-22, Daniel):** "funciona perfecto así, por lo menos por ahora". Queda esta combinación: sin el anti-wallhack de KACR, con `Anti_Wallhack_Lite` y con el humo en `2`.

## Cambios por servidor

| Archivo | Servidor real (`SFTP_CSS_*`) | RBK (`SERVER1_*`) |
|---|---|---|
| `cfg/sourcemod/Kigen-AC_Redux.cfg` | Línea 65: `kacr_eyes_antiwall "1"` → `"0"` (md5 `dd9f1f10…` → `8f4a45cb…`) | Igual (mismo archivo y mismos md5) |
| `cfg/server.cfg` | Línea 148: `clientmod_smoke_type 1` → `2` (md5 `1a4033d8…` → `02a9bc43…`) | Igual (md5 `7e9f128f…` → `b2d0ab13…`) |
| `addons/sourcemod/plugins/Anti_Wallhack_Lite.smx` (14857 bytes) | Movido a `plugins/disabled/` | No existía |

Los dos cfgs se compararon con `diff` contra los originales después de subirlos: en cada uno cambió solo esa línea.

## Cómo se hizo

Con el script [`pruebas/aplicar.py`](pruebas/aplicar.py) (`paramiko`, entorno virtual aparte), en dos pasadas:

1. `inspect` (solo lectura):
   - Comprobó que cada archivo tuviera exactamente una línea con el valor viejo.
   - Comprobó que ningún otro cfg (incluidos `warmup.cfg`, `live.cfg` y `end.cfg`) definiera esas cvars.
   - Comprobó en qué servidor estaba `Anti_Wallhack_Lite.smx`.
2. `apply`:
   - Guarda en local el respaldo de los dos cfgs.
   - Sube cada cfg, lo vuelve a bajar y lo compara.
   - En el servidor real, mueve el plugin a `disabled/`.

**Incidente:** la primera vez que corrió `apply`, el script se cortó por un error de la consola de Windows al imprimir una flecha. Ya había subido el `Kigen-AC_Redux.cfg` del servidor real. Se cambió el script para que saltara lo que ya estaba aplicado, se volvió a inspeccionar y se completó el resto. El respaldo original no se pisó.

**Respaldos** (solo en local, fuera del repo porque `server.cfg` tiene la contraseña de RCON):
- Servidor real: `respaldo_2026-10-22/real/`.
- RBK: `respaldo_2026-10-22b/rbk/`.
- Las dos carpetas están en el scratchpad de la sesión del 2026-10-22.

## Prueba A/B en el servidor real (2026-10-22)

- **Humo:** Daniel probó `clientmod_smoke_type 1` y `2` con `!rcon` y el `2` funcionó bien. Queda en `2` en los dos servidores.
- **Anti-wallhack:** a pedido de Daniel, se volvieron a prender **solo en el servidor real** para ver si los jugadores vuelven a desaparecer, con el script [`pruebas/revertir_awh.py`](pruebas/revertir_awh.py):
  - `kacr_eyes_antiwall "0"` → `"1"`, verificado al volver a bajar el archivo.
  - `plugins/disabled/Anti_Wallhack_Lite.smx` volvió a `plugins/`.
  - Se carga en el próximo cambio de mapa.
  - **RBK queda sin anti-wallhack.** Es una excepción a la regla de los dos servidores, porque es una prueba.
- **Segundo paso (2026-10-22, pedido de Daniel):** en el servidor real se volvió a apagar solo el de KACR (`kacr_eyes_antiwall "0"`, con [`pruebas/kacr_antiwall.py`](pruebas/kacr_antiwall.py), verificado). `Anti_Wallhack_Lite.smx` se queda en `plugins/`. Ahora se prueba ese plugin solo.
- **RBK igual que el servidor real (2026-10-22, pedido de Daniel):** se le subió `Anti_Wallhack_Lite.smx`, el mismo archivo del servidor real (14857 bytes, md5 `373446f5a53ec1572a18df9d9f8a1097`, verificado), con [`pruebas/subir_awh_rbk.py`](pruebas/subir_awh_rbk.py). RBK ya tenía `kacr_eyes_antiwall "0"` y `clientmod_smoke_type 2`, y tiene `sdkhooks`. Se carga en el próximo cambio de mapa.
- **Cómo leer la prueba:**
  - Si con los anti-wallhack prendidos vuelven las quejas en el servidor real (y en RBK no hay), quedan confirmados como la causa y se apagan de nuevo con [`pruebas/aplicar.py`](pruebas/aplicar.py).
  - Si las quejas siguen igual en los dos servidores, la causa es otra: probar `se_clockcorrection_ticks 2`.

## Verificar después del cambio de mapa

1. En la consola, `clientmod_smoke_type` responde `2` y `kacr_eyes_antiwall` responde `0` en los dos servidores.
2. `sm plugins list` muestra "Anti-Wallhack Lite" en los dos servidores.
3. Preguntar a los jugadores después de uno o dos mixes:
   - ¿Siguen viendo jugadores que aparecen y desaparecen?
   - ¿Ahora se escuchan los pasos?
   - ¿Qué tal el humo?
4. Revisar `csstv_perf` de esos mixes con [`pruebas/analizar_perf.py`](pruebas/analizar_perf.py) para confirmar que el servidor sigue igual de limpio.

## Siguiente paso, solo si siguen las quejas

`se_clockcorrection_ticks 2` en `server.cfg`, como único cambio, en los dos servidores. Ver la documentación.

## Cómo revertir

- **KACR:** `kacr_eyes_antiwall "1"` en `Kigen-AC_Redux.cfg`, o `kacr_eyes_antiwall 1` en la consola (se aplica al instante).
- **Humo:** `clientmod_smoke_type 1` en `server.cfg`.
- **Anti-Wallhack Lite:** mover `plugins/disabled/Anti_Wallhack_Lite.smx` de vuelta a `plugins/`.

Preguntar al admin que subió `Anti_Wallhack_Lite.smx` (el 2026-10-20 a la 01:45) por qué lo puso, antes de que lo vuelva a subir.

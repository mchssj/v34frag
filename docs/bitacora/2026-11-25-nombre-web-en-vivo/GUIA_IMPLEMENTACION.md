# El nombre de los jugadores, en un solo plugin: guía de implementación

## Estado

Hecho y probado en el servidor local con bots (2026-11-25), en la rama `fix/nombre-web-en-vivo`. **Sin commit y sin desplegar.** Falta que lo pruebe una persona con su cliente.

## Archivos

| Archivo | Cambio |
|---|---|
| `csstv/webnick.inc`, `csstv_reporter.sp` | 2.10.3: único dueño de los nombres, bloqueo con la partida empezada, limpieza y tope |
| `csstv_qol.sp` | 1.6.0, sobre la 1.5.0 de `main`: sin el bloqueo de nombres |
| `csstv_reporter.cfg` | `csstv_web_names` y `csstv_lock_names` |
| `csstv_qol.cfg` | Sin `csstv_qol_lock_names` |
| `csstv_reporter.smx` | 159360 bytes, md5 `d7c3a9297e9d14559bedea9f8d09ebd4` |
| `csstv_qol.smx` | 33771 bytes, md5 `b7642afa7cb52a6fb600d5b640298209` |

Compilados con `spcomp` 1.8.0.5963.

## Despliegue (pendiente)

1. Los dos `.smx` y las dos cfg a **#1**, **#2** y **#3** en la misma tanda, con respaldo en `plugins/disabled/` y comparados byte a byte. Sin recargar: entran en el próximo cambio de mapa.
2. Comprobar en cada uno que cargaron (`sm plugins list`: 2.10.3 y 1.6.0).
3. **Recién ahí**, la `134` en la base, con el manual, `/terminos` y `/privacidad`. Con un `csstv_qol` viejo en algún servidor, la `134` lo mete a pelearse por el nombre.

## Pruebas

Servidor local con los plugins del #1 y bots. No sale nada a la web.

`pruebas/probar_local.sh`, cambios de nombre en 5 s cuando la ficha llega en vivo:

| Reporter | `csstv_qol` | Cambios |
|---|---|---|
| 2.10.2 | 1.4.0 | 343: bucle |
| 2.10.2 | 1.6.0 | 1 |
| 2.10.3 | 1.5.0 | 12: lo frena el tope |
| **2.10.3** | **1.6.0** | **1** |

Con las dos nuevas, 16 de 16: calentamiento, cuchillo, en vivo, cambio y vuelta, VIP, sin ficha, nombre repetido, cambios seguidos y nombres raros.

`pruebas/nombres.py`: 38 de 38 nombres quedan como se espera (los 12 raros de producción y otros armados). Con un build de prueba que deja pedir a los bots, 10 de 10 nicks reales pedidos a la base **local** por HTTP (incluye comillas en el JSON, emojis y un VIP).

Sin probar: una persona con su cliente (reconexión, reemplazo, cómo se ve cada carácter en su pantalla) y el anticheat, que no revisa a los bots.

## En qué se apartó del plan

- **Un solo dueño.** El plan era que `csstv_qol` le preguntara al reporter (`CSSTV_NameHandled`). Daniel propuso que `csstv_qol` no toque los nombres nunca: no hace falta la native y ninguna mezcla con el `csstv_qol` nuevo entra en bucle.
- **La limpieza de caracteres** la pidió Daniel durante la implementación.
- **1.6.0 y no 1.4.1:** ese día salió la 1.5.0 por otro pedido.
- El tope no acepta cualquier nombre que deje el motor, solo `(1)nick`.

## Incidentes durante las pruebas

La primera corrida se cortó por tiempo y dejó el `srcds` local abierto con los plugins de prueba. Se cerró y se volvieron a poner los del #1.

## Cómo revertir

Los `.smx` de `plugins/disabled/`. Con la `134` aplicada, primero su inversa.

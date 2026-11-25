# Prueba sin `Anti_Wallhack_Lite`: guía de implementación

## Estado

**Movido a `disabled/` en #1, #2 y #3 el 2026-11-25**, sin jugadores conectados y sin recargar. A esa hora los tres seguían con la versión vieja en memoria (Anti-Wallhack Lite 1.3.0 y `csstv_qol` 1.4.0): cambia en el próximo cambio de mapa de cada uno. **Falta verificarlo y probar.**

## Archivos

| Archivo | Cambio |
|---|---|
| `CLAUDE.md`, `docs/PLUGINS_EXTERNOS.md` | La excepción |

## Despliegue (hecho el 2026-11-25)

[`pruebas/desactivar.py`](pruebas/desactivar.py): comprueba el md5, mueve el archivo por la API del panel y verifica.

| Servidor | En `plugins/` | En `disabled/` (md5 `373446f5…`) |
|---|---|---|
| **#1** (`157703b5`) | No | ✓ |
| **#2** (`cd1be322`) | No | ✓ |
| **#3** (`16c850ff`) | No | ✓ |

## Pruebas

Después de un cambio de mapa, `node pruebas/consola.mjs "sm plugins list"`: no tiene que aparecer "Anti-Wallhack Lite" y CSSTV QOL tiene que decir 1.5.0. Es una salida larga: la consola del panel puede perder líneas, así que conviene repetirla. Si sigue cargado, `sm plugins unload Anti_Wallhack_Lite` sin una partida en curso.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

Mover `disabled/Anti_Wallhack_Lite.smx` de vuelta a `plugins/` en los tres. Entra en el próximo cambio de mapa.

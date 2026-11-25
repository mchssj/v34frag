# Sin silencio en el clutch: guía de implementación

## Estado

**`csstv_qol` 1.5.0 subido a #1, #2 y #3 el 2026-11-25** (~15:35 UTC), sin recargar: entra en el próximo cambio de mapa de cada uno. **No se probó en el juego** (el servidor local estaba en uso): compila con `spcomp` 1.8 sin avisos.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv_qol.sp` | Sin `Frame_Mute`, `Mute_Clear`, `Cmd_Voz`, sus variables ni `csstv_qol_clutch_mute` |
| `server/cfg/sourcemod/csstv_qol.cfg` | Sin `csstv_qol_clutch_mute` |
| `docs/manual/jugador/comandos-en-el-servidor.md` | Sin la fila de `!voz` |

**Dos versiones.** La desplegada (1.5.0) es la 1.4.0 de `main` menos el silencio. El `.sp` y el `.smx` del worktree son la **1.5.1**: la 1.5.0 más el cambio de nombres de la ficha (`CSSTV_NameHandled`), que sigue sin desplegar. En `main` está la 1.5.0.

## Despliegue (hecho el 2026-11-25)

Por la API del panel, con [`pruebas/desplegar.py`](pruebas/desplegar.py). Cada archivo se bajó de nuevo y se comparó.

| Servidor | `csstv_qol.smx` | Respaldo | `csstv_qol.cfg` |
|---|---|---|---|
| **#1** (`157703b5`) | `fe36dbcd…` → `a2a8f43e…` ✓ | `plugins/disabled/csstv_qol_1.4.0.smx` ✓ | `68d908c1…` ✓ |
| **#2** (`cd1be322`) | igual ✓ | ✓ | ✓ |
| **#3** (`16c850ff`) | igual ✓ | ✓ | ✓ |
| Retake (`aurav34`) | No se tocó: no se pudo entrar por SFTP. Ahí el silencio no corre (reporter en `disabled/`) | — | — |

## Pruebas

- La 1.4.0 recompilada desde `main` tiene la misma sección de código que el `.smx` de los servidores: la base es la que corre.
- Falta: `sm_qol_status` con `v1.5.0` en los tres y un mix.

## En qué se apartó del plan

Ninguno.

## Incidentes

El panel cortó la conexión después del #1 y antes de escribir en el #2. Se siguió con reintentos; los tres quedaron verificados.

## Cómo revertir

Copiar `plugins/disabled/csstv_qol_1.4.0.smx` sobre `plugins/csstv_qol.smx` en los tres. Entra en el próximo cambio de mapa; `csstv_qol_clutch_mute` vale `1` por defecto.

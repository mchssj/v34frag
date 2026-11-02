# Silenciador automático en la M4A1 y la USP: guía de implementación

## Estado

Probado en local y **desplegado el 2026-11-02 en `aurav34`, flow y MVZG**. **Falta RBK**: su SFTP rechaza la contraseña del `.env`.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv_silencer.sp` | Nuevo |
| `server/addons/sourcemod/plugins/csstv_silencer.smx` | Nuevo |
| `docs/bitacora/2026-11-02-plugin-silenciador/` | Nueva |
| `docs/bitacora/README.md`, `docs/PENDIENTES.md` | Una entrada en cada uno |

## Despliegue (hecho el 2026-11-02)

Se subió `csstv_silencer.smx` a `cstrike/addons/sourcemod/plugins/` por SFTP, sin recargar nada: entra en el próximo cambio de mapa de cada servidor.

| Servidor | Acceso | Resultado |
|---|---|---|
| `aurav34` (CMLeague #3) | `SFTP_CSS_*` | Subido, 7409 bytes |
| RBK | `SERVER1_*` | **No subido**: `Permission denied` |
| flow (CMLeague #2) | `SERVER2_*` | Subido, 7409 bytes |
| MVZG (CMLeague #1) | `SERVER3_*` | Subido, 7409 bytes |

El plugin no lleva licencia, igual que `csstv_sell`: el mismo `.smx` va a todos. No necesita cfg.

## Pruebas

### Con bots (`C:\Users\Agus\Downloads\cssds`, 2026-11-02)

Con `pruebas/silencer_prueba.sp`, de_dust2 y 2 bots:

| Caso | Esperado | Resultado |
|---|---|---|
| M4A1 nueva | `m_bSilencerOn=1` | 1 |
| USP nueva | `m_bSilencerOn=1` | 1 |
| M4A1 ya existente, con el silenciador apagado y reequipada | `m_bSilencerOn=0` | 0 |

Las armas se entregaron con `GivePlayerItem`. Sin errores del plugin en el log.

### Con un jugador (servidor local, 2026-11-02)

Kyan la hizo y dio el ok para desplegar, sin detallar el resultado de cada paso. Los bots no usan menús ni obedecen `buy`, y el sonido y la animación solo se ven desde un cliente. Los pasos previstos:

1. Entrar al servidor local y escribir `!as`: se abre el menú con las dos armas en Activado.
2. Como CT, comprar una M4A1: aparece con el silenciador, se ve bien en la mano y suena silenciada.
3. Comprobar lo mismo con la USP, comprada y la inicial de la ronda.
4. Sacar el silenciador con clic derecho, tirar el arma y levantarla: sigue sin silenciador.
5. Desactivar la M4A1 en `!as` y comprar otra: aparece sin silenciador.
6. Reconectar y abrir `!as`: la opción sigue desactivada.

## En qué se apartó del plan

Ninguno.

## Incidentes durante las pruebas

`srcds.exe -console` lanzado desde un shell sin consola cae con `CTextConsoleWin32::GetLine: !GetNumberOfConsoleInputEvents`. Se resolvió lanzándolo con `Start-Process`, que le da su propia ventana. No tuvo que ver con el plugin.

## Cómo revertir

Borrar `addons/sourcemod/plugins/csstv_silencer.smx` de cada servidor; deja de actuar en el próximo cambio de mapa. Las armas vuelven al comportamiento normal del juego.

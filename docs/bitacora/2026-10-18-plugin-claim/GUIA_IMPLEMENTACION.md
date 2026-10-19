# Plugin 2.2.0 con `!claim`: guía de implementación

## Estado

Hecho y probado en local el 2026-10-18, en la rama `feat/backend-api-fase-1`. **Sin desplegar:** sale en el corte del replanteo, porque con la base de producción actual `claim_with_code` no existe y `!claim` respondería "No se pudo consultar la web".

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv/claim.inc` | Nuevo |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | `#include`, `Claim_Init`, `Claim_ClientReset` y versión `2.2.0` |
| `docs/bitacora/2026-10-18-plugin-claim/pruebas/claim.sh` | Nuevo: la prueba con bots |

El `.smx` del repo (`server/addons/sourcemod/plugins/csstv_reporter.smx`) no se actualiza: sigue siendo la 1.8.0, como desde las versiones anteriores. Se compila al desplegar.

## Despliegue (en el corte, no antes)

Después de aplicar la `15` (y el resto del replanteo) en producción:

1. Compilar sin `CSSTV_DEBUG` con el `spcomp` 1.8 del servidor local:
   `spcomp.exe csstv_reporter.sp -i<scripting>/include -o<salida>/csstv_reporter.smx`
2. **Servidor real** (`SFTP_CSS_*`): el `.smx` genérico, con la 2.1.1 en `plugins/disabled/csstv_reporter_2.1.1.smx`.
3. **RBK** (`SERVER1_*`): su build licenciado (`server/build_licenciado.sh <license_key> rbk`), con la 2.1.1 licenciada en `plugins/disabled/`.
4. Las dos subidas en la misma tanda. Sin recargar: cada servidor la carga en su próximo cambio de mapa, sin mix en curso.
5. **Verificar en cada servidor:**
   - `sm_csstv_status` muestra `v2.2.0`.
   - `!claim` sin código explica cómo conseguirlo.
   - Con una cuenta nueva: generar el código en la web y `!claim <código>` responde "Listo: tu cuenta quedó vinculada".
6. Publicar `CHANGELOG_DISCORD.txt`.

Ningún plugin de los dos servidores registra `sm_claim` (revisado el 2026-10-18 sobre las copias de los 57 `.smx`).

## Pruebas

**Servidor local** con la build `CSSTV_DEBUG` (bots con SteamID falso), el cfg apuntado a la Supabase **local** con el replanteo 01 a 18 y un `game_servers` de prueba con el token del cfg. Los bots escriben con `csstv_debug_fakecmd`. `pruebas/claim.sh`:

| Caso | Respuesta |
|---|---|
| Código bueno, cuenta sin ficha | "Listo: tu cuenta quedó vinculada (cuenta Perfilhiznq)"; se creó la ficha con ese SteamID como principal |
| El mismo SteamID con otro código | "Tu cuenta ya está vinculada a este SteamID" |
| Otro SteamID, código en minúsculas | "Pedido enviado: un admin lo tiene que aprobar"; quedó un `steam_requests` pendiente con el nick |
| El mismo pedido otra vez | "Ya pediste este SteamID: falta que lo apruebe un admin" |
| Código inventado y código vencido | "Código inválido o vencido: generá otro en la web (Mi perfil)" |
| Dos pedidos seguidos | "Esperá 6 segundos antes de probar de nuevo", sin llamar a la base |
| Formato malo y sin código | La instrucción para conseguir el código, sin llamar a la base |
| `csstv_send 0` | "!claim no está disponible en este servidor" |
| Token inválido | "Este servidor no tiene una licencia válida de CSSTV" |

`claim_log` quedó con una fila por cada pedido que llegó a la base, con su nick y resultado. Compila sin advertencias, con y sin `CSSTV_DEBUG`.

**No se probó con jugadores reales:** queda para después del corte (paso 5 del despliegue), junto con las [pruebas manuales de `!match`](../2026-10-15-match-y-status/PRUEBAS_MANUALES.md).

Después de la prueba el servidor local quedó como estaba (plugin md5 `5ca8c752…`, cfg y `license.txt` restaurados, cola vacía).

## En qué se apartó del plan

Ninguno.

## Cómo revertir

- **Antes del corte:** revertir el commit.
- **Después del corte:** volver a subir la 2.1.1 desde `plugins/disabled/` en los dos servidores. Se carga en el próximo cambio de mapa; los vínculos ya hechos quedan en la base.

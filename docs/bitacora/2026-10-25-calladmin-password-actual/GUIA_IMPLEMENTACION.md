# `!calladmin` con la contraseña actual del servidor: guía de implementación

## Estado

Hecho, **probado con bots en el servidor local** y **subido al servidor real y a RBK el 2026-10-25**, a pedido de Daniel. Se carga en el próximo cambio de mapa. Falta la verificación del paso 6.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv_calladmin.sp` | 1.1.0: `ServerConnect` agrega `; password <sv_password>`, `ServerAddress` corta el `; password` viejo del cfg y la línea se escapa para JSON |
| `server/addons/sourcemod/plugins/csstv_calladmin.smx` | Build normal 1.1.0 (21 580 bytes, md5 `68272891142181ede191604b122e9827`). La 1.0.1 era `4cfdd0e495efa88d9f3315587809db1c`, igual a la de los dos servidores |
| `server/cfg/sourcemod/csstv_calladmin.cfg` | El comentario de `csstv_calladmin_address`: solo IP:puerto |
| `docs/bitacora/2026-10-25-calladmin-password-actual/` | Esta bitácora, con `pruebas/connect.sh` |
| `docs/bitacora/README.md`, `docs/PENDIENTES.md` | Fila y nota en el punto 1.19 |

## Despliegue (hecho el 2026-10-25)

Por SFTP, en la misma tanda en los dos servidores. Antes de tocar nada se comprobó que cada uno tuviera la 1.0.1 (md5 `4cfdd0e4…`) y una sola línea `csstv_calladmin_address` con `; password`. Si no, el script abortaba.

| Servidor | Acceso | Verificación (bajando todo de nuevo) |
|---|---|---|
| **Real** | `SFTP_CSS_*` | 1.1.0 con md5 `68272891142181ede191604b122e9827`, 1.0.1 en `disabled/`, cfg con `"45.235.98.57:27062"` y la copia `.bak_20261025` igual a la original |
| **RBK** | `SERVER1_*` | Lo mismo, con `"45.235.98.57:27055"` |

Pasos que se siguieron:

Sin licencia: el mismo `.smx` va a los dos servidores. En cada uno (**servidor real** por `SFTP_CSS_*`, **RBK** por `SERVER1_*`):

1. Mover `addons/sourcemod/plugins/csstv_calladmin.smx` (1.0.1) a `plugins/disabled/csstv_calladmin_1.0.1.smx`.
2. Subir el `.smx` 1.1.0, bajarlo de nuevo y comparar el md5 (`68272891…`).
3. Copia del cfg como `cfg/sourcemod/csstv_calladmin.cfg.bak_20261025`.
4. En `cfg/sourcemod/csstv_calladmin.cfg`, dejar `csstv_calladmin_address` solo con IP:puerto: `"45.235.98.57:27062"` en el real y `"45.235.98.57:27055"` en RBK. Antes los dos tenían `; password <la de siempre>`. Sin este paso funciona igual, porque el plugin corta desde el `;`, pero así el cfg ya no tiene la contraseña escrita.
5. No se recarga nada: se carga en el próximo cambio de mapa. Nunca con un mix en curso.
6. **Verificar:** `sm plugins list` (`CSSTV CallAdmin (1.1.0)`) y, en un momento tranquilo, un `!calladmin` de prueba después de un `!rpw`.

## Pruebas

### Servidor local con bots (2026-10-25)

Builds `CALLADMIN_DEBUG` y `PW_DEBUG`, sin `csstv_reporter` (no se envió nada a la Supabase real). El webhook apuntó a una URL inválida: los 5 reportes terminaron en `HTTP 404 Unknown Webhook` y **ninguno llegó a Discord**. El cuerpo de cada uno quedó en el log. Script: [`pruebas/connect.sh`](pruebas/connect.sh).

| # | Caso | Resultado |
|---|---|---|
| 1 | Sin contraseña, dirección `1.2.3.4:27015` | `connect 1.2.3.4:27015` ✅ |
| 2 | `!pw abc` de `csstv_password` | `connect 1.2.3.4:27015; password abc` ✅ |
| 3 | Dirección vieja `1.2.3.4:27015; password vieja` y `sv_password nueva` | `connect 1.2.3.4:27015; password nueva` ✅ |
| 4 | `sv_password` con comillas y `\` | JSON válido: `connect 1.2.3.4:27015; password a\b"c"` ✅ |
| 5 | `!npw` | `connect 1.2.3.4:27015` ✅ |

En la primera corrida, la prueba 4 falló en el script (un `sed` que no sacaba el prefijo del log), no en el plugin. Se validó el JSON aparte y se corrigió el script.

Al terminar se dejó el servidor local apagado, con la 1.0.1 de `csstv_calladmin`, su cfg y el `server.cfg` iguales a los originales, `csstv_reporter.smx` de vuelta, sin `csstv_password` y con la cola vacía.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

En cada servidor: volver a poner `plugins/disabled/csstv_calladmin_1.0.1.smx` como `plugins/csstv_calladmin.smx` y `csstv_calladmin.cfg.bak_20261025` como `csstv_calladmin.cfg`. Se aplica en el próximo cambio de mapa. En el repo, `git revert` del commit.

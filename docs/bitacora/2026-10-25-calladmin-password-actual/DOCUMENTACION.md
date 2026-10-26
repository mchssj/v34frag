# `!calladmin` con la contraseña actual del servidor: documentación

## Qué hace

El reporte de `!calladmin` en Discord trae, en el campo "Servidor", la línea para conectarse: `connect IP:puerto; password ...`. Desde `csstv_calladmin` 1.1.0, **la contraseña es la que tiene el servidor en el momento del reporte** (`sv_password`), no una escrita a mano en el cfg.

Así, si un moderador cambia la contraseña con `!pw` o `!rpw` ([`csstv_password`](../2026-10-25-plugin-password/DOCUMENTACION.md)), el moderador que llega por el reporte igual puede entrar.

```mermaid
sequenceDiagram
  participant M as Moderador
  participant P as csstv_password
  participant J as Jugador
  participant C as csstv_calladmin
  participant D as Discord
  M->>P: !rpw → sv_password = k3x9mp
  J->>C: !calladmin hay un cheater
  C->>C: IP:puerto del cfg + sv_password actual
  C->>D: connect IP:puerto; password k3x9mp
```

## Reglas

| Caso | Línea del reporte |
|---|---|
| El servidor tiene contraseña | `connect 45.235.98.57:27062; password <la actual>` |
| El servidor no tiene contraseña (por ejemplo, después de `!npw`) | `connect 45.235.98.57:27062` |
| No se sabe la dirección (`csstv_calladmin_address` vacío y sin `ip`) | Sin línea de connect, como antes |

- `csstv_calladmin_address` lleva **solo `IP:puerto`**. Si todavía tiene el formato viejo (`IP:puerto; password ...`), el plugin corta desde el `;` y usa igual la contraseña actual.
- La línea se escapa para JSON: una contraseña del `server.cfg` con comillas o `\` no rompe el mensaje.
- Solo la ve el canal de reportes de Discord (moderadores y admins). Es una excepción buscada a "solo la ve quien la puso" de `csstv_password`: el moderador que llega por el reporte tiene que poder entrar.

## Dónde está cada cosa

| Qué | Archivo / ubicación |
|---|---|
| Código | `server/addons/sourcemod/scripting/csstv_calladmin.sp` (`ServerConnect` y `ServerAddress`) |
| Plugin compilado | `server/addons/sourcemod/plugins/csstv_calladmin.smx` (1.1.0) |
| Configuración | `server/cfg/sourcemod/csstv_calladmin.cfg` (`csstv_calladmin_address`) |
| Pruebas | `pruebas/connect.sh` |
| El resto de `!calladmin` | [`2026-10-19-calladmin-moderadores/DOCUMENTACION.md`](../2026-10-19-calladmin-moderadores/DOCUMENTACION.md) |

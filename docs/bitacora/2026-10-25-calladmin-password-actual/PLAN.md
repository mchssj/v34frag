# Plan: `!calladmin` con la contraseña actual del servidor (`csstv_calladmin` 1.1.0)

> Planeación original. Estado: **propuesta**, pedida por Daniel el 2026-10-25.

Con `csstv_password` ([`2026-10-25-plugin-password`](../2026-10-25-plugin-password/PLAN.md)), los admins y moderadores cambian la contraseña con `!pw`. Pero el mensaje de `!calladmin` en Discord lleva la contraseña escrita a mano en `csstv_calladmin_address` (`IP:puerto; password <la de siempre>`). Si alguien la cambia, el moderador que llega por el reporte no puede entrar.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| De dónde sale la contraseña | De **`sv_password` en el momento del reporte** | Es la que de verdad pide el servidor, la ponga `!pw`, `!rpw`, el `server.cfg` o el rcon |
| `csstv_calladmin_address` | Pasa a ser **solo `IP:puerto`**. Si todavía trae `; password ...`, el plugin corta desde el `;` | Así funciona igual con el cfg viejo, y después se limpia el cfg de los dos servidores |
| Sin contraseña | `connect IP:puerto` solo | Igual que hoy cuando no hay |
| Quién la ve | El canal de reportes de Discord (moderadores y admins) | Es lo que pidió Daniel: el moderador tiene que poder entrar. Es una excepción buscada a "solo la ve quien la puso" |
| Escape | La dirección y la contraseña se escapan para JSON | Hoy la dirección va sin escapar. Una contraseña del `server.cfg` con comillas o `\` rompería el mensaje |
| Versión | `csstv_calladmin` **1.1.0**, sin licencia, el mismo `.smx` en los dos servidores | Cambio de comportamiento chico |

## 1. El flujo

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

## 2. Pruebas (servidor local, build `CALLADMIN_DEBUG`)

Con el webhook apuntando a una URL inválida, para no mandar nada a Discord. El cuerpo queda en el log.

| # | Caso | Esperado |
|---|---|---|
| 1 | Sin contraseña, dirección `1.2.3.4:27015` | `connect 1.2.3.4:27015` |
| 2 | Con `!pw abc` de `csstv_password` | `connect 1.2.3.4:27015; password abc` |
| 3 | Dirección vieja `1.2.3.4:27015; password vieja` y `sv_password nueva` | `connect 1.2.3.4:27015; password nueva` |
| 4 | `sv_password` con comillas y `\` (por rcon) | JSON válido |
| 5 | `!npw` | Sin la parte de la contraseña |

## 3. Despliegue

En los dos servidores en la misma tanda, cuando Daniel lo pida:

| Servidor | Acceso | Qué se cambia |
|---|---|---|
| Nuestro servidor real | `SFTP_CSS_*` | `csstv_calladmin.smx` 1.1.0 (la 1.0.1 a `plugins/disabled/`) y en `csstv_calladmin.cfg`, `csstv_calladmin_address` solo con `IP:puerto` |
| RBK | `SERVER1_*` | Lo mismo |

Se carga en el próximo cambio de mapa. No se recarga con un mix en curso.

## 4. Orden

1. Cambio en `csstv_calladmin.sp`, compilación de las dos builds y pruebas 1 a 5.
2. Documentación, guía y fila en el README.
3. Despliegue a los dos servidores, cuando Daniel lo pida.

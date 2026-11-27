# Baneo permanente de una IP o rango: documentación

## Qué hace

Desde la web, una IP o rango ya no tiene siempre el tope de 30 días:

| Dónde | Duración |
|---|---|
| **Banear IP o rango** (pestaña **IPs sin ficha**) | 1 hora, 1 día, 7 días, 30 días o **Permanente** |
| **IPs y rangos** de un baneo de ficha | **30 días** (por defecto) o **lo mismo que el baneo**: "Permanente, como el baneo" o "Hasta el <fecha>, como el baneo". Si el baneo vence antes de 30 días, no se elige |

Los servidores ya entendían los baneos sin vencimiento (`!banip … 0`): la copia local los recibe con vencimiento `0`.

```mermaid
flowchart LR
    F[Baneo de ficha] -->|full = false| A[min(vence el baneo, 30 días)]
    F -->|full = true| B[vence con el baneo<br/>permanente si el baneo lo es]
    L[Sin ficha] -->|minutos 1..43 200| C[esa duración]
    L -->|0| D[permanente]
```

## Datos y funciones (replanteo `153`)

| Qué | Cambio |
|---|---|
| `admin_ban_ip_add` | Suma `p_full` (por defecto `false`, como antes) |
| `admin_ban_ip_add_loose` | `0` minutos = permanente |
| `admin_ban_ips` | `expires_at` `null` = permanente (antes `infinity`) |

## Qué cambia para cada rol

| Rol | Qué cambia | Página del manual |
|---|---|---|
| Admin | Puede banear una IP o rango para siempre | `moderador/banear-jugador.md` |
| Jugador | Un baneo de su conexión puede ser permanente | — (los términos lo dicen) |

## Términos y privacidad

- **`/terminos`** (web y `terms/terminos.html`): un baneo puede alcanzar una IP o un rango "por un tiempo o de forma permanente" (antes "desde la web, por hasta 30 días").
- **`/privacidad`:** sin cambios.

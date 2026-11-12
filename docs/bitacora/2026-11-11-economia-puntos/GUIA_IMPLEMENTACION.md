# Economía de puntos y monedas VIP: guía de implementación

La economía va junto con la tienda en el replanteo 110. Los pasos, las pruebas y lo que falta están en [`2026-11-11-tienda/GUIA_IMPLEMENTACION.md`](../2026-11-11-tienda/GUIA_IMPLEMENTACION.md).

## Cambios respecto del plan

| Plan | Implementado | Por qué |
|---|---|---|
| Día en hora de Argentina | Hora de Bogotá | Así cortan el día los demás topes de la web (por ejemplo, el de los comentarios del perfil). |
| `points_config` con una fila por origen | `economy_config` (topes) y `economy_rules` (una fila por premio, con los escalones de medalla, temporada y torneo) | Los escalones son filas: se cambian sin tocar el esquema. |
| Ruta `/api/v1/admin/points/*` | `/api/v1/admin/shop/*` | Va junto con el resto de la tienda. |
| Vigencia del VIP con una función nueva | `vip_at`, que ya existía | Reutilizar lo que hay (Kyan). |
| — | Reversión al borrar una partida | Los términos ya lo prometían. |

**Premios sin enganche:** `tournament`, `level_up`, `mission`, `first_steps`, `clip_featured` y `referral` tienen su regla, pero todavía nada los dispara. Cuando exista cada sistema, tiene que llamar a `economy_award(cuenta, key, ref, label)` con `service_role`.

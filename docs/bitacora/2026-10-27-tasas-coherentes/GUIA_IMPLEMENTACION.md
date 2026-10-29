# Tasas de red coherentes en `server.cfg`: guía de implementación

## Estado

**Aplicado el 2026-10-27** en el servidor real y en RBK. Entra en el próximo cambio de mapa de cada uno.

## Qué se hizo (2026-10-27)

1. [`pruebas/tasas_coherentes.py`](pruebas/tasas_coherentes.py), con `paramiko` en un entorno virtual aparte:
   - `inspect`: en los dos servidores, `cfg/server.cfg` tenía `sv_minupdaterate 101`, `sv_maxupdaterate 100`, `sv_mincmdrate 101` y `sv_maxcmdrate 100`, cada una una sola vez. Ninguna aparece en `autoexec.cfg`, `game.cfg` ni en los cfgs de `cfg/csstv/`.
   - `apply`: reemplazó las cuatro líneas, guardó el original en una carpeta de respaldo local del scratchpad de la sesión (`server.cfg` tiene contraseñas, no se versiona) y releyó el archivo para compararlo byte a byte con lo esperado.

| Servidor | Acceso | Resultado |
|---|---|---|
| Real | `SFTP_CSS_*` | 100 / 101 / 100 / 101, verificado (7625 bytes, mismo tamaño) |
| RBK | `SERVER1_*` | 100 / 101 / 100 / 101, verificado (7544 bytes, mismo tamaño) |

2. `CLAUDE.md` y la documentación de [`2026-10-22-rbk-igual-al-real`](../2026-10-22-rbk-igual-al-real/DOCUMENTACION.md) suman las tasas a los valores de `server.cfg` que tienen que ser iguales en todos los servidores.

No se recargó nada ni se usó RCON.

## En qué se apartó del plan

- Nada. Los mínimos en 100 (y no en 66, como decía el [diagnóstico de red](../2026-10-18-diagnostico-red-servidor/GUIA_IMPLEMENTACION.md)) ya estaban decididos en el plan.

## Pruebas

- No se probó en el servidor local: es un cambio de valores de cvars estándar del motor.
- **Falta verificar** después del próximo cambio de mapa de cada servidor: en la consola del panel, `sv_minupdaterate`, `sv_maxupdaterate`, `sv_mincmdrate` y `sv_maxcmdrate` muestran 100, 101, 100 y 101. En RBK no hay RCON: se mira desde su panel o se le pide al dueño.
- Opcional: en el próximo mix con `csstv_perf`, comparar el choke de los jugadores con el del 2026-10-19. No se espera ningún cambio.

## Volver atrás

Correr el mismo script con los valores anteriores en `WANT` (101 / 100 / 101 / 100), en los dos servidores en la misma tanda. También se puede subir el respaldo local, si todavía existe, pero solo si nadie cambió el `server.cfg` desde el 2026-10-27 (por ejemplo, la contraseña).

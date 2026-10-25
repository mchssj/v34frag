# Guía de implementación: pausa del medio tiempo de 3 segundos

## Qué se hizo (2026-10-24)

1. `server/cfg/sourcemod/csstv_reporter.cfg` del repo: `csstv_halftime_delay "5.0"` → `"3.0"`.
2. [`pruebas/medio_tiempo_3s.py`](pruebas/medio_tiempo_3s.py) con `paramiko` en un entorno virtual aparte:
   - `inspect`: los dos servidores tenían `csstv_halftime_delay "5.0"` una sola vez en `cstrike/cfg/sourcemod/csstv_reporter.cfg`.
   - `apply`: reemplazó la línea, guardó el original en una carpeta de respaldo local del scratchpad de la sesión (el cfg tiene el token, no se versiona) y releyó el archivo para verificarlo.

| Servidor | Acceso | Resultado |
|---|---|---|
| Real | `SFTP_CSS_*` | `csstv_halftime_delay "3.0"`, verificado |
| RBK | `SERVER1_*` | `csstv_halftime_delay "3.0"`, verificado |

3. `CLAUDE.md`, `docs/PENDIENTES.md` y la documentación de [`2026-10-22-rbk-igual-al-real`](../2026-10-22-rbk-igual-al-real/DOCUMENTACION.md) dicen ahora 3 s.

No se recargó el plugin ni se tocó RCON: el cfg se ejecuta en cada cambio de mapa (`AutoExecConfig`), así que el valor nuevo entra en el próximo mapa sin cancelar ninguna partida.

## Pendiente

- Verificar en el próximo mix de cada servidor que el medio tiempo cambia de lados con el marcador correcto (no vuelve a 0).
- Si un mix ya estaba en curso en el momento del cambio, ese mix todavía usa 5 s.
- Publicar [`CHANGELOG_DISCORD.txt`](CHANGELOG_DISCORD.txt).

## Volver atrás

Cambiar la línea a otro valor (1 a 10) en los dos servidores en la misma tanda, con el mismo script ajustando `OLD` y `NEW`.

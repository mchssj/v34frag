# Guía de implementación: limpieza de fichas y equipos vacíos

**Hecho el 2026-11-03 (~18:30 UTC) en producción**, por Kyan con Claude.

1. Respaldo: `pg_dump -Fc` en `C:\Users\Agus\Documents\respaldos_cmleague\prod_antes_limpieza_20261103.dump` (1,9 MB), fuera del repo.
2. `pruebas/limpieza.sql` (con `pruebas/pg.sh` de [`2026-11-03-corte-produccion`](../2026-11-03-corte-produccion/)) en una transacción: armó las dos listas, comprobó que fueran 34 fichas y 10 equipos, las listó con su id (`pruebas/limpieza.log`), borró y verificó que no quedara nada.

| Antes | Después |
|---|---|
| 148 fichas, 27 equipos | 114 fichas, 17 equipos. Ningún equipo sin jugadores |

**Comprobaciones:**
- Las 95 partidas siguen.
- Venom y Ls. piedra siguen.
- `player_elo` tiene una fila menos: el SteamID `76561200187780074` es ahora un adicional de "juanma^.^" (lo sumó Kyan a las 17:35 UTC) y sus 9 partidas pasaron al principal. No tiene que ver con el borrado.

**Volver atrás:** restaurar las filas de `players`, `team_members` y `teams` desde el respaldo, filtrando por los ids de `pruebas/limpieza.log`.

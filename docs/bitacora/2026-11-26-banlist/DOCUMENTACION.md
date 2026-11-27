# `!banlist` en los servidores: documentación

## Qué hace

`!banlist [texto]` (`sm_banlist`), para moderadores y admins (flag `b`), le pide a la web la lista de baneos activos y la muestra en la consola de quien lo usa; en el chat dice cuántos. El texto filtra por SteamID, IP, nombre o motivo (sin distinguir mayúsculas).

```
------------------------------------------------------------------------------------------
Baneos activos de CMLeague (los más nuevos primero)
------------------------------------------------------------------------------------------
IP 181.21.0.0/16        hasta 26/12/2026 19:45 (sin ficha) - cheater (1 excepción)
STEAM_0:1:xxxx          hasta 27/11/2026 16:28 Angel2k - tROLLEAR, no callear, juego disruptivo
(sin SteamID)           permanente         Tormenta - XADSAWS
STEAM_0:0:xxxx          permanente         LESCO - mogolico [servidor]
13 de 13 baneos activos. Detalle e historial: Administración > Baneos en cmleague.lat
```

- Las fechas van en la hora del servidor.
- `[servidor]`: el baneo se puso con `!ban` en el juego.
- `(sin SteamID)`: una ficha o cuenta baneada que todavía no tiene SteamID.
- Si la web no responde, avisa en el chat y no muestra nada (la copia local no tiene nombres ni motivos).

## Datos y funciones (replanteo `154`)

| Qué | Para qué |
|---|---|
| `csstv_ban_list(token)` | Los baneos activos (de ficha, SteamID e IP), los más nuevos primero, como mucho 200, en texto compacto: `s\|STEAM\|vence\|nombre\|motivo\|origen` e `i\|IP\|vence\|nombre\|motivo\|excepciones`, separados por `;` |
| `csstv_ban_list_clean(texto, largo)` | Cambia `\|`, `;`, comillas, barras y controles por espacios |

## Qué cambia para cada rol

| Rol | Qué cambia | Página del manual |
|---|---|---|
| Moderador y admin | `!banlist` | `moderador/comandos-en-el-servidor.md` |
| Los demás | Nada | — |

## Términos y privacidad

Sin cambios: la lista ya la ven los moderadores en la web.

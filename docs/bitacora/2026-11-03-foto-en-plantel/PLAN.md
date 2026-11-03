# Plan: la foto de cada integrante en el plantel de un equipo

> Planeación original. Estado: **pedido directo de Daniel el 2026-11-03** ("no carga el logo del jugador", captura `foto perfil.png`).

En la página de un equipo, la tarjeta **Roles de equipo** (y el plantel) muestran la inicial del jugador en lugar de su foto.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Causa | `team_members_view` lee solo `players.photo_url`. La foto que el jugador sube desde su cuenta queda en `profile_details.avatar_url`, que esa vista no mira | `player_overview` (el perfil y el ranking) ya usa `coalesce(players.photo_url, profile_details.avatar_url)`, por eso en el perfil sí se ve |
| Arreglo | Replanteo `69`: la misma regla en `team_members_view` | Un solo lugar; la API (`/teams/{id}/members` y el plantel del capitán) y la web no cambian |
| Cómo | Se toma la definición vigente (`pg_get_viewdef`) y se cambia solo la columna `photo_url`, con `security_invoker` como antes | La vista se fue armando en varios replanteos; así no se pisa nada |
| `vip_status` | Tiene el mismo problema, pero queda fuera | Es la lista de VIP de Administración, y el VIP no está en esta rama |

## 1. Orden

1. Replanteo `69`, inversa y pruebas (en staging, dentro de una transacción que se deshace).
2. Aplicarlo en staging y comprobar el plantel de un jugador con foto solo en la cuenta.

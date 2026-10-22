# Plan: cambiar el nombre visible de v34frag a CMLeague

> Planeación original. Estado: **pedido por Daniel el 2026-10-22** ("cambia todo lo que dice v34frag / v34fragnation por CMLeague, en avisos, plugins, etc."). La parte 1 se aplica ya; las partes 2 y 3 esperan respuestas.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Qué se cambia | Todo lo que **ven los jugadores y los admins**: nombre del servidor, SourceTV, prefijo del chat, avisos de `!calladmin`, menú de admin y textos de los plugins | Es el pedido |
| "v34fragnation" | No aparece en el repo, en los cfgs de los dos servidores ni en sus plugins | Búsqueda del 2026-10-22. Si está en otro lado (Discord, panel del hosting), se cambia a mano |
| `hostname` | `CMLeague #1 By ExtremeHost` (real) y `CMLeague #2 By ExtremeHost` (RBK) | Se conserva "By ExtremeHost", que lo puso el hosting |
| Prefijo del chat | `csstv_chat_tag "CMLeague"` en el cfg de los dos servidores | El reporter, `!sell` y `!calladmin` lo leen de esta cvar: cambia sin recompilar |
| Infraestructura (Worker `v34frag-demos`, `v34frag-api`, `project_id` de Supabase, nombres de paquetes, la URL de Accelerator en `core.cfg`) | **No se cambia** | Son identificadores y URLs: cambiarlos rompe la web, las demos y los volcados. No los ve ningún jugador |
| Repo, carpetas y documentación interna | No se cambia | No es visible |

## 1. Cfgs de los servidores (se aplica ya, en los dos)

| Archivo | Servidor real | RBK |
|---|---|---|
| `cfg/server.cfg` | `hostname "CMLeague #1 By ExtremeHost"` y `tv_title "CMLeague SourceTV #1"` | `hostname "CMLeague #2 By ExtremeHost"` |
| `cfg/sourcemod/csstv_reporter.cfg` | `csstv_chat_tag "CMLeague"` | Igual |
| `cfg/sourcemod/csstv_calladmin.cfg` | `csstv_calladmin_server "CMLeague #1"` | `"CMLeague #2"` |

Se carga en el próximo cambio de mapa. Mismo procedimiento que en [`2026-10-22-anti-wallhack-y-humo`](../2026-10-22-anti-wallhack-y-humo/): respaldo local, se reemplaza la línea exacta, se vuelve a bajar y se compara.

## 2. Plugins (espera respuesta)

Textos por defecto en `csstv_reporter` (prefijo, categoría "v34frag" del menú de admin, motivo del cambio de mapa por votación, link de Discord), `csstv_sell`, `csstv_calladmin` y `csstv_allchat` (autor y prefijo de respaldo). Los identificadores internos del menú (`v34frag_live`…) no los ve nadie y no hace falta tocarlos.

**Pregunta abierta:** ¿hay un link nuevo de Discord, o sigue `dsc.gg/v34frag`?

Sale como versión nueva de cada plugin, compilada, probada con bots y desplegada en los dos servidores (genérico al real y licenciado a RBK).

## 3. Repo

`server/cfg/sourcemod/*.cfg` y el `CLAUDE.md` (título del changelog: `CMLeague X.Y.Z --  Changelog`).

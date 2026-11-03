# Plan: reportes solo para el admin, lista de clips para reprocesar y nombre del equipo

> Planeación original. Estado: **aprobado por Daniel el 2026-11-03** (los tres puntos los pidió él al revisar el manual).

Al escribir el manual ([`2026-11-02-manual-usuario`](../2026-11-02-manual-usuario/GUIA_IMPLEMENTACION.md)) aparecieron tres cosas en las que la web no hacía lo que debía. Daniel decidió:

1. **Reportes del matchmaking:** por ahora, solo los resuelve un admin.
2. **Reprocesar clips:** tiene que haber un botón. Una **lista de clips** en Administración › Clips, con selección de varias filas y "Reprocesar".
3. **Nombre y logo del equipo:** el capitán cambia el nombre (y la sigla) cada X días, configurable, y el logo cuando quiera.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Reportes | La API pide admin en `GET /admin/mm/reports` y `POST /admin/mm/reports/{id}/resolve`, y `mm_admin_resolve_report` pasa de `is_moderator()` a `is_admin()` | La web ya los mostraba solo al admin; así la regla vale también en la API y la base |
| Lista de clips | Pestaña nueva **Clips**, la primera de Administración › Clips: todas las jugadas que se muestran (`match_clip_list`), de la más nueva a la más vieja | Es lo que se puede reprocesar (`clip_reprocess` exige que la jugada esté en la lista) |
| Filtros | Estado del video (con video, fallido, grabándose, en cola, sin demo), tipo de jugada y búsqueda por jugador | Los casos para reprocesar son los fallidos y los que salieron mal |
| Selección | Casilla por fila y "seleccionar todas las de la página"; las que no se pueden reprocesar (sin demo, en cola o grabándose) tienen la casilla apagada con el motivo | Evita mandar pedidos que la base va a rechazar |
| Reprocesar varias | Ruta nueva `POST /api/v1/admin/clips/reprocess` con `{ ids }` (1 a 50). Llama a `clip_reprocess` una por una y devuelve el resultado de cada una | Una que falla no frena a las demás, y la web dice cuáles no se pudieron |
| Después de reprocesar | Igual que hoy: cada clip pasa a **Para revisar** y no sale en Discord hasta el "Bien" | No cambia el flujo aprobado en `2026-10-28-clips-vip-y-reprocesar` |
| Espera del nombre | `team_config.rename_days`, de 0 a 365 (0 = sin espera), 30 por defecto (lo de hoy). `team_rename` lo usa en lugar de los 30 días fijos | Daniel: "cada X días, no sé si está configurable". No lo era |
| Dónde se configura | Administración › Equipos › **Configuración equipo**, junto al máximo de miembros y los equipos por líder | Ya es la pantalla de las reglas de los equipos |
| Editar equipo | En **Editar equipo**, el nombre y la sigla pasan a ser editables, con "Guardar nombre" y la fecha del próximo cambio si todavía no se puede. El logo sigue igual (cuando quiera) | La API (`PATCH /teams/{id}`) y la base ya lo permitían; faltaba la web |
| Manual | Marcador nuevo `{{equipo.dias_nombre}}` en `manual_valores()`. Se actualizan `admin/reportes-matchmaking`, `jugador/baneos-y-sanciones`, `moderador/sanciones-matchmaking`, `admin/clips`, `capitan/armar-plantel`, `admin/equipos` | Regla del manual: la página se actualiza en el mismo cambio |

## 1. Base (replanteo `68`)

El `67` ya lo usa `67_imagen_login.sql` en `feat/frontend-fase-1`.

- `mm_admin_resolve_report`: `is_admin()`.
- `team_config.rename_days smallint not null default 30 check (rename_days between 0 and 365)`.
- `team_rename`: la espera sale de `team_config.rename_days` (con 0, sin espera). El mensaje dice los días.
- `set_team_config`: suma `p_rename_days`.
- `manual_valores()`: suma `equipo.dias_nombre`.
- Inversa y pruebas SQL (en staging, dentro de una transacción que se deshace).

## 2. API (`feat/mm-claim-en-sala`)

| Ruta | Cambio |
|---|---|
| `GET /api/v1/admin/mm/reports`, `POST …/resolve` | `requireAdmin` |
| `GET /api/v1/admin/clips` | Nueva. Filtros `status`, `type`, `q` (jugador), paginada. Cada fila: el clip, la partida (mapa y fecha), cuántas veces se reprocesó, si salió en Discord, `can_reprocess` y `blocked_reason` |
| `POST /api/v1/admin/clips/reprocess` | Nueva. `{ ids }`, devuelve `{ results: [{ id, ok, error }] }` |
| `GET` y `PATCH /api/v1/admin/teams/config` | `rename_days` |
| Equipo (`next_name_change`) | Con `rename_days` de la base, no con la constante de 30 |

## 3. Web (`feat/frontend-fase-1`)

- Administración › Clips: pestaña **Clips** con la tabla, los filtros, la selección y la barra "N seleccionados · Reprocesar" con confirmación.
- Mi equipo › **Editar equipo**: nombre y sigla editables.
- Administración › Equipos › Configuración equipo: "Días entre cambios de nombre".
- Administración › Matchmaking › Reportes: sin cambios (ya era solo para el admin).

## 4. Orden

1. Replanteo `68`, inversa y pruebas; aplicar en staging con el visto bueno de Daniel.
2. API y pruebas.
3. Web y pruebas.
4. Manual.

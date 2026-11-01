# Plan: Frontend del HUD (servidores, streamers y link de OBS)

> Planeación original. Estado: **aprobado** por Daniel el 2026-10-29 ("apruebo los diseños, impleméntalos y luego desplegamos el frontend en producción").

La base, la API y el relay del HUD ya están hechos y desplegados en el VPS contra staging ([`2026-10-29-hud-relay-vps`](../2026-10-29-hud-relay-vps/GUIA_IMPLEMENTACION.md)). Falta la web: que el admin configure el HUD de cada servidor y dé la marca de streamer, y que el streamer genere su link de OBS.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Fuente del diseño | El canvas "HUD del relay: pantallas" (https://claude.ai/artifact/8kt4tv4SVhKPBAKeb97HNs), hecho sobre el canvas aprobado "Admin · Servidores y ELO" | Aprobado por Daniel el 2026-10-29 |
| Servidores y ELO | Celda **HUD** en cada fila y sección **"HUD para streamers"** en el panel, debajo de "Acceso del servidor" (`PanelSection`) | Diseño aprobado |
| Usuarios | Filtro **"Streamers"** y sección **"Streamer del HUD"** en el panel, debajo del VIP y con su patrón | Diseño aprobado |
| Dónde va la marca en la tabla de Usuarios | Chip "Streamer" al lado del rol | La tabla implementada no tiene la columna "Avisos" del diseño de Usuarios: manda el código actual |
| Detalle de la marca | Sale de `GET /api/v1/admin/streamers` filtrado por el alias de la cuenta | `AdminUser` trae solo `streamer: boolean`. "Transmitiendo X" no está en esa API: se ve en Servidores |
| Mi perfil | Tarjeta **"HUD para OBS"** en Cuenta (arriba de Contraseña), solo si `streamer` no es `null` | Diseño aprobado y contrato (`cuenta.md`) |
| Link de una sola vez | `SecretDialog` de Administración (el de los tokens) con los dos links | Mismo patrón que los tokens. Generar otro, con confirmación |
| Avisos | Textos de `streamer_granted` y `streamer_revoked` | Contrato (`notificaciones.md`) |
| Fuera de alcance | Los textos de los avisos programados (`match_soon` y los demás) y `/control` (lo sirve el relay, ya hecho) | Otro requerimiento |

## 1. Servidores y ELO

- `ServerRow`: celda "HUD" con un chip: "Recibiendo" (verde), "Activo · sin señal", "Apagado · <puerto>" o "Sin HUD".
- `ServerForm` (servidor existente): `HudSection` con el chip de estado, el último paquete y quién transmite; puerto y Activo/Apagado (deshabilitado sin SourceTV, con el aviso), las líneas del `.cfg` en un bloque con "Copiar líneas", "Guardar HUD", "Clave nueva" (con confirmación) y "Sacar el HUD" (con confirmación).
- `queries.ts`: `useSetServerHud` (`PUT …/hud`) y `useNewHudKey` (`POST …/hud/key`).

## 2. Usuarios

- Filtro "Streamers" (`streamer=true` en `GET /admin/users`).
- Chip "Streamer" en la columna Rol.
- `StreamerSection` en el panel: chip ("Desde el …" o "No"), quién la dio y si generó el link; "Dar streamer" y "Quitar streamer", los dos con confirmación.
- `queries.ts`: `streamerOptions`, `useGrantStreamer` y `useRevokeStreamer`.

## 3. Mi perfil › Cuenta

- `HudCard` (si `profile.streamer`): desde cuándo y si hay link; "Generar mi link" o "Generar otro link" (este con confirmación); al generarlo, `SecretDialog` con el link de OBS y el del panel.
- `queries.ts` de perfil: `useNewHudLink` (`POST /me/hud-link`), que refresca el perfil.

## 4. Pruebas

Vitest con MSW, como el resto: el chip de cada estado, la sección del HUD (guardar, sin SourceTV, clave nueva), la marca de streamer, la tarjeta de Mi perfil y el diálogo del link, y los textos de los avisos. `pnpm lint`, `pnpm typecheck` y `pnpm build`.

## 5. Despliegue

`deploy/vps/desplegar.sh web` (lo corre Daniel). La web del VPS hoy usa staging, que ya tiene la `36` y la API nueva.

## 6. Orden

1. Este plan y `schema.d.ts` regenerado.
2. Servidores, Usuarios, Mi perfil y avisos, con sus pruebas.
3. Lint, typecheck, pruebas y build.
4. `DOCUMENTACION.md`, `GUIA_IMPLEMENTACION.md`, la fila en `docs/bitacora/README.md` y `PENDIENTES.md`.
5. Commit y despliegue.

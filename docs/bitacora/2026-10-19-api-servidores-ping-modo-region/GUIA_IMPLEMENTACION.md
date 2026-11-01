# Ping, modo, región y partidas en vivo en el estado de los servidores: guía de implementación

## Estado

Hecho y probado el 2026-10-19, solo en local y sin desplegar: migración `20`, pruebas SQL, unitarias y de integración pasan. Sale en el corte, como el resto del replanteo.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/20_servidores_modo_region.sql` | Nuevo: `game_servers.mode` y `region`, vistas `game_servers_public` y `admin_server_list`, `admin_create_server` con `p_mode` y `p_region` |
| `supabase/replanteo/README.md` | Fila de la `20` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/20_servidores_modo_region.sql` | Nuevo: inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/20_servidores_modo_region.sql` | Nuevo: pruebas SQL (con rollback) |
| `web/backend/src/lib/a2s.ts` | `a2sInfo` devuelve `ping_ms` |
| `web/backend/src/services/servers.ts` | Modo, región, ping y mixes en vivo por servidor; `totals.live_matches` |
| `web/backend/src/routes/servers.ts` | Esquema de la respuesta con los campos nuevos |
| `web/backend/src/schemas/servers.ts` | `SERVER_MODES`, `ServerMode`, región; `mode` y `region` en el alta, la edición y el servidor del admin; filtro `mode` |
| `web/backend/src/routes/admin-servers.ts` | Columnas, filtro y parámetros de `admin_create_server` |
| `web/backend/src/db/types.ts` | `mode` y `region` en `game_servers`, `game_servers_public`, `admin_server_list` y `admin_create_server`, generados con `pnpm db:types` |
| `web/backend/test/unit/servers-status.test.ts` | Ping del último envío, modo, región y mixes en vivo |
| `web/backend/test/integration/servers.test.ts` | Alta, edición, validación, filtro y búsqueda de modo y región; campos nuevos en el estado |
| `docs/frontend/contrato/` | `partidas.md` (8e), `admin.md`, `api.md`, `README.md` y `decisiones.md` |

## Despliegue

No se desplegó. Va con el corte: la `20` se aplica después de la `19`, y el backend se publica en el VPS con el resto.

Después del corte, cargar el modo y la región de cada servidor desde el admin (`PATCH /api/v1/admin/servers/{id}`): **el servidor real y RBK**. Mientras no se carguen, salen en `null`.

## Pruebas

### Unitarias (`pnpm test`)

- 18 archivos, **268 pruebas, todas pasan**. `pnpm typecheck` sin errores.
- El ping se mide solo en el segundo envío cuando hay desafío (`performance.now` simulado: 5 ms el primero y 12 el segundo → `ping_ms: 12`).
- `live_matches` por servidor y total; un mix de un servidor que no está en la lista no cuenta; la consulta lleva el filtro `stale=eq.false`.

### Contra el servidor real (2026-10-19)

Consulta A2S desde la PC de Daniel a `45.235.98.57:27062`, tres veces: respondió con `ping_ms` de **150, 157 y 156 ms** (1 de 12 con 1 bot, o sea 0 jugadores). Es la latencia desde esa PC; desde el VPS va a ser otra.

### Base local (2026-10-19, con Docker)

- `pnpm db:reset`: la `20` se aplica después de la `19` sin errores.
- `pruebas/correr.sh` (las 20 migraciones): **todo ok**. En la `20`: rechaza un modo fuera de la lista, una región de 1 carácter y una con espacios a los lados; `game_servers_public` trae modo y región (`null` sin cargar); `admin_server_list` trae el modo y busca por región; una segunda aplicación aborta; la inversa deja la estructura idéntica y se vuelve a aplicar.
- `pnpm db:types`: coincide con lo que se había escrito a mano antes de tener Docker, salvo `mode` y `region` en los tipos de alta y edición de la vista `admin_server_list`, que faltaban. Quedó el generado.

### Integración (`pnpm test:int`)

- 12 archivos, **86 pruebas, todas pasan**: alta y edición con modo y región (la región se recorta, `null` y `""` borran), rechazo de modo y región inválidos, filtro `mode`, búsqueda por región y los campos nuevos en `GET /api/v1/servers/status`.

## En qué se apartó del plan

- Los tipos de la base se escribieron primero a mano (Docker estaba apagado) y después se regeneraron con `pnpm db:types`.

## Cómo revertir

1. Base local: correr `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/20_servidores_modo_region.sql` (se pierden el modo y la región cargados) y borrar `supabase/replanteo/20_servidores_modo_region.sql`.
2. Código: revertir el commit de este requerimiento.

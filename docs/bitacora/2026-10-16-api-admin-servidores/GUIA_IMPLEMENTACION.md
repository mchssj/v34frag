# Endpoints de admin de servidores: guía de implementación

## Estado

Hecho y probado en local el 2026-10-16: migración `12` y backend. **Sin commit y sin desplegar.** La `12` se aplica en el corte, después de la `11`. Daniel aprobó el plan el 2026-10-16, con sus reglas nuevas y la propuesta de no hacer el estado en vivo desde el panel.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/12_servidores.sql` | Nuevo: nombre único, `is_ip` y su `check`, `admin_create_server`, trigger para no borrar con partidas, vista `admin_server_list`, `game_servers_public` y `match_schedule` con licencia vigente |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/12_servidores.sql` | Nuevo: inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/12_servidores.sql` | Nuevo: pruebas |
| `web/backend/src/schemas/servers.ts` | Nuevo: alta, edición, servidor, token y listado |
| `web/backend/src/routes/admin-servers.ts` | Nuevo: los seis endpoints, `shortName` y el armado de `cfg` y `build_command` |
| `web/backend/src/app.ts` | Registra la ruta |
| `web/backend/src/db/types.ts` | Tipos regenerados con la `12` |
| `web/backend/test/unit/servers-routes.test.ts` | Nuevo: `shortName`, esquemas y rutas con PostgREST simulado |
| `web/backend/test/integration/servers.test.ts` | Nuevo: ciclo completo contra la base local |
| `docs/frontend/contract.md` | Fila del listado, sección "Servidores (admin)", lista de servidores para asignar partidas, pendientes y registro de decisiones |
| `supabase/replanteo/README.md`, `docs/bitacora/2026-10-14-replanteo-modelo-datos/DOCUMENTACION.md`, `docs/PENDIENTES.md` | Fila de la `12`; corte con 01 a 12 |

## Despliegue (pendiente: va en el corte)

1. **Base:** aplicar `supabase/replanteo/12_servidores.sql` después de la `11`. Aborta si hay nombres de servidor repetidos o IPs permitidas inválidas (en la copia del 2026-10-14 no hay).
2. **Backend:** sale con el primer despliegue. Sin variables nuevas: `cfg` usa `SUPABASE_URL` y `SUPABASE_ANON_KEY`, que ya están.
3. **Servidores de juego:** nada. El plugin y sus tokens no cambian.

## Pruebas

- **`correr.sh`** pasa con 01 a 12 (aplicar, segunda aplicación que aborta, inversa idéntica y reaplicar).
- **`pruebas/12_servidores.sql`:**
  - Un usuario común no crea ni ve servidores.
  - Formato del token y datos del alta.
  - Nombre repetido con otras mayúsculas, al crear y al editar; nombre corto.
  - IP con máscara e IP inválida; IPv6 válida.
  - Los cuatro estados de licencia.
  - El hash guardado no es el token y la vista no muestra el hash.
  - El token valida con `csstv_license` como anónimo; uno vencido da `expired`.
  - `game_servers_public` solo con los activos y vigentes.
  - `online` después de validar y no con `last_seen_at` de hace 60 minutos.
  - `match_schedule` acepta uno vigente y rechaza uno vencido.
  - No se borra con partidas; sin partidas, sí.
- **Backend:**
  - `pnpm typecheck` sin errores.
  - 209 pruebas unitarias (18 nuevas).
  - 59 de integración (6 nuevas): permisos, alta y licencia en línea, nombres repetidos y formatos inválidos, edición con IP permitida (rechaza el token desde otra IP), revocar, token nuevo (el viejo deja de servir), listado con cada filtro, orden y paginación, `sort` inválido, `GET /api/v1/servers` sin el vencido, y borrar con y sin partidas.
- **Cobertura:** 97,3 % de líneas en total; `admin-servers.ts` al 100 %.
- **Copia de producción:** solo se leyó `public.sql` para contar (3 servidores, 0 nombres repetidos, 0 IPs permitidas cargadas). No se cargó en la base local.

## En qué se apartó del plan

- **`match_schedule`, no `assign_match`:** el plan nombró mal la función de la `10` que asigna hora y servidor. El cambio es el mismo, con el mensaje "Ese servidor no existe, no está activo o tiene la licencia vencida".
- **`is_ip`:** función nueva para el `check` de `allowed_ip`, porque un cast inválido a `inet` da error en vez de violar el `check`.
- **`check` del largo del nombre** en la tabla, además de la validación en `admin_create_server`, para que también valga al editar.
- **`PATCH` devuelve el servidor** actualizado (el plan no decía qué devolvía), así el frontend no necesita otro `GET`.
- **Mensaje del nombre repetido:** al crear lo da la base; al editar, el índice único da un mensaje en inglés y el backend lo reemplaza por "Ya hay un servidor con ese nombre.".

## Incidentes durante las pruebas

- **Docker Desktop estaba cerrado:** se abrió para levantar la Supabase local.
- **Búsqueda en la prueba del listado:** la prueba buscaba "lista {sufijo}" en nombres "Lista A {sufijo}", que no lo contienen. Se corrigió la prueba (el endpoint estaba bien).

## Cómo revertir

- **En local:** aplicar `reversas/12_servidores.sql`.
- **Backend:** revertir el commit de esta entrega.
- **En producción:** no aplica todavía.

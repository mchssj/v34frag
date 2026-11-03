# Reportes solo para el admin, lista de clips para reprocesar y nombre del equipo: guía de implementación

## Estado

Implementado y probado el 2026-11-03, **sin commit**. El replanteo `68` **está aplicado en staging** y sus 5 pruebas pasaron ahí (deshechas). API (481 pruebas unitarias) y web (557 pruebas) sin desplegar.

## Archivos

### Base (en `feat/mm-claim-en-sala` y en `feat/frontend-fase-1`)

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/68_reportes_admin_nombre_equipo.sql` | Nuevo: reportes con `is_admin()`, `team_config.rename_days`, `team_rename`, `set_team_config` con `p_rename_days` y `equipo.dias_nombre` en `manual_valores()` |
| `supabase/replanteo/README.md` | Fila de la `68` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/68_reportes_admin_nombre_equipo.sql` | Nuevo: la inversa (vuelve a como en la `66`) |
| `docs/bitacora/2026-11-03-reportes-clips-nombre-equipo/pruebas/` | 5 pruebas SQL, la comprobación de la inversa y `correr.sh` |

### API (`feat/mm-claim-en-sala`)

| Archivo | Cambio |
|---|---|
| `web/backend/src/routes/mm.ts` | Reportes con `requireAdmin` |
| `web/backend/src/routes/clips.ts` | `GET /admin/clips`, `POST /admin/clips/reprocess` y `reprocessBlock` |
| `web/backend/src/schemas/clips.ts` | `AdminClipQuery`, `AdminClip`, `AdminClipList`, `ClipReprocessBody`, `ClipReprocessResult` |
| `web/backend/src/routes/admin-teams.ts` | `rename_days` en la configuración |
| `web/backend/src/routes/teams.ts` | `next_name_change_at` con `rename_days` |
| `web/backend/src/schemas/teams.ts` | `TeamConfig.rename_days` |
| `web/backend/src/lib/manual.ts` | Marcador `equipo.dias_nombre` |
| `web/backend/test/unit/clips-routes.test.ts` | 4 pruebas: permisos y validación, la lista, los filtros y reprocesar varios |
| `web/backend/test/unit/mm-reports.test.ts` | Nuevo: 2 pruebas (moderador 403 sin llegar a la base; admin sí) |
| `web/backend/test/integration/equipo-torneos.test.ts` | La configuración con `rename_days` |

### Web (`feat/frontend-fase-1`)

| Archivo | Cambio |
|---|---|
| `web/frontend/src/api/schema.d.ts` | Regenerado |
| `web/frontend/src/features/admin/clips/components/ListTab.tsx` | Nuevo: la pestaña Clips |
| `web/frontend/src/features/admin/clips/components/ListTab.test.tsx` | Nuevo: casillas apagadas y "elegir la página"; reprocesar con uno que falla |
| `web/frontend/src/features/admin/clips/api/queries.ts` | `clipListOptions` y `useReprocessClips` |
| `web/frontend/src/features/admin/clips/pages/AdminClipsPage.tsx`, `lib/clips.ts`, `types/index.ts` | La pestaña nueva y sus tipos |
| `web/frontend/src/features/admin/clips/components/ReviewTab.tsx` | El texto apunta a la pestaña Clips |
| `web/frontend/src/routes/_app/admin.clips.tsx` | `list` como pestaña por defecto |
| `web/frontend/src/features/admin/teams/components/TeamConfigTab.tsx` | "Días entre cambios de nombre" |
| `web/frontend/src/features/teams/api/queries.ts` | `useRenameTeam` |
| `web/frontend/src/features/teams/components/TeamLogo.tsx` | `RenameFields` dentro de `EditTeamSheet` |
| `web/frontend/src/features/teams/components/TeamLogo.test.tsx` | Nuevo: campos apagados con la fecha; guardar nombre y sigla |

### Manual

`admin/reportes-matchmaking.md`, `admin/clips.md`, `admin/equipos.md`, `capitan/armar-plantel.md`, `moderador/sanciones-matchmaking.md` y `jugador/baneos-y-sanciones.md`. Validadas con `cargarManual` de la API: 0 errores.

## Despliegue (pendiente)

En staging, con el visto bueno de Daniel:

1. ~~Pruebas de la base~~: hechas el 2026-11-03 en staging (ver Pruebas).
2. ~~Base~~: el `68` ya estaba aplicado en staging (`edaljnirzvisiaathitt`) al correr las pruebas, completo y con `rename_days = 30`. Lo aplicó la sesión anterior y no quedó anotado.
3. **API:** desplegar `web/backend` desde `feat/mm-claim-en-sala`. **Antes que la web:** la web nueva pide `/admin/clips` y `rename_days`.
4. **Web:** desplegar `web/frontend` desde `feat/frontend-fase-1`.
5. Comprobar en staging: la pestaña Clips con `adminprueba`, reprocesar uno fallido, cambiar el nombre de un equipo de prueba con su capitán y ver el 403 de los reportes con un moderador.

En producción, con el corte. Nada para los servidores de juego (#1, #2 y #3): no cambia el plugin.

## Pruebas

### Base

`pruebas/68_reportes_admin_nombre_equipo.sql`, con `correr.sh`:

1. El moderador no ve ni resuelve reportes; el admin sí. Las sanciones siguen siendo de moderadores.
2. Con 30 días, el segundo cambio de nombre seguido se rechaza con "cada 30 días".
3. Con 7 días y el último cambio hace 8, se puede; el siguiente se rechaza con "cada 7 días". Con 0, se cambia dos veces seguidas.
4. `set_team_config` rechaza 400, es solo del admin y guarda el valor.
5. `manual_valores()` trae `equipo.dias_nombre`.

**Corridas el 2026-11-03 en staging**, dentro de una transacción que se deshace: `OK 1` a `OK 5` y `OK: la inversa deja todo como en la 66`. Como el `68` ya estaba aplicado, se corrieron sin el paso que lo aplica (`correr.sh` lo aplica primero y su control "¿ya se aplicó?" lo frena). Después se comprobó que staging quedara igual: `rename_days` en 30, `set_team_config` de tres parámetros y ninguna ficha de prueba.

Conexión: el pooler de Supabase pide el usuario con la referencia del proyecto (`postgres.edaljnirzvisiaathitt`); `STAGING_PG_USER` del `.env` trae solo `postgres`.

### API

`pnpm exec tsc --noEmit` sin errores y `pnpm test`: 36 archivos, 481 pruebas (1 omitida, de antes). Las de integración (`pnpm test:int`, con la base local en Docker) no se corrieron.

### Web

`pnpm lint`, `pnpm typecheck` y `pnpm test`: 90 archivos, 557 pruebas.

## En qué se apartó del plan

- **Editar equipo:** el formulario del nombre es un componente aparte (`RenameFields`) con `key`, para que vuelva a lo guardado al abrir el panel sin un `setState` dentro de un efecto (lo marcaba `react-hooks/set-state-in-effect`).
- **API en la rama del frontend:** el plan pide la base en las dos ramas, y así quedó. La API de este cambio quedó solo en `feat/mm-claim-en-sala`, como la del `65` (el `manual.ts` no está en `feat/frontend-fase-1`). La API de staging sale de esa rama.

## Incidentes durante las pruebas

- **El `68` ya estaba en staging.** La sesión que lo escribió lo aplicó sin dejarlo anotado en la guía ni en `docs/PENDIENTES.md`. Se comprobó pieza por pieza (reportes, `team_rename`, `set_team_config`, `manual_valores`) antes de seguir. En staging no están la `66` ni la `67`; el `68` no depende de ellas.

## Cómo revertir

1. **Base:** correr la inversa `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/68_reportes_admin_nombre_equipo.sql`. Deja `mm_admin_resolve_report` con `is_moderator()`, `team_rename` con los 30 días fijos, `set_team_config(integer, integer)` y `manual_valores()` sin `equipo.dias_nombre`, y borra `team_config.rename_days`.
2. **API y web:** revert de los commits y volver a desplegar. La API vieja con la base nueva funciona (no manda `p_rename_days`); la web nueva con la API vieja no (pide rutas que no existen), así que primero se revierte la web.

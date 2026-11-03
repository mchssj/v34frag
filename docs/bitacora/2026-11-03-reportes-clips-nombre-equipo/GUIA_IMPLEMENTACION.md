# Reportes solo para el admin, lista de clips para reprocesar y nombre del equipo: guía de implementación

## Estado

**En staging desde el 2026-11-03, con commit** (`034d280a` en `feat/mm-claim-en-sala`, `e53200f8` en `feat/frontend-fase-1`; sin push). Base `68`, API `0d5732881cbe` y web `e53200f83840`.

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

## Despliegue en staging (hecho el 2026-11-03)

En una sola tanda con lo pendiente de otros requerimientos (Daniel, 2026-11-03): el manual (`2026-11-02-manual-usuario` y `2026-11-03-manual-valores-reales`), los legales (`2026-11-03-legales-al-dia`), la imagen del login (`2026-11-03-imagen-login`), el resumen del matchmaking (`2026-11-03-mm-resumen-en-vivo`), el scroll (`ceedbf79`) y la Vinculación de la bienvenida (`2697893a`).

1. **Commits.** En `feat/mm-claim-en-sala`: `c4b004a4` (manual en la API, `65`), `95942673` (base y API de la `67`, traídas de `03d8bd2e`) y `034d280a` (`68`); 490 pruebas. En `feat/frontend-fase-1`: `ebaecd9c` (manual), `be1aa8fd` (legales) y `e53200f8` (`68`, con la base y la API también en esta rama; 472 pruebas de la API). 15 archivos sueltos que estaban en el índice (capturas, logs, el reglamento y `.idea`) se sacaron del índice sin borrarlos.
2. **Base.** La `65` y la `68` ya estaban aplicadas. Con la cola vacía y sin salas abiertas: `66` y `67` con `psql -v ON_ERROR_STOP=1`. Verificado: `mm_summary` existe y `mm_tick` la usa; `site_config` existe, `anon` puede llamar `site_auth_image()` y no `site_admin_set_auth_image`.
3. **API `0d5732881cbe`.** En `v34frag-deploy`: merge "tmp: API de staging" de `034d280a` sobre `f5f6d7b9` (la anterior, que ya tenía `feat/backend-api-fase-1` en `240e2694`), sin conflictos. `MANUAL_DIR="E:/Css V34 Web/v34frag/docs/manual" deploy/vps/desplegar.sh api` con `VPS_HOST` del `.env` de `v34frag`. El build cargó 37 páginas del manual. `cmleague-mm` no se reinició: `src/mm` y `src/jobs` no cambiaron.
4. **Web `e53200f83840`.** Checkout limpio de `e53200f8` en `v34frag-deploy`, `pnpm install --frozen-lockfile` (entran `react-markdown` y `remark-gfm`) y `deploy/vps/desplegar.sh web`.
5. **Comprobado con `adminprueba`** contra `https://api.cmleague.lat`: el manual con sus 7 secciones y el marcador reemplazado ("una vez cada 30 días"), `/admin/clips`, `/admin/teams/config` con `rename_days: 30`, `/admin/mm/reports` (200) y `/site/auth-image` (`null`). En el VPS, `web/current` tiene la pestaña Clips y "Guardar nombre". La web de staging pide usuario y contraseña (Caddy) y no se miró en el navegador.

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

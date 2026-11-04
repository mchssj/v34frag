# Frontend de Administración › Servidores y ELO, Jugadores y Usuarios y moderación: guía de implementación

## Estado

Implementado y probado en local el 2026-10-28, sin commit, en la rama `feat/frontend-fase-1`. Sin desplegar.

## Archivos

| Archivo | Cambio |
|---|---|
| `src/api/schema.d.ts` | Regenerado desde la API actual (faltaban baneos, VIP y otros cambios recientes) |
| `src/auth/permissions.ts` | Moderador: entra a Administración, solo a `users`. Suma `homeAdminSection`, `canModerate`, `canBanPermanent` y `canManageAccounts` |
| `src/auth/guards.ts` y `guards.test.ts` | El moderador vuelve a `/admin/users` |
| `src/auth/roles.ts` | `moderator: "Moderador"` (el schema nuevo trae el rol) |
| `src/features/shell/nav.ts`, `nav.test.ts`, `AppSidebar.tsx`, `CommandMenu.tsx` y `Topbar.tsx` | "Moderación" para el moderador (`navLabel` y `breadcrumbsFor` con el rol) y "Moderador" en el pie del sidebar |
| `src/features/profile/AvatarPicker.tsx` | Prop opcional `upload` para subir la foto de una ficha desde Administración |
| `src/features/mixes/MixesList.test.tsx` y `room.test.ts` | Datos de prueba con los campos nuevos del schema (`review`, `elo`, `level`) |
| `src/features/admin/` | Nuevo: `ui.tsx`, `dialogs.tsx`, `format.ts`, `errors.ts`, `servers/`, `players/`, `users/` y las pruebas |
| `src/routes/_app/admin.servers.tsx`, `admin.players.tsx` y `admin.users.tsx` | Las páginas, con `?tab=` validado |

## Despliegue

Pendiente, con el resto del frontend nuevo (plan del VPS, `docs/bitacora/2026-10-28-despliegue-vps-ovh/`).

## Pruebas

### Automáticas

- `pnpm typecheck`, `pnpm lint` y `pnpm build`: en verde.
- `pnpm test`: 41 archivos y 306 pruebas en verde. Las nuevas cubren:
  - el formato de fechas, bytes y versiones, y la licencia;
  - las validaciones del ELO y de los ajustes;
  - los avisos de los servidores;
  - los bloqueos de los pedidos de SteamID;
  - el vencimiento y el autor de un baneo;
  - los permisos y el breadcrumb del moderador.

### A mano contra la API local (2026-10-28)

- Con la Supabase local en Docker, `pnpm dev:node` y `pnpm dev`.
- Un script de Playwright, guardado fuera del repo, creó una cuenta `@test.local`, le dio el rol `admin` y después `moderator` en la base local, y sacó capturas de cada subpestaña (escritorio claro y oscuro, y 390 px) y de los paneles de detalle y el diálogo de baneo.
- **Ninguna respuesta de la API con error y ningún error en la consola.**
- El moderador ve solo Baneos y "Moderación".
- Las capturas mostraron que "Pierde −30" se partía en dos líneas en la vista previa del ELO: se corrigió.
- **No se probaron las acciones que escriben** (crear o revocar un servidor, ajustar el ELO, banear, etc.): solo la lectura y la apertura de los diálogos.
- Quedaron dos cuentas de prueba `adm-…@test.local` en la base local.

## En qué se apartó del plan

- **Sin filtro "Baneadas" en Fichas:** `GET /api/v1/players` no tiene ese filtro. El baneo se ve en el panel de la ficha y en Baneos.
- **Sin filtro "VIP" en Cuentas:** `GET /api/v1/admin/users` no lo tiene. El VIP se ve como columna.
- **Sin "Quitar foto" ni fecha de vinculación de cada SteamID en la ficha:** la API de admin no los expone.
- **El registro de `!claim` (`GET /api/v1/admin/claims`) no tiene pantalla todavía.**
- **Al elegir algo en el teléfono, el panel de detalle queda debajo de la lista:** hay que bajar para verlo.

## Cómo revertir

Borrar `src/features/admin/`, volver las tres rutas al `Placeholder` y revertir los cambios de permisos, shell y `AvatarPicker` (`git checkout` de esos archivos). `schema.d.ts` puede quedar regenerado: es la API actual.

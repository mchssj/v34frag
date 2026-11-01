# Administración › Baneos como sección propia: guía de implementación

## Estado

Implementado y probado en local el 2026-10-29, sin commit, en la rama `feat/frontend-fase-1`. Sin desplegar.

## Archivos

Todo en `web/frontend/`:

| Archivo | Cambio |
|---|---|
| `src/auth/permissions.ts` | Sección `bans`. El moderador entra solo a `bans`, que es su sección de inicio. Se borró `canManageAccounts` |
| `src/auth/guards.ts` y `guards.test.ts` | El moderador va a `/admin/bans` |
| `src/features/shell/nav.ts` y `nav.test.ts` | Ítem "Baneos" con el contador `adminBans`. "Usuarios y moderación" pasa a "Usuarios". Se borró `navLabel` y el rol de `breadcrumbsFor` |
| `src/features/shell/AppSidebar.tsx`, `CommandMenu.tsx` y `queries.ts` | Sin `navLabel`. Contador de baneos activos (solo si el rol entra a Baneos) |
| `src/features/shell/Topbar.tsx` | Vuelve a como estaba: los breadcrumbs ya no necesitan el rol |
| `src/routes/_app/admin.bans.tsx` | Nueva. Valida `status`, `source`, `server`, `q`, `sort`, `page` y `ban` |
| `src/features/admin/bans/` | Nueva: `AdminBansPage.tsx`, `BanPanel.tsx`, `bans.ts`, `queries.ts` y `BanDialog.tsx` (movido desde `users/`, con `onSaved`) |
| `src/features/admin/users/AdminUsersPage.tsx` | Solo Cuentas y Palabras bloqueadas, sin el botón "Banear" ni el aviso del moderador |
| `src/features/admin/users/BansTab.tsx` | Borrado |
| `src/features/admin/users/queries.ts` | Sin las consultas de baneos |
| `src/features/admin/users/AccountsTab.tsx` y `players/FichasTab.tsx` | "Ver en Baneos" a `/admin/bans?q=<alias>&ban=<id>` |
| `src/features/admin/ui.tsx` | Las pestañas ya no corren la raya 1 px hacia abajo: eso hacía aparecer una barra de scroll |
| `src/features/admin/rules.test.ts` | Pruebas de permisos, origen, "Qué pasó" y quién puede cambiar un baneo |
| `src/routeTree.gen.ts` | Regenerado por el plugin del router |

## Despliegue

Pendiente, con el resto del frontend nuevo (`docs/bitacora/2026-10-28-despliegue-vps-ovh/`). No necesita cambios en el backend.

## Pruebas

### Automáticas

- `pnpm typecheck`, `pnpm lint` y `pnpm build`: en verde.
- `pnpm test`: 308 pruebas en verde.

### Contra la API local

Con un script de Playwright, guardado fuera del repo:

1. Se cargaron datos ficticios: dos fichas de prueba y baneos de los tres orígenes (web, `!ban` del juego e importado), uno vencido, uno levantado y uno reemplazado.
2. Se sacaron capturas como admin y como moderador, en escritorio (oscuro y claro) y a 390 px, del panel, del reemplazo con "Ver el baneo nuevo", del diálogo y de Usuarios.
3. Como moderador, desde la web: se levantó un baneo con motivo y se usó "Banear de nuevo". El panel y los totales se actualizaron y no hubo errores en la consola.
4. El moderador que pide `/admin/users` vuelve a `/admin/bans`.

Al terminar se borraron los datos de prueba, las dos cuentas `@test.local` y las capturas.

## Cómo revertir

Todavía no hay commit, y varios de estos archivos también tienen los cambios sin commit del frontend de Administración (`2026-10-28-frontend-admin-servidores-jugadores-usuarios`). Por eso no sirve un `git checkout`: hay que deshacer a mano los cambios de la tabla y borrar `src/features/admin/bans/` y `src/routes/_app/admin.bans.tsx`. El router regenera `routeTree.gen.ts` solo.

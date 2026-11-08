# Moderar equipos: guía de implementación

## Estado

- **Backend:** implementado y probado en local el 2026-11-01, con commit en `feat/backend-api-fase-1` (sin push).
- **Frontend:** implementado y probado en local el 2026-11-01, con commit en `feat/frontend-fase-1` (sin push), después del merge del backend.

Sin desplegar.

## Archivos (backend)

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/43_moderar_equipos.sql` | Nuevo |
| `supabase/replanteo/README.md` | Fila de la `43` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/43_moderar_equipos.sql` | Nueva: inversa (se pierde el historial) |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/43_moderar_equipos.sql` | Nuevas: 28 pruebas SQL, con rollback |
| `web/backend/src/routes/admin-teams.ts` | Lista, historial, quitar logo, quitar miembro y disolver nuevas; `PATCH`, sumar y rol pasan por las funciones del staff y aceptan `reason`; el moderador entra a lo suyo |
| `web/backend/src/schemas/admin.ts` | `AdminTeamQuery`, `AdminTeamRow`, `AdminTeamList`, `TeamAuditEntry`, `TeamAuditQuery`, `TeamAuditList`, `ReasonBody`; `reason` en `AdminTeamPatch`, `MemberBody` y `RoleBody` |
| `web/backend/src/db/types.ts` | Regenerado |
| `web/backend/test/integration/moderar-equipos.test.ts` | Nuevo: 3 casos (lista e historial, moderador, admin) |
| `web/backend/test/integration/players-teams.test.ts` | El líder nuevo tiene que ser del plantel (`404` si no) |
| `docs/frontend/contrato/` | `admin.md`, `notificaciones.md` y la novedad en `README.md` |

## Archivos (frontend)

| Archivo | Cambio |
|---|---|
| `web/frontend/src/features/admin/teams/pages/AdminTeamsPage.tsx` | Pestañas "Moderar equipos" y "Configuración equipo" (esta, solo admin); lista con filtros, búsqueda y panel |
| `web/frontend/src/features/admin/teams/components/TeamPanel.tsx` | Panel del equipo: datos, acciones (el moderador ve menos), plantel con rol, "Hacer líder" y "Quitar", historial y el diálogo de cada acción con motivo opcional y el texto del aviso al líder |
| `web/frontend/src/features/admin/teams/components/TeamConfigTab.tsx` | Lo que antes era la página entera (máximo de miembros y equipos por líder) |
| `web/frontend/src/features/admin/teams/api/queries.ts` | Lista, historial, `useStaffAction` (todas las acciones) y crear a nombre de un jugador |
| `web/frontend/src/features/admin/teams/lib/history.ts` (+ prueba) | Frases del historial y el texto del aviso |
| `web/frontend/src/routes/_app/admin.teams.tsx` | Búsqueda en la URL: `tab`, `filter`, `q`, `page` y `team` |
| `web/frontend/src/auth/permissions.ts` (+ prueba) | El moderador entra a Equipos |
| `web/frontend/src/features/shell/notifications/lib/model.ts` (+ prueba) | Texto de `team_staff_action` y el motivo en `team_removed` y `team_role_changed` |
| `web/frontend/src/api/schema.d.ts` | Regenerado |

## Despliegue (pendiente)

1. Staging: la `43` **cargada en staging el 2026-11-01** (con la 39 a la 44; las pruebas SQL de la 40 a la 44 pasaron allá también). La API del VPS se redesplegó el mismo día (`714ec78ae865`).
2. Corte: la `43` va después de la `42`.
3. No toca el plugin.

## Pruebas (backend)

Contra la Supabase local, el 2026-11-01:

- SQL de la `43`: 28 de 28. La inversa se probó ida y vuelta.
- `pnpm typecheck`: sin errores.
- `pnpm test`: 396 unitarias.
- `pnpm test:int`: 177 de integración (3 nuevas).

## Pruebas (frontend)

- `pnpm exec tsc -b` y `pnpm lint`: sin errores.
- `pnpm test`: 412 unitarias (nuevas: historial, aviso y `team_staff_action`).
- **Recorrido real** con una prueba temporal de Playwright (después se borró), con cuentas de moderador y admin en la base local:
  - El moderador no ve "Configuración equipo".
  - El moderador renombra "Kraken (suizo)" con motivo.
  - El admin ve las dos pestañas, el cambio en el historial con el motivo y quién lo hizo.
- Las capturas mostraron alias cortados en el plantel y botones que no entraban. Las acciones de cada miembro pasaron a una segunda línea y los botones pueden ocupar dos líneas.

## En qué se apartó del plan

- **Aviso al líder anterior:** al cambiar el líder, el aviso va al nuevo y también al anterior (el plan decía "al líder").
- **Rutas de quitar:** son `POST …/logo/remove` y `POST …/members/{playerId}/remove`, con el motivo en el cuerpo (un `DELETE` con cuerpo es frágil en algunos clientes).
- **Líder nuevo:** tiene que ser del plantel. Antes el admin podía poner a cualquier jugador con cuenta, aunque no estuviera en el equipo.
- **Renombrar:** solo controla lo que cambia, como `team_rename`. Lo mostró una prueba: una sigla vieja repetida en otro equipo frenaba un cambio de nombre.
- **Autor del historial:** el alias sale de la ficha del jugador (`players.nick`): `profiles` solo deja leer el propio, y el panel mostraba el rol repetido en lugar del nombre. Un staff sin ficha aparece como "Moderador" o "Admin".
- **`name_blocked`:** la lista lo usa a través de `team_name_blocked`, porque la función original no se expone a los usuarios.

## Cómo revertir

1. Base: `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/43_moderar_equipos.sql`.
2. Código: `git revert` de los commits del backend y del frontend.

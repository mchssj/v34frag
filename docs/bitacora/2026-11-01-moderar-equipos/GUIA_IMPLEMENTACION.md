# Moderar equipos: guía de implementación

## Estado

- **Backend:** implementado y probado en local el 2026-11-01, con commit en `feat/backend-api-fase-1` (sin push).
- **Frontend:** en `feat/frontend-fase-1`, después del merge del backend.

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

## Despliegue (pendiente)

1. Staging: cargar la `43` después de la `42` y redesplegar la API.
2. Corte: la `43` va después de la `42`.
3. No toca el plugin.

## Pruebas (backend)

Contra la Supabase local, el 2026-11-01:

- SQL de la `43`: 28 de 28. La inversa se probó ida y vuelta.
- `pnpm typecheck`: sin errores.
- `pnpm test`: 396 unitarias.
- `pnpm test:int`: 177 de integración (3 nuevas).

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

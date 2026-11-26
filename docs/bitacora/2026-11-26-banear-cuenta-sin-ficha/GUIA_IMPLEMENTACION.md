# Banear una cuenta sin ficha: guía de implementación

## Estado

Desplegado el 2026-11-26: web `1ee6c8dc6f84` y API (manual) con el mismo commit, `1ee6c8dc`.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/features/admin/bans/components/BanDialog.tsx` | Destino `account`; con `accounts`, busca cuentas sin ficha (`/api/v1/admin/users?has_player=false`); al banear, crea la ficha y después el baneo. Texto del aviso y del toast |
| `web/frontend/src/features/admin/bans/components/BanDialog.test.tsx` | Nuevo: crea la ficha antes del baneo, con `user_id`; el aviso ya no menciona `!syncbans` |
| `web/frontend/src/features/admin/bans/pages/AdminBansPage.tsx` | `accounts` para los admins; texto del aviso |
| `web/frontend/src/features/admin/players/api/queries.ts` | `useCreatePlayer` acepta `user_id` |
| `web/frontend/src/features/admin/users/components/AccountsTab.tsx` | Sección Baneo también sin ficha |
| `docs/manual/moderador/banear-jugador.md`, `docs/manual/admin/usuarios-y-fichas.md` | Lo que pasa hoy en los servidores y las cuentas sin ficha |

## Despliegue

1. `desplegar.sh web` → `1ee6c8dc6f84`.
2. `desplegar.sh api` (por el manual), con una partida en vivo y 2 en la cola.

## Pruebas

- Web: typecheck, lint y 899 pruebas (2 nuevas).
- Manual validado (76 páginas).
- Sin probar en producción con un baneo real: Daniel banea a Tormenta y a la otra cuenta sin ficha desde la web.

## En qué se apartó del plan

El plan se escribió junto con la implementación (el pedido era chico y urgente).

## Cómo revertir

Revertir `1ee6c8dc` y desplegar la web y la API. Las fichas que se crearon al banear quedan (son las que la cuenta tendría al buscar partida).

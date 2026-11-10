# Baneos por horas: guía de implementación

## Cambios respecto del plan

- Ninguno. `banRemaining` y la hora en la lista y el detalle se trajeron tal cual del worktree de `feat/frontend-fase-1` (sin commit); los botones fijos de 1, 6 y 12 horas se cambiaron por **Horas** con su campo.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/features/admin/bans/lib/bans.ts` | `"hours"`, `BAN_MAX_HOURS`, `validBanHours`, `banExpiry` con horas y `banRemaining` |
| `web/frontend/src/features/admin/bans/lib/bans.test.ts` | Pruebas de las horas y de lo que falta |
| `web/frontend/src/features/admin/bans/components/BanDialog.tsx` | **Horas** con el campo, **Como está** al cambiar y el vencimiento con hora |
| `web/frontend/src/features/admin/bans/components/BanPanel.tsx` y `pages/AdminBansPage.tsx` | El vencimiento con hora y lo que falta |
| `docs/manual/moderador/banear-jugador.md` | Las horas y **Como está** |

## Pruebas

`pnpm typecheck`, `vitest` de `features/admin` y `features/matchmaking` (189, con 2 pruebas nuevas en `bans.test.ts`), `eslint` y `prettier` sin errores en lo que se tocó.

No se probó en el navegador antes de desplegar.

## Despliegue

1. Web: `deploy/vps/desplegar.sh web` desde `main`. No hay cambios en la base, la API ni los servidores.

## Cómo deshacerlo

Revertir el commit y desplegar la web. Los baneos por horas que ya se pusieron siguen valiendo y vencen a su hora.

**Estado: desplegado el 2026-11-10, sin commit.** Web `c77b49e01d7c-local11102029`. **Falta:** probarlo en el navegador con una cuenta de moderador, desplegar la API para que `/help` muestre el manual nuevo, el commit en `main` y publicar el changelog.

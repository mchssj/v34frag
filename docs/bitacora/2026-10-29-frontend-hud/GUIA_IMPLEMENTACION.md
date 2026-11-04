# Frontend del HUD: guía de implementación

## Estado

Implementado y probado en local el 2026-10-29 (`feat/frontend-fase-1`). Despliegue: `deploy/vps/desplegar.sh web` (lo corre Daniel); la web del VPS usa staging, que ya tiene la `36` y la API `91498a41bca2`.

## Archivos

| Archivo | Cambio |
|---|---|
| `src/api/schema.d.ts` | Regenerado (`pnpm gen:api`) con la API del HUD |
| `src/features/admin/servers/HudSection.tsx` | Nuevo |
| `src/features/admin/servers/ServersTab.tsx` | Celda HUD y `HudSection` en el panel |
| `src/features/admin/servers/queries.ts` | `useSetServerHud` y `useNewHudKey` |
| `src/features/admin/users/AccountsTab.tsx` | Filtro "Streamers", chip y `StreamerSection` |
| `src/features/admin/users/queries.ts` | Filtro `streamer`, `streamerOptions`, `useGrantStreamer` y `useRevokeStreamer` |
| `src/features/profile/sections/HudCard.tsx` | Nuevo |
| `src/features/profile/sections/AccountSection.tsx` | `HudCard` si la cuenta es streamer |
| `src/features/profile/queries.ts` | `MyProfile` y `useNewHudLink` |
| `src/features/shell/notifications/model.ts` | `streamer_granted` y `streamer_revoked` |
| Pruebas | `HudSection.test.tsx`, `StreamerSection.test.tsx` y `HudCard.test.tsx` (nuevas); `admin/rules.test.ts` y `notifications/model.test.ts` |
| `web/backend/.dev.vars.example` | `HUD_BASE_URL` comentada |

## Pruebas

- Vitest: 341 en verde (15 nuevas: chip y puerto del HUD, la sección del HUD con guardar, sin SourceTV y puerto inválido, la marca de streamer con dar y quitar, la tarjeta de Mi perfil con el link de una vez y la confirmación, y los dos avisos).
- `pnpm lint`, `pnpm typecheck`, `prettier --check` y `pnpm build` en verde.
- No se comparó con capturas contra el diseño ni se probó en el navegador contra la API.

## En qué se apartó del plan

Ninguno. Las diferencias con el diseño del canvas ya estaban en el plan: el chip "Streamer" va en la columna Rol (la tabla no tiene "Avisos") y "transmitiendo X" se ve en Servidores, no en Usuarios.

## Cómo revertir

Revertir el commit y volver a desplegar la web (`desplegar.sh web`), o volver a la versión anterior en el VPS (`/srv/cmleague/web/releases/`).

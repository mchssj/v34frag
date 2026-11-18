# SteamID en formato STEAM_0 en la web: guía de implementación

## Qué se hizo

1. `steam2()` en `web/frontend/src/lib/steam.ts`, con su prueba.
2. Se usa en cada lugar de la web que muestra una SteamID (lista en `DOCUMENTACION.md`). Las etiquetas accesibles (`Quitar …`, `Desvincular …`) también usan el formato nuevo; `LinkSection.test.tsx` se ajustó.
3. Cambio sobre el plan (Daniel, 2026-11-18): el buscador del baneo también acepta `STEAM_X:Y:Z`. `steam64()` en `lib/steam.ts` lo pasa a SteamID64 antes de mandarlo; la API no cambia.
4. Manual: `moderador/banear-jugador.md` y `soporte/banear-jugador.md` dicen que se puede pegar el `STEAM_0` o el SteamID64.

## Pruebas

- `pnpm typecheck` y `eslint` sin errores.
- `vitest`: `src/lib/steam.test.ts`, `features/profile`, `features/admin` y `features/onboarding` pasan (176 pruebas); después del cambio del buscador, `lib/steam.test.ts` y `features/admin/bans` (16 pruebas).

## Despliegue

**Web desplegada el 2026-11-18** (`4bd96203a1c6`, commit `4bd96203`): `deploy/vps/desplegar.sh web`, con los cambios ajenos de `web/frontend` (legales y socket del matchmaking) guardados con `git stash` para no publicarlos. Sin base ni servidores.

**Falta la API**, que es la que sirve el manual (`/help`): no se reinició porque había 7 jugadores en la cola del matchmaking. Los dos cambios de `banear-jugador.md` salen con el próximo despliegue de la API.

## Pendiente

Nada.

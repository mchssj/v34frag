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

Solo la web, con el próximo despliegue. Sin base, API ni servidores.

## Pendiente

Nada.

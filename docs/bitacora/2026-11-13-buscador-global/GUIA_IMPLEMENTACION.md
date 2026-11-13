# Buscador con jugadores, equipos y torneos: guía de implementación

## Estado

Implementado, probado en local y **desplegado el 2026-11-13** (commit `92ea3367`: la web y la API `92ea3367f5c8`).

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/features/shell/components/CommandMenu.tsx` | Grupos Jugadores, Equipos y Torneos; las páginas se filtran en el componente; "Buscando…" |
| `web/frontend/src/features/shell/api/queries.ts` | `useGlobalSearch(q)` y `SEARCH_PER` |
| `web/frontend/src/features/shell/api/keys.ts` | `shellKeys.search` |
| `web/frontend/src/features/shell/components/CommandMenu.test.tsx` | Pruebas nuevas (3) |
| `docs/manual/jugador/buscador.md` | Página nueva del manual |

## Despliegue (hecho el 2026-11-13)

Ningún servidor de juego, ni la base, ni el plugin. Fueron dos partes, porque el manual va dentro del build de la API. Se desplegó desde un worktree limpio en `92ea3367` (`v34frag-deploy`), porque `v34frag` tenía sin commit lo de las medallas (que necesita la `114`, sin aplicar) y el script arma desde el árbol de trabajo:

```bash
deploy/vps/desplegar.sh web
deploy/vps/desplegar.sh api   # solo para que /help muestre la página nueva del manual
```

## Pruebas

### Producción

- `GET https://api.cmleague.lat/api/v1/players?q=grim&per=5` devuelve a 1GRIM. `/api/health` con `92ea3367f5c8`.
- El script corrió de nuevo las pruebas: 747 de la web y 596 de la API.

### Web

- `pnpm test`: 124 archivos, 747 pruebas, todas bien (3 nuevas en `CommandMenu.test.tsx`: busca y navega, no pide a la API con una letra y el orden de las páginas).
- `pnpm typecheck`, `pnpm lint` y `pnpm build` sin errores.

### API

- `GET /api/v1/players?q=grim&per=5` contra la API local (copia de producción) devuelve a 1GRIM.
- `test/unit/manual.test.ts`: 21 de 21 con la página nueva.

### En el navegador

No se probó: el Vite de `localhost:5173` era el del worktree `v34frag-mainwt`, y en otro puerto no había sesión.

## En qué se apartó del plan

En nada.

## Incidentes durante las pruebas

Ninguno.

## Cómo revertir

Volver los cinco archivos de arriba y desplegar la web (y la API, por el manual).

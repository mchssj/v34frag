# Buscar en el texto de la ayuda y la página de comandos del jugador: guía de implementación

## Estado

**Desplegado el 2026-11-06 (16:39-16:42 UTC)** desde `main` (`2214bc52`): API y web `2214bc52b233`. No se miró en el navegador.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/backend/src/lib/manual.ts` | `textoPlano()` y `texto` en cada página de `indiceDe` |
| `web/backend/src/routes/manual.ts` | `texto` en el esquema `ManualIndice` |
| `web/backend/test/unit/manual.test.ts` | El índice con `texto`, sin páginas ocultas, y una prueba de `textoPlano` |
| `web/frontend/src/features/help/lib/fragmento.ts` (+ `.test.ts`) | Nuevo: el fragmento alrededor de lo buscado |
| `web/frontend/src/features/help/pages/HelpIndex.tsx` (+ `.test.tsx`) | Busca en el texto, ordena y muestra el fragmento |
| `web/frontend/src/features/help/types/index.ts`, `test/fixtures.ts` | `texto` opcional y en las páginas de prueba |
| `web/frontend/src/api/schema.d.ts` | Regenerado desde la OpenAPI. Además de `texto`, trae `/api/v1/mm/games/{id}/room`, que ya estaba desplegada (replanteo 78) y faltaba en el esquema |
| `docs/manual/jugador/comandos-en-el-servidor.md` | Nueva |
| `docs/manual/jugador/jugar-en-el-servidor.md` | Sin las tablas de comandos; enlaza a la nueva |
| `CLAUDE.md`, `docs/manual/README.md` | La regla de los comandos apunta a la página nueva del jugador |

## Despliegue (hecho el 2026-11-06)

1. Commit `2214bc52` en `feat/frontend-fase-1` y `main` adelantado (fast-forward).
2. Desde el worktree de `main`: `deploy/vps/desplegar.sh api`. 548 pruebas, build (manual de 43 páginas), `build:check` y `/api/health` con `2214bc52b233` (antes `b0642f948a7e`).
3. `deploy/vps/desplegar.sh web`. 635 pruebas, build y subida (antes `8670768b56ef`).

La API se desplegó antes que la web. La web nueva también funciona con una API sin `texto` (busca solo en el título y el resumen).

## Pruebas

- API: `manual.test.ts` 21 de 21; completa 548 de 548 en el despliegue.
- Web: `features/help` 17 de 17 (incluye buscar `!callreplace` en el texto con su `<mark>` y que una página que coincide en el resumen salga una vez y sin fragmento); completa 635 de 635 en el despliegue. `pnpm typecheck` y `eslint` de `features/help` sin errores.
- `schema.d.ts` se generó con `openapi-typescript` desde la OpenAPI que arma `createApp()` (un script de `tsx` fuera del repo), sin levantar la API.

## En qué se apartó del plan

- `fragmento` quedó en `features/help/lib/fragmento.ts` y no dentro de `HelpIndex.tsx`, por la regla del frontend de dejar los helpers en `lib/`.

## Cómo revertir

Revertir `2214bc52` y desplegar la API y la web desde `main`. O volver a la versión anterior en el VPS: API `b0642f948a7e` y web `8670768b56ef` (`ln -sfn <versión> current.nuevo && mv -T current.nuevo current` y `sudo systemctl restart cmleague-api`).

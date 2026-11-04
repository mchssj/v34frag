# Los mixes en vivo en el sidebar y en la NowBar: guía de implementación

## Estado

Implementado y probado en local el 2026-11-04 (Vitest, typecheck y lint). Commiteado en `main` (pedido por Daniel). **Pendiente:** el despliegue de la web y llevarlo a `feat/frontend-fase-1`.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/features/shell/api/keys.ts` | Nuevo: `shellKeys`, que antes estaba en `queries.ts` |
| `web/frontend/src/features/shell/api/queries.ts` | `useBadgeCounts` suma los mixes en vivo; `useFeaturedLive` devuelve `{ kind: "match" }` o `{ kind: "mix" }`; `pickFeaturedMix` nuevo. Reexporta `shellKeys` |
| `web/frontend/src/features/shell/components/NowBar.tsx` | Dibuja la partida o el mix, con un marco común |
| `web/frontend/src/features/mixes/api/queries.ts` | Importa `shellKeys` desde `shell/api/keys` |
| `web/frontend/src/features/series/api/booking.ts` | Ídem |
| `web/frontend/src/features/shell/components/NowBar.test.tsx` | Nuevo: 6 pruebas (NowBar con mix, preferencia por mix con novedades, oficial antes que mix, oculta en la sala, suma del badge, badge solo con mixes) |

## Despliegue

Pendiente. Es solo la web, commiteada en `main`: build y despliegue de la web como siempre. No toca la API, la base ni los servidores.

## Pruebas

### Web (Vitest, en la PC de Daniel)

- `pnpm test`: 95 archivos y 587 pruebas, todas pasan.
- `pnpm typecheck` y `pnpm lint`: sin errores.

### Reproducción del reporte

El 2026-11-04, con el mix `srv1-20261104T160734-6217` en juego en el #1, producción contestaba `total: 0` en `/api/v1/matches?status=live` y 1 en `/api/v1/mixes?status=live`. No se probó todavía en el navegador contra producción.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

Revertir el commit en `feat/frontend-fase-1` y volver a desplegar la web.

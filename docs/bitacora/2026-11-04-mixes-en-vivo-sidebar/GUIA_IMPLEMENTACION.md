# Los mixes en vivo en el sidebar y en la NowBar: guía de implementación

## Estado

**Desplegado el 2026-11-04 (20:31 UTC):** web `c8fb3662f9ac`, desde `main`. Commiteado solo en `main` (`fb25f03d`): Daniel decidió el 2026-11-04 que `main` es la referencia de producción, así que no se lleva a `feat/frontend-fase-1`. **Falta:** verlo con un mix real, porque cuando se desplegó no había ninguno en vivo.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/features/shell/api/keys.ts` | Nuevo: `shellKeys`, que antes estaba en `queries.ts` |
| `web/frontend/src/features/shell/api/queries.ts` | `useBadgeCounts` suma los mixes en vivo; `useFeaturedLive` devuelve `{ kind: "match" }` o `{ kind: "mix" }`; `pickFeaturedMix` nuevo. Reexporta `shellKeys` |
| `web/frontend/src/features/shell/components/NowBar.tsx` | Dibuja la partida o el mix, con un marco común |
| `web/frontend/src/features/mixes/api/queries.ts` | Importa `shellKeys` desde `shell/api/keys` |
| `web/frontend/src/features/series/api/booking.ts` | Ídem |
| `web/frontend/src/features/shell/components/NowBar.test.tsx` | Nuevo: 6 pruebas (NowBar con mix, preferencia por mix con novedades, oficial antes que mix, oculta en la sala, suma del badge, badge solo con mixes) |

## Despliegue (hecho el 2026-11-04)

1. `v34frag-deploy` en `main` (`c8fb3662`, que también trae el commit de la API de [`2026-11-04-registro-email-existente`](../2026-11-04-registro-email-existente/); la web no cambia con él) y `pnpm install --frozen-lockfile` en `web/frontend`.
2. `VPS_HOST` tomado del `.env` de `v34frag`, porque `v34frag-deploy` no tiene `.env`, y `deploy/vps/desplegar.sh web`: lint, pruebas, build y `current` → `c8fb3662f9ac`. Antes: `653c3f9cd7cb-local11040227`, cuyos cambios sin commit (la recuperación de contraseña y las acciones de cuenta) ya estaban en `main` (`3cbe1ab8` y `c859d10c`).
3. `https://cmleague.lat` responde 200. No reinicia nada (Caddy sirve `web/current`) y no toca los servidores de juego (#1, #2 y #3).

Los avisos de `tar` (`time stamp … in the future`) se deben a que el reloj de la PC va unos segundos adelantado respecto del VPS. No afectan.

## Pruebas

### Web (Vitest, en la PC de Daniel)

- `pnpm test`: 95 archivos y 587 pruebas, todas pasan.
- `pnpm typecheck` y `pnpm lint`: sin errores.

### Reproducción del reporte

El 2026-11-04, con el mix `srv1-20261104T160734-6217` en juego en el #1, producción contestaba `total: 0` en `/api/v1/matches?status=live` y 1 en `/api/v1/mixes?status=live`. No se probó todavía en el navegador contra producción.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

Revertir `fb25f03d` en `main` y volver a desplegar la web. O, más rápido, apuntar `/srv/cmleague/web/current` a `653c3f9cd7cb-local11040227`, que sigue en `releases/`.

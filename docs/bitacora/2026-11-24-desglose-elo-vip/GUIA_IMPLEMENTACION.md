# Desglose de tu ELO para VIP: guía de implementación

## Estado

Desplegado el 2026-11-25 a las 19:23 (00:23 UTC del 26), sin salas ni mixes abiertos: commit `affd6e60`, replanteos `140`, `141`, `142` y `146` en producción (respaldo antes) y la API y la web en `affd6e60867e`. Falta publicar los legales y el changelog. Antes: Hecho y probado en local (2026-11-24), en el worktree de `main`.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/142_desglose_de_elo.sql` y su inversa en `reversas/` | Nuevos |
| `web/backend/src/routes/vip-extras.ts` | `GET /api/v1/me/elo/breakdown` |
| `web/frontend/src/features/elo/**`, `routes/_app/elo.tsx` | Nuevos |
| `web/frontend/src/features/player/pages/PlayerProfile.tsx` | Botón **Ver desglose** en el perfil propio |
| `web/frontend/src/features/shell/lib/nav.ts` | Ruta de arriba de `/elo` |
| `docs/manual/jugador/desglose-de-elo.md` (nueva), `elo-y-estadisticas.md` | Manual |

## Despliegue (hecho el 2026-11-25)

Junto con los otros dos: ver [la guía del comparador](../2026-11-24-comparador-y-favoritas-vip/GUIA_IMPLEMENTACION.md).

## Pruebas

- **La cuenta, contra la copia local de producción:** en los 1739 registros con la fórmula por partida, los pasos dan exactamente el cambio guardado. De esos, 134 tienen ajuste por abandono o rendición y 303 pasaron por el tope por equipo.
- **Base:** en [`vip_140_142.sql`](../2026-11-24-comparador-y-favoritas-vip/pruebas/vip_140_142.sql): sin VIP no salen ni los pasos ni la configuración.
- **API:** `test/integration/vip-extras.test.ts`.
- **Web:** `features/elo/lib/formula.test.ts` (el simulador) y `pages/EloPage.test.tsx`.
- **Navegador:** con VIP (pasos, paginado y simulador), sin VIP (la respuesta cambiada en la prueba), claro, oscuro y 390 px.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

Ver [la guía del comparador](../2026-11-24-comparador-y-favoritas-vip/GUIA_IMPLEMENTACION.md). La inversa de la `142` solo borra la función.

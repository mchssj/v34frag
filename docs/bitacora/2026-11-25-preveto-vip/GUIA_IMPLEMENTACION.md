# Preveto de mapas para VIP: guía de implementación

## Estado

Desplegado el 2026-11-25 a las 19:23 (00:23 UTC del 26), sin salas ni mixes abiertos: commit `affd6e60`, replanteos `140`, `141`, `142` y `146` en producción (respaldo antes) y la API y la web en `affd6e60867e`. Falta publicar los legales y el changelog. Antes: Hecho y probado en local (2026-11-25), en el worktree de `main`.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/146_mm_preveto_vip.sql` y su inversa en `reversas/` | Nuevos |
| `web/backend/src/routes/mm.ts` | `PUT /api/v1/mm/preveto` |
| `web/backend/src/lib/manual.ts` | Marcador `mm.preveto_max` |
| `web/backend/test/integration/mm-preveto.test.ts` | Nuevo |
| `web/frontend/src/features/matchmaking/PrevetoPicker.tsx` | Nuevo: el selector de Jugar |
| `PlayBar.tsx`, `VetoBoard.tsx`, `room/RoomOverview.tsx`, `labels.ts`, `types.ts`, `source.ts`, `demo.ts` (misma carpeta) | El selector, los mapas prevetados en la sala y la demo |
| `admin/GeneralForm.tsx` | Sección **Preveto de mapas (VIP)** |
| `PlayPage.test.tsx`, `admin/AdminMatchmaking.test.tsx` | 3 pruebas |
| `web/frontend/src/api/schema.d.ts` | Regenerado |
| `docs/manual/jugador/buscar-partida.md`, `docs/manual/admin/matchmaking.md`, `docs/manual/README.md` | Manual |
| `terms/*.html`, `web/frontend/src/features/legal/` | Legales, con fecha 25 de noviembre |

## Despliegue (hecho el 2026-11-25)

1. Con respaldo y **sin un mix en curso** (los `alter table` bloquean un instante al worker del matchmaking), aplicar la `146`:

   ```bash
   psql -v ON_ERROR_STOP=1 -f supabase/replanteo/146_mm_preveto_vip.sql
   ```

2. Desplegar la API y después la web. La web no va antes que la base: el formulario de General espera `vip_preveto_max`.
3. Publicar los `.html` de `terms/` y el changelog 2.9.74.

No toca los servidores de juego. Al aplicarse queda en 2, pero nadie puede elegir hasta que esté la web.

## Pruebas

- **Base** ([`pruebas/preveto_146.sql`](pruebas/preveto_146.sql), en una base aparte copiada de la local): 37 de 37, también con la `145` aplicada antes, como está producción. Los más votados en 15 salas, el empate al azar en 60 salas, el VIP vencido, el mapa fuera del pool, los pools de 4 y de 2 mapas, el 0 y los permisos.
- **Ida y vuelta:** después de la inversa, las funciones quedan iguales a las de antes, con y sin la `145`.
- **API:** 4 de integración y las 685 unitarias.
- **Web:** las 144 de matchmaking y PCW, `tsc` y `eslint`.
- **Navegador** (`/demo/matchmaking`): elegir, cambiar y ver la sala, en oscuro, claro y 390 px, sin errores de consola ni desborde. La demo usa los mismos componentes con datos de mentira.
- **Sin probar:** una sala real con 10 jugadores.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

Para apagarlo sin desplegar nada: poner el máximo en 0. Para deshacerlo: volver la web y la API a la versión anterior y aplicar `reversas/146_mm_preveto_vip.sql` sin un mix en curso. Se pierden los mapas elegidos y los votos guardados.

# Página de una serie de torneo o PCW: guía de implementación

## Estado

Implementado y probado en local el 2026-11-01. Backend con commit en `feat/backend-api-fase-1` y frontend en `feat/frontend-fase-1`. Sin desplegar.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/backend/src/routes/matches.ts` | Stats de cada mapa (con Δ ELO y clutches), la demo de cada mapa y la suma de la serie con Δ ELO y clutches |
| `web/backend/src/schemas/matches.ts` | `GameRef` con `players`, `demo_size` y `demo_status` (pasa a estar después de `PlayerLine`) |
| `web/backend/src/services/matches.ts` | `sumSeries` suma el `elo_delta` |
| `web/backend/test/unit/tournament-services.test.ts`, `test/integration/llave-serie.test.ts` | Δ ELO sumado, clutches y stats por mapa en los lados de la serie |
| `docs/frontend/contrato/partidas.md` y `README.md` | Los campos nuevos |
| `web/frontend/src/features/series/` | Nuevo módulo: página, lógica (+ 7 pruebas) y clips |
| `web/frontend/src/features/mixes/components/MixRoom.tsx` | `RoomStats`: las pestañas y las tablas, separadas para usarlas en la serie |
| `web/frontend/src/features/mixes/lib/room.ts` | `statsRoomFromLines` |
| `web/frontend/src/features/mixes/lib/search.ts` y `pages/MixRoomPages.tsx`, `routes/_app/match.$id.tsx` | `?map=` y la serie en lugar de "Próximamente" |
| `web/frontend/src/api/schema.d.ts` | Regenerado |
| `pruebas/serie_vinculada_local.sql` | Datos de prueba locales (abajo) |

## Pruebas

- Backend: `pnpm typecheck`, 397 unitarias y 177 de integración.
- Frontend: typecheck, lint y 421 unitarias (7 nuevas de la serie).
- **Recorrido real** con una prueba temporal de Playwright (después se borró), en 1440 y 390 px:
  - Serie con dos mapas vinculados (uno con los bandos invertidos): veto, PICK, el decisivo que no se jugó, demos, alineaciones con el rating de la serie, clips "Procesando clips…", la suma y cada mapa con su Δ ELO.
  - Serie con los mapas a mano (Tormenta contra Kraken): "sin detalle", el aviso y las alineaciones con el rating reciente.
- Las capturas mostraron "La partida" vacía en una serie terminada y las demos en una sola línea; se corrigieron.

## Datos de prueba (solo base local)

`pruebas/serie_vinculada_local.sql` vincula a la serie "Titanes (suizo)" contra "Mamba (suizo)" del "Suizo de prueba (finalizado)" dos mixes 5v5 con stats, el veto y cuatro clips (en cola y grabándose). Se puede correr de nuevo; al final tiene el bloque para borrarlo. También completa el rating de cada fila, como hace el plugin. `../2026-11-01-rating-alineaciones/pruebas/rating_5v5_local.sql` ahora también lo completa.

## En qué se apartó del plan

- **Prueba de punta a punta:** no quedó una fija. Depende de una serie con mapas vinculados, que los datos de las pruebas (`e2e/event-fixtures.ts`) no arman. Se hizo el recorrido con una prueba temporal y se borró.
- **"Procesando clips…" sin clips:** además de los clips en cola o grabándose, se muestra si un mapa se jugó hace menos de 6 horas y su demo se está subiendo (los clips necesitan la demo).

## Ajuste: la página no se rompe con una API anterior (2026-11-02)

La web de staging se desplegó con esta página mientras la API de staging todavía no tenía `6c56bd84`. Una serie con mapas vinculados se habría roto al abrirla (`games[].players` no llegaba). Ahora `seriesMaps` completa lo que falte: sin `players` el mapa se muestra sin stats, y sin `demo_status` la demo cuenta como subida si tiene link. Una prueba unitaria nueva lo cubre.

## Despliegue (pendiente)

1. Redesplegar la API del VPS (no toca la base).
2. El frontend nuevo se publica en el corte.

## Cómo revertir

`git revert` de los commits del backend y del frontend. No hay cambios en la base.

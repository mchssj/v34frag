# Recap en vivo de cualquier jugador para los admins: guía de implementación

## Estado

Implementado el 2026-11-20 en `main`, junto con el recap de Kyan. **Sin desplegar:** sale con el despliegue de la web del recap (ver [`2026-11-19-estadisticas-de-temporada`](../2026-11-19-estadisticas-de-temporada/GUIA_IMPLEMENTACION.md)).

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/features/player/pages/PlayerProfile.tsx` | `LiveRecapButton` en la cabecera, solo admins y con temporada activa |
| `docs/manual/admin/temporadas.md` | El botón en "Estadísticas en vivo" |

## Traída del recap a `main`

- El commit de Kyan (`5cccca1c` de `kyan/recap-main`) se trajo con `cherry-pick`. Su replanteo pasó de `128` a **`129`**: la `128` de `main` es el bloqueo del admin sin límite, ya desplegado. Se cambiaron el archivo, la inversa, la fila del README del replanteo y los textos `replanteo 128`; el `PLAN.md` de Kyan queda como estaba.
- Conflictos: la fila de la bitácora (quedan las dos) y la fecha de los legales (queda la del 2026-11-20, que es la más nueva).
- Aparte, se arregló un error de tipos que ya estaba en `main` (`d25b5b5f`): `PROVIDERS` de `PrivacyPage.tsx` tiene `ReactNode` y la tabla esperaba texto, así que `tsc -b` (y el build de la web) fallaba.

## Pruebas

- API: `tsc` y 684 pruebas unitarias.
- Web: `tsc -b`, ESLint y 832 pruebas de Vitest.
- **No se probó:** la `129` contra la copia local de producción (Docker no estaba corriendo; Kyan la había probado como `128` sobre la copia), ni el botón en el navegador.

## Despliegue

**Desplegado el 2026-11-20 (18:10-18:14 UTC)**, commit `9dc88348`: respaldo `20261120T181053Z`, replanteos `129` a `132` por el túnel, API y web `9dc88348b8b9` (desde una copia limpia del commit, sin los cambios sin commit de otros requerimientos). Con una sala del matchmaking en juego (`1fd48e0f`, partida ya empezada, por decisión de Daniel), que siguió `live`. Comprobado: 12 artículos de `tactico` y 22 con `is_new`, `GET /seasons/1/summary` 200 y 121 recaps de la Temporada 1.

Lo que estaba planeado:

1. Aplicar la `129` en la base del VPS (arma los recaps de la Temporada 1).
2. Desplegar la API y la web.

## Cómo revertir

Revertir el commit del botón. No toca la base.

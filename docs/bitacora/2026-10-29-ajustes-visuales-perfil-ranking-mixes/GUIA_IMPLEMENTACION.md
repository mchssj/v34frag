# Ajustes visuales del perfil, el ranking y los mixes: guía de implementación

## Estado

Implementado y probado en local el 2026-10-29, en la rama `feat/frontend-fase-1`, sin commit y sin desplegar. Sigue el artifact aprobado (https://claude.ai/artifact/2LSZ42Yqkxn5E7BBYp2hAo).

## Archivos

Todos dentro de `web/frontend/src/`.

| Archivo | Cambio |
|---|---|
| `components/icons/game.tsx` | Nuevo: calavera, mira, reloj de arena y pinzas (Game Icons, CC BY 3.0) y el C4 propio |
| `components/illustrations/index.tsx` | Nuevo: `NoLevelBadge` y `GhostChart` |
| `routes/index.tsx` | Crédito "Íconos de juego: game-icons.net (CC BY 3.0)" en el pie de la landing |
| `features/player/PlayerProfile.tsx` | Steam, Discord y FACEIT con los íconos de Simple Icons; Discord copia el usuario; nivel vacío ilustrado |
| `features/player/EloChart.tsx` | Gráfico fantasma cuando no hay al menos 2 mixes |
| `features/player/KeyPlays.tsx` | Marca de agua por bloque, calaveras de 2 a 5, ace destacado, C4 y pinzas en Objetivos |
| `features/player/tabs.tsx` | Pestaña Equipos: escudo, chip de estado (Activo verde, Suplente, Coach, Ex integrante) y chip Líder |
| `features/teams/ui.tsx` | `TeamCrest` suma el tamaño `row` (32px); `STATUS_CHIP` compartido con el roster |
| `features/events/ui.tsx`, `features/events/model.ts` | `TagBox` usa `TeamCrest` (con logo) y el lado de la llave trae `logo_url` |
| `features/ranking/TeamsRanking.tsx`, `parts.tsx`, `labels.ts` | `TeamCrest` en lugar del cuadro propio; se van `TagBox` y `teamTag` (repetía a `crestText`) |
| `features/ranking/SeasonBar.tsx` | Opción A: control segmentado (temporada en curso, Anteriores ▾, Histórico) |
| `features/mixes/MixesList.tsx` | KPI "En vivo ahora" (con y sin mixes) y el ganador de Rondas en verde |
| `features/mixes/MixRoom.tsx` | El cuadro de cada bando muestra sus iniciales con el estilo del escudo |
| Pruebas | `PlayerProfile.test.tsx` y `ranking/labels.test.ts` ajustadas; `e2e/ranking.spec.ts` usa el botón "Histórico" |

## Despliegue

No se desplegó.

## Pruebas

- Typecheck y lint limpios; 360 unitarias en verde.
- e2e: 63 de 64. La que falla es `ranking.spec.ts` (jugadores): necesita la temporada BETA abierta y la base local no tiene temporadas, así que no llega al selector nuevo. Hay que correrla contra una base con temporada antes de dar por probado el selector en e2e.
- Visual: perfil, pestaña Equipos, ranking y mixes en oscuro a 1440px, comparados con el artifact.

## En qué se apartó del plan

- **Íconos sin paquete:** en lugar de `@iconify-json/game-icons`, los 4 íconos que se usan están copiados como componentes, con su crédito. No suma una dependencia y no pide nada a un servidor en tiempo de ejecución.
- **"Ver" del KPI en vivo:** baja hasta la tabla, porque el listado de Mixes no tiene un filtro "en vivo" en la URL.
- **Banner de la sala:** la API de mixes solo trae el nombre de cada bando, así que se muestran sus iniciales (`crestText`). La sigla de un equipo aparecerá cuando la sala reciba el equipo del lado.
- **Nivel vacío:** el título es "Sin nivel todavía" y el texto sigue siendo "Todavía no jugó mixes en el servidor."; el botón lleva a Mixes.

## Cómo revertir

Todavía no hay commit: alcanza con descartar los cambios de los archivos de la tabla y borrar `components/icons/` y `components/illustrations/`.

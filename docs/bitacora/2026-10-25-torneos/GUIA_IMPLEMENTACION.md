# Torneos (listado y detalle): guía de implementación

## Estado

Implementado y probado en local el 2026-10-25, en la rama `feat/frontend-fase-1`, sin commit y sin desplegar. Las decisiones del plan las tomó Claude por defecto; quedan para que Esteban las revise.

**2026-10-29:** los cuatro pedidos al backend (T1 a T4) llegaron con el commit `9b4eefa`, junto con los modos de juego y la inscripción con activos y suplentes, que rompían lo de acá. El frontend se adaptó en [`2026-10-29-equipo-torneos-api-frontend`](../2026-10-29-equipo-torneos-api-frontend/GUIA_IMPLEMENTACION.md): ya no se piden datos por tarjeta, y se muestran el banner, el cierre de inscripciones y "Mapa n de n".

## Archivos

Todos dentro de `web/frontend/`.

| Archivo | Cambio |
|---|---|
| `src/features/events/queries.ts` | Nuevo: 5 consultas, 2 mutaciones y los tipos corregidos |
| `src/features/events/model.ts` + `.test.ts` | Nuevo: lógica pura (16 pruebas) |
| `src/features/events/EventList.tsx` | Nuevo: listado y tarjetas |
| `src/features/events/EventView.tsx` | Nuevo: cabecera, botón según el rol y pestañas |
| `src/features/events/SummaryTab.tsx`, `BracketTab.tsx`, `StandingsTab.tsx`, `MatchesTab.tsx` | Nuevos |
| `src/features/events/RegisterDialog.tsx` | Nuevo: inscribir, cambiar inscritos y cancelar |
| `src/features/events/ui.tsx` | Nuevo |
| `src/routes/_app/events.index.tsx`, `events.$id.tsx` | Reemplazan los placeholders; validan `?status` y `?tab` |
| `src/features/shell/queries.ts` | El breadcrumb usa `eventDetailOptions` (misma clave `["event", id]`, sin pedidos dobles); sale `shellKeys.event` |
| `e2e/events.spec.ts`, `e2e/event-fixtures.ts` | Nuevos: 6 pruebas y los torneos simulados |
| `CLAUDE.md` | `events/` en la estructura |

## Despliegue

No se desplegó.

## Pruebas

- **Unitarias:** 212 en verde (16 nuevas de `model.ts`).
- **Typecheck y lint:** limpios.
- **e2e:** 56 en verde, 6 nuevas:
  - contra la API real, el listado carga sin errores;
  - con torneos simulados: orden y pie de las tarjetas, filtro en la URL y paso al detalle;
  - líder: inscribir (los Activos marcados, sin SteamID y coach deshabilitados, el mínimo), comprobando el `PUT`; el equipo aparece entre los inscritos; cancelar, comprobando el `DELETE`;
  - jugador sin liderazgo: el botón deshabilitado;
  - llave en curso: "Ver partida en vivo", chip "VIVO", el camino del equipo (opacidad 0.45 en el resto), zoom, "Ajustar" y el clic hacia la partida;
  - posiciones con grupos y "Clasifica", sin grupos, partidas con sus estados y la llave sin fixture.
- **Contra la API real, con datos de la base local:** se sembraron 10 equipos y 60 jugadores ficticios (ids con prefijo `eeeeeeee`) y cuatro torneos "Prueba · …" por la API con una cuenta admin local (`seed-torneos@test.local`): eliminación directa a medio jugar, grupos + playoffs terminado (con un empate resuelto por `POST /ties`), doble eliminación a medio jugar y uno en inscripciones. Sirvió para confirmar las formas reales (`label` de cada fase, finales creadas con un lado vacío, `starts_at` y `played_at` en null con resultados cargados a mano, `tied` y `tie_pending`). Los scripts están en `pruebas/`. Antes se respaldó la base en `~/.v34frag/local-antes-torneos-2026-10-25.dump`.
- **Visual:** capturas de las cuatro pestañas de cada torneo de prueba en oscuro y claro a 1440px, y en 390 y 320px; el diálogo y la llave con el cursor encima. Sin desborde horizontal en ninguna.

## En qué se apartó del plan

- **Gran final a la derecha:** apilar todas las secciones dejaba la gran final debajo del lower, fuera del alto del lienzo. Las etapas previas quedan apiladas a la izquierda y la final, con el campeón y el 3.er puesto, a la derecha.
- **Título repetido:** una sección de una sola columna con el mismo nombre ("Gran final") no repite el título.
- **Chip "VIVO":** en el prototipo va en la esquina y tapa el marcador del primer equipo. Se subió al borde de la tarjeta.
- **Tipos generados:** `champion` y `side.team` vienen de un `allOf` nulable; el tipo de la respuesta los da como no nulos aunque llegan en null. `queries.ts` define los tipos corregidos y cada consulta los declara.
- **Orden de los inscritos:** se envían en el orden del roster, no en el de los clics.
- **Pestaña activa en teléfono:** las pestañas se desplazan en horizontal; la activa se lleva a la vista.

## Pedidos al backend

1. En `GET /events`: el BO y el BO de la final (o `config`) y la etapa actual. Hoy cada tarjeta pide el detalle y las partidas.
2. `banner_url` (y subirlo desde el panel del organizador).
3. Fecha de cierre de inscripciones ("Cupo · cierra en…").
4. Partida en vivo del torneo con el mapa que se está jugando ("Semifinal · Mapa 2 de 3").

## Datos de prueba en la base local

Los torneos y equipos de prueba **siguen en la base local** para poder ver las vistas. Para borrarlos:

```bash
docker exec -i supabase_db_v34frag-api psql -U postgres < docs/bitacora/2026-10-25-torneos/pruebas/cleanup.sql
```

La cuenta admin `seed-torneos@test.local` también es solo local.

## Cómo revertir

Todavía no hay commit: alcanza con descartar `src/features/events/`, `e2e/event*.ts` y los cambios de los demás archivos de la tabla, y restaurar los placeholders de `events.index.tsx` y `events.$id.tsx`.

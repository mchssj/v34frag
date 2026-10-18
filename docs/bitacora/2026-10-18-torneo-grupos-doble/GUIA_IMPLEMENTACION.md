# Plantilla "Grupos de doble eliminación + playoffs" (`groups_double`): guía de implementación

## Estado

Aprobado por Daniel y hecho el 2026-10-18, probado en local, en la rama `feat/backend-api-fase-1`. **Sin desplegar:** sale en el corte con el replanteo. La web vieja no tiene el motor de torneos.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/17_grupos_doble.sql` | Nuevo (ver la documentación) |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/17_grupos_doble.sql` | Nuevo: la inversa (aborta si hay torneos `groups_double`) |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/17_grupos_doble.sql` | Nuevo: el ejemplo del diagrama de punta a punta y más casos |
| `supabase/replanteo/README.md` | Fila de la `17` |
| `web/backend/src/db/types.ts` | Regenerado |
| `web/backend/src/schemas/events.ts` | `groups_double` en `Template`, `group_double` en las tablas, `draw` en el detalle y `DrawResult` |
| `web/backend/src/routes/events.ts` | `POST /events/{id}/draw` y `draw` en el detalle |
| `web/backend/src/services/stages.ts` | Nombres de las fases de grupo |
| `web/backend/test/integration/groups-double.test.ts` | Nuevo |
| `web/backend/test/unit/tournament-services.test.ts` | Caso de los nombres nuevos |
| `docs/frontend/contract.md` | Novedades, plantilla, sorteo, endpoints y registro de decisiones |
| `docs/PENDIENTES.md`, `docs/bitacora/README.md` | Estado |

## Despliegue

Nada todavía. En el corte, la `17` va después de la `16`.

## Pruebas

### Base

**`pruebas/17_grupos_doble.sql`**, todas bien. Reproduce el ejemplo del diagrama con los mismos equipos y resultados.
- **Configuración:**
  - Valores por defecto.
  - Rechazos: 1 clasificado, 9 grupos y BO2.
- **Sorteo:**
  - Solo el organizador.
  - Trae los 12 sin repetir y registra quién y cuándo.
  - `drawn_at` no se cambia a mano, y la siembra a mano borra la marca.
- **Fixture:**
  - Grupo A: NAVI, FaZe, Vitality, Astralis, G2 y Heroic. Grupo B: MOUZ, Spirit, FURIA, Liquid, Complexity y ENCE.
  - 7 series del upper y 6 del lower por grupo, todas BO3.
  - Ronda 1: Astralis vs G2 y Vitality vs Heroic. NAVI y FaZe pasan libres.
- **Grupos:**
  - 9 series por grupo, y los libres del lower se resuelven solos.
  - Bajada cruzada: Heroic vs G2 y Astralis vs FaZe.
  - Tablas: NAVI, Vitality y FaZe; Spirit, MOUZ y Liquid. G2 y ENCE 4.º; los otros dos 5.º, compartido.
- **Playoffs:**
  - Cuartos MOUZ vs FaZe y Vitality vs Liquid; NAVI y Spirit esperan en semifinales.
  - BO3, BO3 y final BO5.
  - Final NAVI vs Vitality, y campeón Vitality.
- **Grupos de 4 (8 equipos, clasifican 2):** 3 series del upper y 2 del lower por grupo, semifinales directas y campeón. Con 7 inscritos para 2 grupos, `event_generate` lo rechaza.

**`correr.sh`** (las 17 migraciones con sus inversas y su segunda aplicación): "Todo ok".

### API

- **`groups-double.test.ts`**, contra la Supabase local, 8 equipos con capitanes que se inscriben por la API:
  - Valores por defecto y `400` con 1 clasificado.
  - Sorteo: `403` a un capitán, 200 al organizador, `draw` en el detalle, la siembra a mano lo borra, y `400` después de generar.
  - Nombres de las fases.
  - Todo jugado con resultados del organizador; la tabla `group_double`, las semifinales, la final BO5, el 3.er puesto y el campeón.
- **Prueba unitaria** de los nombres de las fases de grupo.
- **Suite completa:**
  - `pnpm typecheck` sin errores.
  - 248 pruebas unitarias y 80 de integración pasan.

## En qué se apartó del plan

- **Sin `event_group_double_order`:** el plan la nombraba, pero el puesto sale de la vista `event_group_double_standings`, y `event_group_double_team` devuelve el clasificado de cada puesto.
- **Etapa propia en `event_stage_teams`** (`group_double`): no estaba en el plan. Sin eso, los equipos aparecían con todo en cero en las tablas de los grupos de todos contra todos.
- **Los libres del lower** se resuelven cuando bajan los perdedores, no al generar (así funciona el avance del motor).

## Cómo revertir

- **Antes del corte:** revertir el commit.
- **Después del corte:** aplicar `reversas/17_grupos_doble.sql`. Antes hay que borrar los torneos `groups_double` o cambiarles la plantilla; si no, la inversa aborta.

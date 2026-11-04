# Medallas automáticas: guía de implementación

## Estado

| Parte | Estado |
|---|---|
| Replanteo `72` | **Aplicado en la base local** el 2026-11-04 (con la migración `20261029210000_medallas_datos.sql`, que a esa base le faltaba). Sin aplicar en staging ni en producción |
| API | Hecha y probada en local. Sin desplegar |
| Web (perfil y Administración › Medallas) | Hecha y probada en el navegador en local. Sin desplegar |
| Commit | `b9df74d` en `kyan/pruebas` (2026-11-04), sin push. La demo `/demo/admin-medallas` (datos de ejemplo) quedó fuera |

## Cómo se hizo

1. **Migración `72`** (como la `20261029210000`, se engancha sobre las funciones instaladas):
   - `player_medals`: `medal_key`, `source` y la restricción de temporada nueva; las de puesto existentes pasan a `source = 'temporada'` con su clave (1 a 3 podio, 4 a 10 top 10).
   - `medal_rules` con 136 reglas, generadas desde `web/frontend/public/medallas/catalogo.json`.
   - `medals_metrics`, `medals_award`, `medals_award_match`, `medals_award_all`, `admin_medals_recalculate` y `medals_award_season`.
   - `tg_notify_player_medals` suma `medal_key` y se calla con `medals.silencio`.
   - `csstv_ingest` llama a `medals_award_match` después de `csstv_match_extra`; `season_close_run` suma `medals_award_season` después del podio.
2. **API:** `medal_key`, `source` y temporada en las medallas del jugador; rutas de Administración › Medallas; `src/db/types.ts` editado a mano con las columnas, la tabla y la función nuevas (la base local está más atrás que la rama y regenerarlo borraba otras tablas).
3. **Web:** `src/api/schema.d.ts` regenerado desde la OpenAPI de la API; Logros con el dibujo; Administración › Medallas (`/admin/medals`, sección `medals` en permisos y en el menú).

## Cambios respecto del plan

- **MVP de la temporada:** el plan decía "puesto 1"; quedó como el **mejor rating** de la temporada, porque el puesto 1 ya tiene su medalla (podio).
- **Top 10 de la temporada:** ya la daba el cierre de temporada (tramo "Top 10", puestos 4 a 10). En lugar de darla de nuevo, se le pone la clave a la que ya existe.
- **Endpoints del admin:** se sumaron las reglas (`/admin/medal-rules`) y "Dar las que falten a todos", que el plan no detallaba.
- **"Dar medallas"** muestra por defecto solo las manuales, con un filtro para ver todas.
- **Fuera del alcance, para que compile:** al regenerar `schema.d.ts` apareció `rename_days` en la configuración de equipos (replanteo `68`), que el frontend no tenía; se sumó su rango (0 a 365) en `AdminTeamsPage.tsx`.

## Pruebas

- **Migración:** `pruebas/prueba_72.sql` (en una transacción que se deshace): las 33 medallas esperadas de un jugador inventado con 25 mixes, ninguna de más, no se repiten, el mínimo de 20 mixes, las de temporada y los enganches. Pasa.
- **Corrida inicial en la base local:** 125 medallas, sin avisos. La base local es la copia de producción del 2026-10-21 (pocos mixes por jugador).
- **API:** `test/integration/medals.test.ts` (3 pruebas) y `mixes-perfil-ranking.test.ts` pasan; `pnpm test` (unitarias): 503 pasan. En `players-teams.test.ts` fallan 3 pruebas de equipos porque a la base local le falta `team_config.rename_days` (replanteo `68`), no por este cambio.
- **Web:** `tsc` y `eslint` sin errores; `vitest`: la única falla es vieja (`nav.test.ts` espera "Usuarios" y el menú dice "Usuarios y moderación"). En el navegador (API en `8790`, web en `5177`, configuraciones `api-repo` y `frontend-repo-api`): las tres pestañas cargan y se dio "Beta tester" a un jugador desde la pantalla; quedó con su clave y `source = 'admin'` (después se borró).
- **No probado:** un mix real que entre por `csstv_ingest` (se probó la función que llama, no el ingreso completo), el cierre real de una temporada, el teléfono y el tema claro.

## Para desplegar

1. Staging: la migración `20261029210000` si falta, después la `72`, y `select medals_award_all();`.
2. Redesplegar la API y la web.
3. Producción, en el mismo orden, con respaldo de `player_medals`.

## Para volver atrás

```sql
begin;
-- csstv_ingest y season_close_run: sacar las líneas marcadas con "(72)" (create or replace con la definición anterior).
drop function public.admin_medals_recalculate(), public.medals_award_season(uuid), public.medals_award_all(),
              public.medals_award_match(uuid), public.medals_award(uuid[]), public.medals_metrics(uuid[]);
drop table public.medal_rules;
drop index public.player_medals_auto, public.player_medals_temporada_clave;
delete from public.player_medals where source = 'auto' or (source = 'temporada' and rank is null);
alter table public.player_medals drop constraint player_medals_temporada;
alter table public.player_medals add constraint player_medals_temporada
  check ((season_id is null) = (rank is null) and (season_id is null) = (tier is null));
alter table public.player_medals drop column medal_key, drop column source;
commit;
```

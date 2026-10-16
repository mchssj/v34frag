# Endpoints de configuración del ELO y recálculo: guía de implementación

## Estado

Hecho y probado en local el 2026-10-16: migración `13` y backend. **Sin commit y sin desplegar.** La `13` se aplica en el corte, después de la `12`.

Daniel aprobó el plan el 2026-10-16 **con la simulación**, y pidió que el recálculo sea de doble confirmación: preguntar si está seguro y pedir escribir "estoy seguro" en un campo antes de enviar.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/13_elo_simulacion.sql` | Nuevo: `elo_simulate` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/13_elo_simulacion.sql` | Nuevo: inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/13_elo_simulacion.sql` | Nuevo: pruebas |
| `web/backend/src/services/elo.ts` | Nuevo: valores por defecto, peso, cambio de ELO y vista previa |
| `web/backend/src/schemas/elo.ts` | Nuevo: valores, guardar, confirmar, vista previa y simulación |
| `web/backend/src/routes/elo.ts` | Nuevo: los cinco endpoints |
| `web/backend/src/app.ts` | Registra la ruta |
| `web/backend/src/db/types.ts` | Tipos regenerados con la `13` |
| `web/backend/test/unit/elo.test.ts` | Nuevo: vista previa (con los redondeos), esquemas y rutas con PostgREST simulado |
| `web/backend/test/integration/elo.test.ts` | Nuevo: ciclo completo contra la base local con un mix sembrado |
| `web/backend/test/integration/local.ts` | El alias de los usuarios de prueba usa la parte aleatoria (ver "Incidentes") |
| `docs/frontend/contract.md` | Sección 8c, "ELO (admin)" con la doble confirmación, pendientes y registro de decisiones |
| `supabase/replanteo/README.md`, `docs/bitacora/2026-10-14-replanteo-modelo-datos/DOCUMENTACION.md`, `docs/PENDIENTES.md` | Fila de la `13`; corte con 01 a 13 |

## Despliegue (pendiente: va en el corte)

1. **Base:** aplicar `supabase/replanteo/13_elo_simulacion.sql` después de la `12`. Solo crea una función.
2. **Backend:** sale con el primer despliegue. Sin variables nuevas.
3. **Servidores de juego:** nada.

## Pruebas

- **`correr.sh`** pasa con 01 a 13.
- **`pruebas/13_elo_simulacion.sql`**, con un mix 16-10 sembrado:
  - Con el doble de base, el ganador sube y el perdedor baja el doble; ficha y nombre del juego.
  - Con los mismos valores no cambia nadie.
  - Con 100 % de participación, quien jugó menos rondas queda sin ELO.
  - Después de simular, el ELO y la configuración siguen iguales.
  - Un valor inválido da el mensaje de `elo_set_config`.
  - Un usuario común y un anónimo no pueden simular.
- **Backend:**
  - `pnpm typecheck` sin errores.
  - 233 pruebas unitarias (24 nuevas).
  - 66 de integración (7 nuevas): lectura anónima, permisos, guardar y recalcular (el ELO del mix sembrado cambia a `±base` nueva), rechazo sin confirmar, simulación sin guardar, guardar sin recalcular, recalcular solo, y vista previa igual al motor en equipos parejos. Al final la prueba deja la configuración y el ELO como estaban.
- **Cobertura:** 97,4 % de líneas en total; `routes/elo.ts` y `services/elo.ts` al 100 %.
- **Copia de producción:** solo se contó (13 mixes terminados, 32 jugadores con ELO, 1 fila en `elo_config`). No se cargó en la base local.

## En qué se apartó del plan

- **Doble confirmación también en la API:** Daniel la pidió para el frontend. Además, la API exige `confirm: "estoy seguro"` para recalcular, así ni un error del frontend ni una llamada directa recalculan por accidente.
- **Cuerpo de `PUT /api/v1/admin/elo/config`:** los siete valores van dentro de `config` (`{ config, recompute, confirm }`), no sueltos. Es el mismo objeto que se usa en la vista previa y la simulación.
- **Redondeo de la vista previa:** al probar apareció que Postgres redondea distinto según el tipo (`numeric` aleja los empates del cero; `double precision` los lleva al par) y que JavaScript tiene error de coma flotante en `(0,9 − 1) × 25`. La vista previa replica los dos redondeos.
- **Sin fila en `elo_config`:** la base local no la tiene (producción sí). `GET` devuelve entonces los valores por defecto del motor, sin `updated_at`.

## Incidentes durante las pruebas

- **SteamID de 18 dígitos** en la primera versión de la prueba SQL: el motor solo acepta SteamID64 de 17 y no les calculaba ELO. Se corrigió la prueba.
- **Pruebas intermitentes, ajenas al ELO:** algunas corridas con cobertura fallaron en pruebas que no usan el ELO. Una fue un timeout de 20 s en `players-teams.test.ts`; otra, "Database error creating new user" en `auth.test.ts`.
  - **Causa:** el helper `createUser` (`test/integration/local.ts`) armaba el alias con los primeros 8 caracteres de `unique()`, que son la hora en base 36. Dos usuarios creados en el mismo instante chocaban contra el alias único de la `09` (`profiles_tag_unico`), según el log de la base. Con más archivos de prueba en paralelo pasaba más seguido.
  - **Arreglo:** el alias usa la parte aleatoria. Después, cuatro corridas seguidas con cobertura pasaron completas.

## Cómo revertir

- **En local:** aplicar `reversas/13_elo_simulacion.sql`.
- **Backend:** revertir el commit de esta entrega.
- **En producción:** no aplica todavía.

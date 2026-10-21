# Ajustes manuales de ELO desde el admin y sin "Recalcular ELO": guía de implementación

## Estado

Hecho el 2026-10-21, **solo en local y sin desplegar**. Las pruebas SQL, las unitarias y las de integración pasan contra la Supabase local. Sale con el corte. La web vieja no se tocó (pedido de Daniel): sigue con su botón "Recalcular ELO" hasta el corte.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/25_ajustes_elo_admin.sql` | Nuevo: `set_elo`, `elo_adjust_players`, `elo_apply_set`, `elo_apply_adjustment_row`, `elo_remove_adjustment` (resta o recalcula), las dos vistas, el recálculo con los "fijar" y sin recalcular ni simular desde la web |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/25_ajustes_elo_admin.sql` | Nuevo: inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/25_ajustes_elo_admin.sql` | Nuevo: 35 pruebas SQL |
| `supabase/replanteo/README.md` | Fila de la `25` |
| `web/backend/src/routes/elo.ts`, `src/schemas/elo.ts` | Sin recalcular ni simular; `PUT /admin/elo/config` solo con `{ config }`; rutas de ajustes y la pública del jugador |
| `web/backend/src/db/types.ts` | Regenerado |
| `web/backend/test/unit/elo.test.ts` | Pruebas de recalcular y simular reemplazadas por las de ajustes |
| `web/backend/test/integration/elo.test.ts` | Reescrita: configuración sin recalcular, endpoints borrados y el ciclo de ajustes |
| `web/backend/test/integration/seasons.test.ts` | El recálculo después del cierre se hace con la base (el endpoint ya no existe) |
| `docs/frontend/contrato/admin.md`, `jugadores.md`, `partidas.md`, `api.md`, `README.md`, `decisiones.md`, `temporadas.md` | Ajustes manuales, endpoints borrados (rompe) y decisiones |
| `docs/bitacora/2026-10-21-ajustes-elo-admin/` | `PLAN.md` (respuestas y aprobación, antes de implementar), esta guía, `DOCUMENTACION.md` y `CHANGELOG_DISCORD.txt` |

## Despliegue

**No se desplegó.** En el corte, aplicar `supabase/replanteo/25_ajustes_elo_admin.sql` después de la `24` y desplegar el backend con el resto de la web nueva. No toca el plugin ni los servidores de juego (ni el nuestro ni RBK). Publicar `CHANGELOG_DISCORD.txt` cuando la web nueva esté en línea.

## Pruebas

### SQL (`pruebas/25_ajustes_elo_admin.sql`)

Corrido en la Supabase local el 2026-10-21: **35 de 35 OK**. Ciclo de la `25`: se aplica, pasan las pruebas, una segunda aplicación aborta, la inversa deja la estructura idéntica y se vuelve a aplicar. Las 67 pruebas de la `24` siguen pasando con la `25` aplicada.

Cubre:
- Permisos: un usuario común no ajusta ni deshace; ni un admin recalcula, simula o guarda la configuración con recalcular desde la web.
- Validaciones: uno de los dos modos, rangos, motivo, hasta 10 fichas sin repetir, ficha sin SteamID.
- Sumar a dos fichas sin ELO (1000 → 1020), en el SteamID principal, con motivo y quién.
- Fijar: crea el ajuste con el valor; quien ya tiene ese ELO no; el piso al fijar y al restar.
- **El recálculo tiene en cuenta los ajustes:** con un mix anterior, el "fijar" queda en 1500 y el "sumar" se suma después del mix (1000 − 30 + 20).
- La vista pública por ficha y la del admin (solo admin, con quién y búsqueda).
- Deshacer: un "sumar" resta; un "fijar" recalcula (1000 + 30 + 20) y da lo mismo que un recálculo; con una temporada abierta después, también.

### Backend

- `pnpm typecheck`: sin errores.
- `pnpm test`: 284 de 284.
- `pnpm test:int`: 98 de 98 en los 13 archivos.

## En qué se apartó del plan

- **Sin `player_id` en `elo_adjustments`:** la ficha sale de sus SteamID (`player_steam_all`). Así el ajuste sigue al SteamID si cambia el principal o pasa a otra ficha, igual que el ELO.
- **Fijar al ELO que ya tiene no crea un ajuste** (la tabla no admite un cambio de 0): vuelve con `adjustment_id: null`.
- **Deshacer recalcula también con un comienzo de temporada o un "fijar" posterior,** no solo con un "fijar" (respuesta 3 de Daniel: que el ELO quede como en un recálculo).
- **`elo_set_config` no ignora `p_recompute` desde la web: da error.** La API siempre manda `false`.
- **Rangos y orden del listado** como los proponía el plan; `sort` solo por `applied_at` o `delta`.

## Incidentes durante las pruebas

- **Docker se cerró junto con la consola** y hubo que volver a levantar la Supabase local.
- **Una expectativa mal calculada en la prueba SQL** (Beta perdió el mix antes del ajuste: 990, no más de 1000). Se corrigió la prueba; la función estaba bien.

## Cómo revertir

Antes del corte no hay nada que revertir en producción. En una base con la `25`:

```bash
docker exec -i supabase_db_v34frag-api psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/25_ajustes_elo_admin.sql
```

Los ajustes "fijar" quedan como de sumar o restar (su `delta`). Vuelven `elo_recompute_all` y `elo_simulate` para los admins. En el backend, revertir el commit.

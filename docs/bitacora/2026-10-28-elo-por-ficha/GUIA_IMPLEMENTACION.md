# Al sumar o quitar un SteamID, recalcular solo el ELO de esa ficha: guía de implementación

## Estado

Implementado y probado en local el 2026-10-28, sin commit. Sin desplegar: el replanteo se aplica en el corte.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/34_elo_por_ficha.sql` | Nueva: `elo_recompute_player`, `elo_season_event_key`, `elo_after_attach` y `steam_detach_elo`. `approve_steam_request`, `link_steam_id` y `admin_remove_steam` dejan de llamar a `elo_recompute_all` |
| `supabase/replanteo/README.md` | Fila de la `34` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/34_elo_por_ficha.sql` | Inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/34_elo_por_ficha.sql` | 26 pruebas SQL |
| `docs/bitacora/2026-10-28-elo-por-ficha/pruebas/ensayo_copia_prod.sql` | Ensayo sobre la copia de producción |
| `web/backend/src/routes/claim.ts` y `admin-players.ts` | Descripciones de aprobar, quitar y vincular |
| `web/backend/test/integration/claim.test.ts` | Deja el ELO exacto con `elo_recompute_all` antes de comparar el cambio de principal |
| `docs/frontend/contrato/admin.md` | "Recalcula el ELO de esa ficha", con la nota del recálculo general |
| `web/frontend/src/features/admin/players/SteamTabs.tsx` y `FichasTab.tsx` | Textos de las confirmaciones y de "Antes de aprobar" |
| `web/frontend/src/api/schema.d.ts` | Regenerado con las descripciones nuevas |

## Despliegue

Pendiente, con el resto del replanteo en el corte. Va después de la `33`. No toca el plugin ni los servidores.

## Pruebas

### SQL (base local)

`pruebas/34_elo_por_ficha.sql`: 26 en verde.

- Al aprobar un SteamID adicional, el ELO, el pico, μ, σ y las filas de mixes de todos los demás quedan idénticos.
- El ELO de la ficha es el de rehacer a mano sus 6 mixes con su `win_prob`, y cada mix encadena su ELO antes y después.
- Quitar el adicional deja la ficha y el SteamID libre exactamente como estaban antes de sumarlo.
- Quitar el principal: la ficha pasa al otro SteamID y conserva su μ, y el SteamID libre vuelve a su ELO.
- Un "fijar", un ajuste de +20 y un cierre de temporada en el medio quedan aplicados en su lugar, y el pico arranca de nuevo con la temporada.
- No se crean avisos de ELO (`level_changed`, `season_ranked`, `elo_adjusted`).
- Un SteamID sin mixes ni ajustes no queda con ELO. Con solo un ajuste, da lo mismo que `elo_recompute_all`.
- Un usuario no puede llamar a `elo_recompute_player`.

En el caso de prueba, la ficha quedó en 1194 por ficha contra 1192 exacto.

Ciclo de la migración: una segunda aplicación aborta, la inversa deja la estructura idéntica (`estructura.sql`) y se vuelve a aplicar.

### Ensayo sobre la copia de producción (2026-10-28)

`pruebas/ensayo_copia_prod.sql`, con la copia del 2026-10-25 (49 mixes) y el replanteo hasta la `34` encima, en transacciones que se deshacen. En los 8 pares:

| Mixes ficha + SteamID | Demás iguales | Por ficha vs exacto | Con el recálculo general se movían |
|---|---|---|---|
| 9 + 1 | Sí | 1079 vs 1073 | 28 jugadores, hasta 4 puntos |
| 4 + 1 | Sí | 990 vs 986 | 28, hasta 3 |
| 4 + 1 | Sí | 1025 vs 1025 | 0 |
| 22 + 1 | Sí | 1054 vs 1051 | 33, hasta 5 |
| 1 + 1 | Sí | 992 vs 991 | 9, hasta 1 |
| 13 + 1 | Sí | 910 vs 910 | 33, hasta 6 |
| 2 + 1 | Sí | 997 vs 998 | 11, hasta 1 |
| 7 + 1 | Sí | 931 vs 925 | 30, hasta 3 |

Cada recálculo tardó menos de 10 ms. La copia tiene **un solo** SteamID sin ficha con ELO, así que los 8 pares usan ese mismo SteamID.

Para cargar la copia hubo que, solo en la base local:

- vaciar `clip_config` antes de cargarla, porque la copia es anterior a la migración que crea esa fila;
- renombrar los alias repetidos (la `09` aborta);
- renombrar los nicks repetidos (la `27` aborta).

Después la base local se volvió a dejar limpia con `pnpm db:reset`.

### Backend y frontend

- `web/backend`: `pnpm test` (374), `pnpm test:int` (154) y `pnpm typecheck` en verde.
- `web/frontend`: `pnpm typecheck`, `pnpm lint` y `pnpm test` (306) en verde.

## En qué se apartó del plan

- **`steam_detach` no cambió de firma.** El plan decía que también devolvería la clave nueva. En su lugar, `steam_detach_elo` anota la ficha y la clave vieja antes de llamarla y lee el principal nuevo después.
- **Se sumaron dos funciones envoltorio**, `elo_after_attach` y `steam_detach_elo`, para no repetir la lógica en las tres funciones que cambian.
- **El SteamID libre arranca con los valores por defecto de `player_elo`** (μ 20 y σ 25/3), los mismos que recibe cualquier jugador nuevo en `elo_apply_match`. El plan decía μ 25.
- **La fila nace con el primer mix o ajuste**, no al empezar. Así se comporta igual que `elo_recompute_all` con las temporadas anteriores: lo encontró una prueba.
- **La prueba de integración del cambio de principal** comparaba el ELO al aprobar con `elo_recompute_all`, que ahora difiere unos puntos. Ahora deja el ELO exacto antes de comparar.

## Incidentes durante las pruebas

Al correr `pruebas/correr.sh` completo aparecieron fallas **anteriores a la `34` y ajenas a este cambio**:

- la prueba de la `23` (`!whois` por STEAM_0 del adicional);
- la inversa de la `27`, que no deja `admin_create_server` ni `alias_check` iguales;
- la inversa de la `29`, que deja columnas sumadas a propósito, según el README;
- la inversa de la `31` (`set_user_role`);
- la inversa de la `33`, que además deja la base a medias.

La `34` se probó con su ciclo completo sobre una base recién reiniciada con todas las migraciones. Las otras fallas quedan para quien lleve esos requerimientos.

## Cómo revertir

1. Correr `reversas/34_elo_por_ficha.sql`: las tres funciones vuelven a llamar a `elo_recompute_all` y se borran las cuatro nuevas.
2. Opcional: `select elo_recompute_all();` desde el SQL Editor deja todo el ELO exacto.
3. Volver los textos con `git checkout` de los archivos de la tabla.

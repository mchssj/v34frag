# Ajuste manual del armado del matchmaking: guía de implementación

## Estado

**Desplegado el 2026-11-09 (13:58 UTC)**: la `96` en la base del VPS y la web `bbe20fd2da5f`. Commit `6663efba` en `main` y la base en `feat/mm-claim-en-sala` (`a8026437`). **Falta la copia en `feat/frontend-fase-1`**: ese día tenía a medio hacer (con conflictos) la copia de los replanteos 88 a 94 de otra sesión, y no se tocó. Sin ajustes cargados: el reparto no cambia hasta que se ponga el primero.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/96_mm_ajuste_manual_armado.sql` | Nuevo: tablas, trigger, funciones, vista, `mm_balance_elos` y la línea de `mm_tick` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/96_mm_ajuste_manual_armado.sql` | Nueva: la inversa |
| `docs/bitacora/2026-11-09-ajuste-manual-armado/pruebas/` | `probar_96.sh`, `prueba_96.sql` y `96_inversa.sql` |
| `web/frontend/src/features/legal/pages/TermsPage.tsx`, `terms/terminos.html` | Un punto nuevo en la sección del matchmaking |
| `web/frontend/src/features/legal/pages/PrivacyPage.tsx`, `terms/privacidad.html` | El dato nuevo y su plazo |
| `docs/manual/jugador/buscar-partida.md`, `docs/manual/admin/matchmaking.md` | Una frase y una fila |
| `supabase/replanteo/README.md`, `docs/bitacora/README.md`, `docs/PENDIENTES.md` | Filas y estado |

La API no cambió. La web, solo los textos legales.

## Despliegue (hecho el 2026-11-09)

Lo que se hizo:

1. Estado: sin salas activas ni nadie en la cola. La única partida `live` era la `0d42d09a…`, colgada del #1 desde antes.
2. `probar_96.sh vps` contra producción (por stdin a `docker exec -i supabase-db psql`, en una sola conexión SSH): todo `t`, la sala real armada y deshecha, y la inversa igual a antes.
3. Respaldo `20261109T135849Z` (`sudo cmleague-respaldar`, también en R2).
4. `cmleague-mm` parado, la `96` (13:58:55 UTC) con `notify pgrst, 'reload schema'`, `cmleague-mm` prendido. Comprobado: 0 ajustes, 0 en el historial, `mm_tick` y `mm_balance_elos` con lo nuevo y sin errores en el worker.
5. **Web:** `main` ya tenía commiteados los replanteos 88 a 94, que no están en producción, así que la web no salió de `main`. Se armó la rama local `deploy/web-96` sobre la versión publicada (`8991457b`) con solo los textos legales y `LEGAL_UPDATED` en 9 de noviembre (`bbe20fd2`), y `deploy/vps/desplegar.sh web` (667 pruebas): `bbe20fd2da5f`. Los textos nuevos se sirven en `/terminos` y `/privacidad`. El próximo despliegue de la web desde `main` ya los trae.
6. Los `terms/` estáticos siguen sin publicar, como los de los requerimientos anteriores.

Los pasos, para repetirlos:

Desde `main`, sin un mix en curso (`create or replace` de `mm_tick` y `mm_balance_elos`: el worker del matchmaking espera un instante).

1. Respaldo de la base del VPS, como en las anteriores.
2. Prueba contra producción (rollback):
   ```bash
   ./probar_96.sh vps | ssh ubuntu@<VPS> 'sudo docker exec -i supabase-db psql -U postgres -X -q -P pager=off'
   ```
   Todo en `t`, con `inversa_igual_a_antes`.
3. Aplicar: `tr -d '\r' < supabase/replanteo/96_mm_ajuste_manual_armado.sql | ssh ubuntu@<VPS> 'sudo docker exec -i supabase-db psql -U postgres -X -v ON_ERROR_STOP=1'`.
4. Comprobar: `select count(*) from mm_balance_overrides;` → 0, y que las salas siguen armándose.
5. Web (por los textos legales) y los `terms/` estáticos.

Como queda sin ajustes cargados, el reparto no cambia hasta que se ponga el primero.

## Pruebas

### Base local (2026-11-09, `./probar_96.sh docker`)

Todo dentro de una transacción con rollback, con 10 fichas sin cuenta con rating reciente y otra que llega al tope del rating.

| Prueba | Resultado |
|---|---|
| Sin ajustes, encendido y apagado: `mm_balance_elos` igual que con el código de la 73 | `t` |
| +150 a una ficha: solo esa sube 150 | `t` |
| Ficha con +200 por rating y +150 manual: 1000 → 1350 | `t` |
| Apagado: el ajuste se aplica; sin ajuste en la sala, null | `t` |
| Vencido: se ignora y no sale en la vista | `t` |
| 0, ±301, sin motivo, 0 o 181 días, ficha inexistente, baja sin motivo y `points = 0` a mano: fallan | `t` |
| −300 con 180 días y +300 con 30 por defecto | `t` |
| Historial de alta, cambio, cambio a mano y baja, con `db_user` | `t` |
| Baja a mano: registrada sin motivo ni autor | `t` (falló la primera vez: ver incidentes) |
| `anon` y `authenticated` sin acceso; `service_role` sí | `t` |
| `mm_tick` borra el historial de más de un año | `t` (por el texto de la función) |
| Sala real con `mm_try_build`, sin ajuste y con +300 a una ficha: `balance_elo` 300 más alto y el `elo` de la sala igual | `t`. El reparto cambió (de 4749 contra 4736 a 4900 contra 4885 de ELO de armado) |
| La inversa deja `mm_balance_elos` y `mm_tick` exactamente como antes y borra todo | `t` |

### Web

`vitest run src/features/legal`: 4 de 4.

## En qué se apartó del plan

- El borrado del historial al año lo hace `mm_tick`, que ya borra `mm_queue_log` a los 180 días. No había otra limpieza periódica.
- La prueba de `mm_tick` mira el texto de la función en vez de llamarla: llamarla arma salas y manda avisos.

## Incidentes durante las pruebas

- `mm_balance_override_clear` dejaba el motivo en una variable de la transacción, y un `delete` a mano en la misma transacción lo heredaba. Ahora la función la limpia después de borrar.

## Cómo revertir

Aplicar la inversa (`reversas/96_mm_ajuste_manual_armado.sql`): deja `mm_balance_elos` y `mm_tick` como con la `95` y borra las tablas con los ajustes y su historial. Para solo dejar de usarlo, alcanza con borrar las filas de `mm_balance_overrides`.

# Pionero para los del primer mix: guía de implementación

## Estado

Desplegado en la base de producción el 2026-11-09 a las 13:00 UTC: 9 Pionero dadas con su aviso, y NOTIONSPAPU excluido. No toca la API, la web ni los servidores de juego (#1, #2 y #3).

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/95_pionero_primer_mix.sql` | Nuevo: `medal_exclusions` y los cambios en `medal_metric_values`, `medals_award` y `medal_progress` |
| `supabase/replanteo/README.md` | Fila de la `95` |
| `docs/bitacora/2026-11-09-pionero-primer-mix/` | Plan, documentación, guía, changelog, inversa y prueba |
| `docs/manual/admin/medallas.md` | Pionero cuenta solo los mixes, y las exclusiones |
| `docs/bitacora/README.md` y `docs/PENDIENTES.md` | La fila nueva y el pendiente del cierre de la BETA, cerrado |

## Despliegue (hecho el 2026-11-09)

Todo por SSH al VPS (`ubuntu`, con el `ssh.exe` de Windows), mandando el SQL en base64 por stdin a `sudo docker exec -i supabase-db psql -U postgres`.

1. Diagnóstico, solo lectura (12:51 UTC):
   - la BETA cerró a las 09:00:05;
   - la temporada 2 se creó con un `insert` y el disparador encoló a todos;
   - el timer `cmleague-medals` corría sin errores y la cola estaba vacía;
   - se dieron 120 Fundador y 0 Pionero;
   - `medal_metric_values('first_match', …)` devolvía 0 filas porque la partida más vieja era una `official` del 2020-07-10.
2. Prueba contra producción con rollback: `bash pruebas/probar_95.sh vps > p95.sql` y mandarlo a `psql`. Todo `t`: 10 jugadores en el primer mix, 9 medallas, 9 avisos, el excluido sin medalla ni progreso y la inversa igual a antes.
3. Respaldo: `sudo /usr/local/bin/cmleague-respaldar` → `20261109T130027Z` (también en R2, `cmleague-respaldos/20261109T130027Z/`).
4. La `95` y, en otra transacción:

   ```sql
   insert into medal_exclusions (player_id, definition_id, reason)
   select '2e444310-8a50-4e45-8229-a42ef017f10b', id, 'Baneado: sin Pionero (Daniel, 2026-11-09)'
     from medal_definitions where key = 'pionero';
   select medals_evaluate_all((select id from medal_definitions where key = 'pionero'));   -- 9
   ```

5. Comprobado:
   - 9 Pionero (always, Cypee-THOR, daniloev, flow, kyan, Lukas, odreaz, sweedz y vodkaa);
   - 9 avisos `medal_granted`;
   - 0 Pionero para `2e444310-…`.

## Pruebas

### Base local (`probar_95.sh docker`)

Los mixes más viejos de la base local son de prueba y sin fichas. Por eso la prueba lleva, solo dentro de la transacción, un mix con fichas a un segundo antes del primero. También crea la definición `pionero` y una temporada 2 si faltan. Todo `t`; 6 avisos, porque en local no todos los jugadores tienen cuenta.

### Producción (`probar_95.sh vps`, con rollback)

Todo `t`, como en el paso 2 del despliegue. La partida más vieja de cualquier tipo es `official`, así que la prueba comprueba de verdad el filtro por `kind`.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

1. Si hace falta, quitar las Pionero dadas:

   ```sql
   delete from player_medals
    where source = 'auto' and definition_id = (select id from medal_definitions where key = 'pionero');
   ```

2. Aplicar `pruebas/95_inversa.sql`: deja las tres funciones como en la `79` y borra `medal_exclusions` (con la exclusión de NOTIONSPAPU). Sin la `95`, el motor no le daría Pionero a nadie, porque la partida más vieja sigue siendo una histórica.

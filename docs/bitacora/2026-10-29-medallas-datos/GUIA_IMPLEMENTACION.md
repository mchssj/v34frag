# Datos del reporter para las medallas: guía de implementación

## Estado (2026-10-29)

| Parte | Estado |
|---|---|
| Migración `20261029210000_medallas_datos.sql` | **Aplicada** en producción, staging y la base local; la prueba pasa 17 de 17 en las tres (con rollback) |
| Plugin 2.7.0 | **Desplegado el 2026-10-29 en el real y flow** (en la misma tanda). RBK no: su SFTP rechazaba el acceso y Daniel decidió dejar de usarlo ese mismo día |
| Web vieja | Sin cambios |

## Cambios respecto del plan

- **Tablas aparte en vez de columnas.** El plan ponía las columnas en `match_player_stats` y `matches`. La primera versión de la migración se aplicó así en producción y staging, pero la web vieja carga esas dos tablas completas con `select *` en cada visita, y cada fila iba a traer unos 200 bytes más. Se pasaron a `match_round_log` y `match_player_extra`. Las columnas de la primera versión estaban vacías (ningún servidor tenía la 2.7.0 y las pruebas eran con rollback) y se borraron en las tres bases con un script que abortaba si encontraba datos.
- **El ancla del parche acepta `\r\n`.** En producción `csstv_ingest` tiene saltos de línea de Windows. El primer intento abortó sin cambiar nada (estaba en una transacción).
- **Registro de rondas también para los plugins viejos.** El resultado ya lo traía; ahora se guarda desde cualquier versión.

## Pruebas

- **SQL** (`pruebas/medallas_datos.sql`, 17): resultado 2.7.0 y 2.6.1, valores inválidos, reenvío, borrado en cascada, permisos, RLS y que `matches` y `match_player_stats` no tengan columnas nuevas. Pasa en local, staging y producción.
- **Servidor local con bots** (build `CSSTV_DEBUG`, contra la Supabase local, cfg y `.smx` respaldados y restaurados, datos de prueba borrados): un mix `sm_live mr3` de 10 bots que terminó 5-7 con prórroga.
  - Las 12 rondas llegaron con `a_eq` y `b_eq` (por ejemplo, en la pistola, 500 de USP contra 400 de Glock).
  - En los 10 jugadores, la suma de `weapon_kills` es igual a `kills`.
  - `won_ct` y `won_t` coinciden con el registro de rondas.
  - `pistol_won` es 1 para cada jugador: no se contaron las rondas de la prórroga.
  - Hubo clutchs 1v2 ganados, intentos y bombas explotadas.
  - En esa prueba la base todavía tenía la primera versión (columnas). El resultado del plugin no cambió con la segunda, que se probó con la prueba SQL.

## Builds

| Servidor | Archivo | md5 |
|---|---|---|
| Real | `server/addons/sourcemod/plugins/csstv_reporter.smx` | `1f74ced7` |
| flow | `server/licencias/flow/csstv_reporter.smx` | `f02def68` |

## Despliegue (2026-10-29)

`pruebas/desplegar_medallas.py inspect` y después `apply`, en el real (`SFTP_CSS_*`, genérico) y flow (`SERVER2_*`, licenciado):

- los dos tenían la 2.6.1, que quedó en `plugins/disabled/csstv_reporter_2.6.1.smx`;
- el md5 se verificó bajando el archivo de nuevo;
- en el real se borró `disabled/csstv_reporter_2.4.1.smx` (quedan como mucho 3 anteriores);
- el cfg no cambió;
- se carga en el próximo cambio de mapa de cada servidor.

El script tenía RBK; se sacó cuando Daniel lo dio de baja.

## Pasos que faltan

1. Después del primer mix de cada servidor:

   ```sql
   select m.server_id, l.rounds -> 0, count(e.*) from matches m
     join match_round_log l on l.match_id = m.id left join match_player_extra e on e.match_id = m.id
    where m.played_at > now() - interval '1 day' group by 1, 2;
   ```

2. Publicar `CHANGELOG_DISCORD.txt`.

## Revertir

- Plugin: volver a `plugins/disabled/csstv_reporter_2.6.1.smx` en el real y flow. La base sigue funcionando con la 2.6.1.
- Base:

  ```sql
  -- primero sacar la línea "perform csstv_match_extra(v_id, p);" de csstv_ingest
  drop function public.csstv_match_extra(uuid, jsonb);
  drop table public.match_player_extra, public.match_round_log;
  ```

  Borra los datos.

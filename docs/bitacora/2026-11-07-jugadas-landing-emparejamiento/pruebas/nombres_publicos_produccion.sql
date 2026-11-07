-- Nombres públicos de los servidores en PRODUCCIÓN (después de aplicar la 83). Ids de la base del VPS al 2026-11-07.
-- name = el público (lo ve todo el mundo), internal_name = cómo lo llamamos nosotros, listed = sale en el inicio.
-- Si un id no existe, no hace nada con esa fila. Termina mostrando cómo quedó.
begin;

update game_servers set name = 'CM League #1', internal_name = 'MVZG (#1)', listed = true
 where id = '96bb5060-a639-483a-94ef-f15135c57b1b';
update game_servers set name = 'CM League #2', internal_name = 'flow (#2)', listed = true
 where id = 'cedf12a8-62ef-4360-9899-c928c3832eba';
update game_servers set name = 'CM League #3', internal_name = 'aurav34 ExtremeHost (#3)', listed = true
 where id = 'd54dddf1-702d-4271-ab9c-8dc7941b1aa4';
-- Históricos: conservan sus partidas (donde se ven con el nombre genérico), no salen en el inicio.
update game_servers set name = 'CM League (anterior)', internal_name = 'flow (histórico, UUID viejo)', listed = false
 where id = '7b01c85b-bc3e-4aa3-9ab5-3c2044157034';
update game_servers set name = 'CM League (anterior 2)', internal_name = 'RBK / Old Server (histórico)', listed = false
 where id = 'be0fd76c-6bdc-477e-a843-6efc309b5ca9';

select id, name, internal_name, listed, active from game_servers order by listed desc, name;
commit;

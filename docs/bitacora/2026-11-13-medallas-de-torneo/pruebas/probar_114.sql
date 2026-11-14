-- Prueba de la 114 sobre la base local (copia de producción). Todo en una transacción que se deshace al final.
-- Uso: probar_114.sh (pasa :r114 y :rev114, la migración y la inversa sin begin/commit).
\set QUIET on
\pset footer off
begin;

create temp table ok (n serial, caso text, bien boolean);
create function pg_temp.check(p_caso text, p_bien boolean) returns void language sql as
  $$ insert into ok (caso, bien) values (p_caso, coalesce(p_bien, false)) $$;

-- Datos de la prueba: Veto y9msgb (público, 5 campeones y 5 finalistas) y Hist qohyow (histórico, 1 campeón).
create temp table ctx as
select (select id from events where name = 'Veto y9msgb') as veto,
       (select id from events where name = 'Hist qohyow') as hist,
       (select id from medal_definitions where key = 'campeon_torneo') as d_camp,
       (select id from medal_definitions where key = 'finalista_torneo') as d_fin;
create temp table campeon_veto as select player_id from player_titles where event_id = (select veto from ctx) and result = 'champion';

-- Antes de la migración: una medalla a mano con el nombre del torneo (se tiene que adoptar) y otra de otro torneo
-- (no se toca), para el mismo jugador.
insert into player_medals (player_id, title, definition_id, source)
select '06b4b6e3-ac9e-487d-a337-7e98256451f0', 'CAMPEÓN DE ' || upper((select name from events where id = (select veto from ctx))), d_camp, 'admin' from ctx;
insert into player_medals (player_id, title, definition_id, source)
select '06b4b6e3-ac9e-487d-a337-7e98256451f0', 'CAMPEON TORNEO DE AFUERA 2016', d_camp, 'admin' from ctx;
create temp table antes as select count(*) as n_admin from player_medals where source = 'admin';
create temp table avisos0 as select count(*) as n from notifications where type = 'medal_granted';

\i :r114

-- 1. Retroactivo
select pg_temp.check('retroactivo: cada torneo terminado y aprobado tiene sus medallas',
  (select count(*) from player_medals where source = 'event')
  = (select count(distinct (t.player_id, t.event_id, t.result)) from player_titles t join events e on e.id = t.event_id
      where e.status = 'finished' and not e.testing and e.approval = 'approved'));
select pg_temp.check('retroactivo: 5 campeones y 5 finalistas en Veto',
  (select count(*) filter (where definition_id = d_camp) = 5 and count(*) filter (where definition_id = d_fin) = 5
     from player_medals, ctx where source = 'event' and event_id = veto));
select pg_temp.check('retroactivo: el histórico aprobado también',
  (select count(*) = 1 from player_medals, ctx where source = 'event' and event_id = hist));
select pg_temp.check('retroactivo: sin avisos', (select count(*) from notifications where type = 'medal_granted') = (select n from avisos0));
select pg_temp.check('adopta la manual con el nombre del torneo (sin duplicar)',
  (select count(*) = 1 and bool_and(source = 'event' and admin_title like 'CAMPEÓN DE %' and title like 'Campeón · %')
     from player_medals, ctx where player_id = '06b4b6e3-ac9e-487d-a337-7e98256451f0' and definition_id = d_camp
       and (event_id = veto or title like 'CAMPEÓN DE %')));
select pg_temp.check('la manual de otro torneo no se toca',
  exists (select 1 from player_medals where title = 'CAMPEON TORNEO DE AFUERA 2016' and source = 'admin' and event_id is null));
select pg_temp.check('quedan las manuales menos la adoptada', (select count(*) from player_medals where source = 'admin') = (select n_admin - 1 from antes));
select pg_temp.check('el motor no las da', (select medals_award(null, array(select id from medal_definitions where aggregation = 'event_result'))) = 0);
select pg_temp.check('medal_progress no las lista',
  not exists (select 1 from medal_progress('06b4b6e3-ac9e-487d-a337-7e98256451f0') p
               join medal_definitions d on d.id = p.definition_id where d.aggregation = 'event_result'));
select pg_temp.check('una medalla de torneo por jugador, torneo y medalla',
  not exists (select 1 from player_medals where source = 'event' group by player_id, event_id, definition_id having count(*) > 1));

-- Lo que sigue lo hace el motor de torneos (events_guard deja cambiar estado y campeón con v34.engine).
set local v34.engine = '1';

-- 2. Cambia el nombre del torneo: el título lo sigue
update events set name = name || ' renombrado' where id = (select veto from ctx);
set constraints all immediate; set constraints all deferred;
select pg_temp.check('el título sigue al nombre',
  (select bool_and(title like '% renombrado') from player_medals, ctx where source = 'event' and event_id = veto));
update events set name = replace(name, ' renombrado', '') where id = (select veto from ctx);
set constraints all immediate; set constraints all deferred;

-- 3. Vuelve a en curso: se quitan; la adoptada vuelve a ser manual con su título
update events set status = 'in_progress' where id = (select veto from ctx);
set constraints all immediate; set constraints all deferred;
select pg_temp.check('en curso: sin medallas', not exists (select 1 from player_medals, ctx where source = 'event' and event_id = veto));
select pg_temp.check('la adoptada vuelve a ser manual',
  exists (select 1 from player_medals where source = 'admin' and title like 'CAMPEÓN DE %' and admin_title is null and event_id is null));

-- 4. Termina de nuevo: se dan (y avisan), adoptando otra vez la manual
create temp table avisos1 as select count(*) as n from notifications where type = 'medal_granted';
update events set status = 'finished' where id = (select veto from ctx);
set constraints all immediate; set constraints all deferred;
select pg_temp.check('terminado: 10 medallas', (select count(*) = 10 from player_medals, ctx where source = 'event' and event_id = veto));
select pg_temp.check('adopta de nuevo', exists (select 1 from player_medals, ctx where source = 'event' and event_id = veto and admin_title is not null));
-- 06b4b6e3 (adoptada, sin insert) no avisa; 3c2b76f0 (finalista, nueva) sí.
select pg_temp.check('avisa la nueva', (select count(*) from notifications where type = 'medal_granted') > (select n from avisos1));

-- 5. Testing y aprobación
update events set testing = true where id = (select veto from ctx);
set constraints all immediate; set constraints all deferred;
select pg_temp.check('en testing: sin medallas', not exists (select 1 from player_medals, ctx where source = 'event' and event_id = veto));
update events set testing = false, approval = 'pending' where id = (select veto from ctx);
set constraints all immediate; set constraints all deferred;
select pg_temp.check('pendiente: sin medallas', not exists (select 1 from player_medals, ctx where source = 'event' and event_id = veto));
update events set approval = 'approved' where id = (select veto from ctx);
set constraints all immediate; set constraints all deferred;
select pg_temp.check('aprobado: vuelven', (select count(*) = 10 from player_medals, ctx where source = 'event' and event_id = veto));

-- 6. Cambia el campeón: las de campeón pasan al otro equipo
update events set champion = (select team_id from player_titles where event_id = (select veto from ctx) and result = 'runner_up' limit 1)
 where id = (select veto from ctx);
set constraints all immediate; set constraints all deferred;
select pg_temp.check('nuevo campeón: sus jugadores tienen la de campeón',
  (select count(*) = 5 from player_medals, ctx where source = 'event' and event_id = veto and definition_id = d_camp
      and player_id not in (select player_id from campeon_veto)));
select pg_temp.check('el campeón de antes la pierde',
  not exists (select 1 from player_medals, ctx where source = 'event' and event_id = veto and player_id in (select player_id from campeon_veto)));

-- 7. Histórico: plantel que se borra y se vuelve a cargar no avisa de nuevo; sacar a la ficha le quita la medalla
create temp table avisos2 as select count(*) as n from notifications where type = 'medal_granted';
create temp table plantel as select * from tournament_registration_players where event_id = (select hist from ctx);
delete from tournament_registration_players where event_id = (select hist from ctx);
insert into tournament_registration_players select * from plantel;
set constraints all immediate; set constraints all deferred;
select pg_temp.check('histórico: borrar y recargar el plantel deja la misma medalla',
  (select count(*) = 1 from player_medals, ctx where source = 'event' and event_id = hist));
select pg_temp.check('histórico: sin avisos de más', (select count(*) from notifications where type = 'medal_granted') = (select n from avisos2));
delete from tournament_registration_players where event_id = (select hist from ctx);
update tournament_registrations set guest_names = array['Sin Ficha'] where event_id = (select hist from ctx);
set constraints all immediate; set constraints all deferred;
select pg_temp.check('histórico: sin fichas, sin medallas (los nombres sin ficha no reciben)',
  not exists (select 1 from player_medals, ctx where source = 'event' and event_id = hist));

-- 8. Inversa (en producción va en otra sesión: acá se borra el reemplazar de la migración)
drop function pg_temp.reemplazar(regprocedure, text[]);
\i :rev114
select pg_temp.check('inversa: sin medallas de torneo y la adoptada vuelve a ser manual',
  not exists (select 1 from information_schema.columns where table_name = 'player_medals' and column_name = 'event_id')
  and (select count(*) from player_medals where source = 'admin') = (select n_admin from antes));
select pg_temp.check('inversa: las dos definiciones vuelven a manual',
  (select bool_and(aggregation = 'manual') from medal_definitions where key in ('campeon_torneo', 'finalista_torneo')));

\pset footer on
select n, caso, case when bien then 'ok' else 'FALLA' end as resultado from ok order by n;
select count(*) filter (where bien) || ' de ' || count(*) as total from ok;
rollback;

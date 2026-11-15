-- Prueba de la 123 sobre la base local (copia de producción). Todo en una transacción que se deshace al final.
-- Uso: probar_123.sh (pasa :r123 y :rev123, la migración y la inversa sin begin/commit).
\set QUIET on
\pset footer off
\pset pager off
begin;

create temp table ok (n serial, caso text, bien boolean);
create function pg_temp.check(p_caso text, p_bien boolean) returns void language sql as
  $$ insert into ok (caso, bien) values (p_caso, coalesce(p_bien, false)) $$;

create temp table antes as
select (select count(*) from player_medals where source = 'event') as medallas,
       (select count(*) from player_medals where source <> 'event') as otras,
       (select count(*) from notifications) as avisos;
create temp table medallas_antes as select id from player_medals where source = 'event';

\i :r123
\o /dev/null

-- =====================================================================================================
-- 1. Retroactivo
-- =====================================================================================================
select pg_temp.check('retro: no quedan medallas de torneo', not exists (select 1 from player_medals where source = 'event'));
select pg_temp.check('retro: las otras medallas no se tocan', (select count(*) from player_medals) = (select otras from antes));
select pg_temp.check('retro: respaldo con todas las medallas de torneo',
  (select count(*) from player_medals_123_respaldo) = (select medallas from antes));
select pg_temp.check('retro: cada medalla del respaldo tiene su pin',
  not exists (select 1 from player_medals_123_respaldo m
               where not exists (select 1 from player_pins pp join team_pins t on t.id = pp.team_pin_id
                                  where t.event_id = m.event_id and pp.player_id = m.player_id)));
select pg_temp.check('retro: el campeón de la medalla es campeón en el pin',
  not exists (select 1 from player_medals_123_respaldo m join medal_definitions d on d.id = m.definition_id
               join team_pins t on t.event_id = m.event_id join player_pins pp on pp.team_pin_id = t.id and pp.player_id = m.player_id
               where (d.key = 'campeon_torneo') <> (t.tier = 'champion')));
select pg_temp.check('retro: sin avisos', (select count(*) from notifications) = (select avisos from antes));
select pg_temp.check('retro: las dos definiciones vuelven a ser manuales y activas',
  (select bool_and(status = 'active' and aggregation = 'manual') from medal_definitions where key in ('campeon_torneo', 'finalista_torneo')));
select pg_temp.check('retro: pines marcados como avisados', not exists (select 1 from player_pins where not notified));
select pg_temp.check('sin triggers de la 114', not exists (select 1 from pg_trigger where tgname = 'event_medals'));

-- =====================================================================================================
-- 2. Torneos de cada formato, jugados con el motor (el de nombre menor gana siempre)
-- =====================================================================================================
select set_config('request.jwt.claims', json_build_object('sub', '2a0f4997-8f9f-4184-b71d-89df7f0f7b27', 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', '2a0f4997-8f9f-4184-b71d-89df7f0f7b27', true);

-- Un jugador con cuenta para probar los avisos: va en el primer equipo de cada torneo.
create temp table conuser as
select p.id as player_id, p.user_id from players p
 where p.user_id is not null order by p.id limit 1;

create function pg_temp.torneo(p_name text, p_template text, p_config jsonb, p_n int) returns uuid language plpgsql as $$
declare v_e uuid; v_t uuid; v_p uuid; i int;
begin
  insert into events (name, template, config, game_mode, subs_max) values (p_name, p_template, p_config, '1v1', 1) returning id into v_e;
  for i in 1 .. p_n loop
    insert into teams (name, tag) values (p_name || ' X' || lpad(i::text, 2, '0'), 'X' || lpad(i::text, 2, '0')) returning id into v_t;
    if i = 1 then
      v_p := (select player_id from conuser);
    else
      insert into players (nick) values (p_name || ' j' || i) returning id into v_p;
    end if;
    insert into tournament_registrations (event_id, team_id) values (v_e, v_t);
    insert into tournament_registration_players (event_id, team_id, player_id, role) values (v_e, v_t, v_p, 'active');
    -- Un suplente que no juega.
    insert into players (nick) values (p_name || ' sup' || i) returning id into v_p;
    insert into tournament_registration_players (event_id, team_id, player_id, role) values (v_e, v_t, v_p, 'sub');
  end loop;
  perform event_generate(v_e);
  return v_e;
end $$;

create function pg_temp.jugar(p_event uuid) returns void language plpgsql as $$
declare m record; i int := 0;
begin
  loop
    select x.id, t1.name < t2.name as gana1 into m
      from matches x join teams t1 on t1.id = x.team1 join teams t2 on t2.id = x.team2
     where x.event_id = p_event and x.status = 'upcoming' and not x.bye
     order by x.phase nulls first, x.round, x.pos limit 1;
    exit when not found;
    perform event_set_result(m.id, case when m.gana1 then '[{"r1":13,"r2":5}]' else '[{"r1":5,"r2":13}]' end::jsonb);
    i := i + 1;
    if i > 300 then raise exception 'jugar: no termina'; end if;
  end loop;
end $$;

create function pg_temp.tiers(p_event uuid) returns text language sql as $$
  select coalesce(string_agg(tier || '=' || n, ' ' order by o), '')
    from (select tier, count(*) n, min(place) o from team_pins where event_id = p_event group by tier) x
$$;

create temp table ev (k text primary key, id uuid);
create temp table avisos1 as select count(*) as n from notifications where type = 'event_pin';

insert into ev values ('single8', pg_temp.torneo('P123 S8', 'single', '{"bo":1,"bo_semi":1,"bo_final":1,"third_place":false}', 8));
insert into ev values ('single8t', pg_temp.torneo('P123 S8T', 'single', '{"bo":1,"bo_semi":1,"bo_final":1,"bo_third":1,"third_place":true}', 8));
insert into ev values ('single16', pg_temp.torneo('P123 S16', 'single', '{"bo":1,"bo_semi":1,"bo_final":1,"third_place":false}', 16));
insert into ev values ('double8', pg_temp.torneo('P123 D8', 'double', '{"bo":1,"bo_upper_final":1,"bo_lower_final":1,"bo_grand_final":1}', 8));
insert into ev values ('liga4', pg_temp.torneo('P123 L4', 'groups', '{"groups":1,"advance":1,"bo_group":1}', 4));
insert into ev values ('grupos8', pg_temp.torneo('P123 G8', 'groups', '{"groups":2,"advance":2,"bo_group":1,"playoffs":{"bo":1,"bo_semi":1,"bo_final":1}}', 8));
insert into ev values ('suizo8', pg_temp.torneo('P123 W8', 'swiss', '{"size":8,"wins":2,"stages":1,"bo":1,"bo_decisive":1,"playoffs":{"bo":1,"bo_semi":1,"bo_final":1}}', 8));
select pg_temp.jugar(id) from ev;
set constraints all immediate; set constraints all deferred;

\o
select k, (select status from events where id = ev.id) estado, pg_temp.tiers(id) pines from ev order by k;
\o /dev/null

select pg_temp.check('todos terminaron', (select bool_and(e.status = 'finished') from ev join events e on e.id = ev.id));
select pg_temp.check('el campeón es X01 en todos',
  (select bool_and(tm.tag = 'X01') from ev join events e on e.id = ev.id join teams tm on tm.id = e.champion));
select pg_temp.check('single 8 sin 3.º: campeón, finalista, 2 semis y 4 cuartos',
  pg_temp.tiers((select id from ev where k = 'single8')) = 'champion=1 finalist=1 semifinalist=2 quarter=4');
select pg_temp.check('single 8 con 3.º: tercer puesto y un semifinalista',
  pg_temp.tiers((select id from ev where k = 'single8t')) = 'champion=1 finalist=1 third=1 semifinalist=1 quarter=4');
select pg_temp.check('single 16: octavos apagados por defecto',
  pg_temp.tiers((select id from ev where k = 'single16')) = 'champion=1 finalist=1 semifinalist=2 quarter=4');
select pg_temp.check('doble 8: 3.º, 4.º y 4 cuartos',
  pg_temp.tiers((select id from ev where k = 'double8')) = 'champion=1 finalist=1 third=1 semifinalist=1 quarter=4');
select pg_temp.check('liga 4: campeón, 2.º y 3.º',
  pg_temp.tiers((select id from ev where k = 'liga4')) = 'champion=1 finalist=1 third=1');
select pg_temp.check('grupos 8 + playoffs de 4: los de grupos sin pin (participante apagado)',
  pg_temp.tiers((select id from ev where k = 'grupos8')) = 'champion=1 finalist=1 semifinalist=2');
select pg_temp.check('suizo 8: campeón y finalista',
  pg_temp.tiers((select id from ev where k = 'suizo8')) like 'champion=1 finalist=1%');
select pg_temp.check('el suplente que no jugó no recibe pin',
  not exists (select 1 from player_pins pp join team_pins t on t.id = pp.team_pin_id join ev on ev.id = t.event_id
               join tournament_registration_players r on r.event_id = t.event_id and r.player_id = pp.player_id where r.role = 'sub'));
select pg_temp.check('cada pin tiene a su jugador activo',
  not exists (select 1 from team_pins t join ev on ev.id = t.event_id
               where not exists (select 1 from player_pins pp where pp.team_pin_id = t.id)));
select pg_temp.check('un aviso por torneo al jugador con cuenta',
  (select count(*) from notifications where type = 'event_pin') - (select n from avisos1) = (select count(*) from ev));
select pg_temp.check('el aviso lleva torneo, escalón, estilo y metal',
  (select bool_and(data ? 'event' and data->>'tier' = 'champion' and data->>'style' = 'anillos' and data->>'metal' = 'oro')
     from notifications where type = 'event_pin' and data->>'event_id' in (select id::text from ev)));

-- =====================================================================================================
-- 3. Configuración
-- =====================================================================================================
create temp table avisos2 as select count(*) as n from notifications where type in ('event_pin', 'event_award');
update events set pins = '{"tiers":{"round16":{"on":true}}}' where id = (select id from ev where k = 'single16');
update events set pins = '{"tiers":{"third":{"on":false}}}' where id = (select id from ev where k = 'single8t');
update events set pins = '{"tiers":{"participant":{"on":true}}}' where id = (select id from ev where k = 'grupos8');
update events set pins = '{"tiers":{"quarter":{"min_teams":9}}}' where id = (select id from ev where k = 'single8');
update events set pins = '{"enabled":false}' where id = (select id from ev where k = 'liga4');
set constraints all immediate; set constraints all deferred;
select pg_temp.check('octavos encendidos: 8 equipos más',
  pg_temp.tiers((select id from ev where k = 'single16')) = 'champion=1 finalist=1 semifinalist=2 quarter=4 round16=8');
select pg_temp.check('tercer puesto apagado: el 3.º pasa a semifinalista',
  pg_temp.tiers((select id from ev where k = 'single8t')) = 'champion=1 finalist=1 semifinalist=2 quarter=4');
select pg_temp.check('participante encendido: los 4 de grupos',
  pg_temp.tiers((select id from ev where k = 'grupos8')) = 'champion=1 finalist=1 semifinalist=2 participant=4');
select pg_temp.check('mínimo de equipos: cuartos con 9 no se dan con 8',
  pg_temp.tiers((select id from ev where k = 'single8')) = 'champion=1 finalist=1 semifinalist=2');
select pg_temp.check('pines apagados: ninguno', pg_temp.tiers((select id from ev where k = 'liga4')) = '');
select pg_temp.check('recalcular no vuelve a avisar a quien ya tenía el pin',
  (select count(*) from notifications where type in ('event_pin', 'event_award')) = (select n from avisos2));
select pg_temp.check('registro: 5 cambios con quién los hizo',
  (select count(*) = 5 and bool_and(changed_by = '2a0f4997-8f9f-4184-b71d-89df7f0f7b27') from event_pins_log l join ev on ev.id = l.event_id));
select pg_temp.check('configuración inválida: rechazada', not pins_valid('{"tiers":{"champion":{"metal":"diamante"}}}'));
select pg_temp.check('configuración inválida: min_teams fuera de rango', not pins_valid('{"tiers":{"quarter":{"min_teams":1}}}'));
select pg_temp.check('configuración inválida: clave desconocida', not pins_valid('{"color":"rojo"}'));
select pg_temp.check('pins_config completa lo que falta',
  (select pins_config('{"style":"cristal","tiers":{"third":{"on":false}}}') -> 'tiers' -> 'third' = '{"on":false,"metal":"bronce","min_teams":null}'::jsonb
      and pins_config(null)->'awards'->'play'->>'mode' = 'pick'));

-- =====================================================================================================
-- 4. Corregir la final y testing
-- =====================================================================================================
create temp table avisos3 as select count(*) as n from notifications where type = 'event_pin';
select event_set_result((select m.id from matches m where m.event_id = (select id from ev where k = 'single8') and m.stage = 'ko'
                          order by m.round desc limit 1), '[{"r1":5,"r2":13}]');
set constraints all immediate; set constraints all deferred;
select pg_temp.check('corregir la final: X01 pasa a finalista',
  (select t.tier = 'finalist' from team_pins t join teams tm on tm.id = t.team_id
    where t.event_id = (select id from ev where k = 'single8') and tm.tag = 'X01'));
select pg_temp.check('corregir la final: sin avisos nuevos a quien ya tenía pin',
  (select count(*) from notifications where type = 'event_pin') = (select n from avisos3));
update events set testing = true where id = (select id from ev where k = 'double8');
set constraints all immediate; set constraints all deferred;
select pg_temp.check('torneo en testing: sin pines', pg_temp.tiers((select id from ev where k = 'double8')) = '');
update events set testing = false where id = (select id from ev where k = 'double8');
set constraints all immediate; set constraints all deferred;
select pg_temp.check('sale de testing: vuelven', pg_temp.tiers((select id from ev where k = 'double8')) <> '');

-- =====================================================================================================
-- 5. Premios individuales (un torneo de la copia con stats de mixes vinculados)
-- =====================================================================================================
create temp table pr as
select w.event_id from player_awards w where w.award = 'mvp' and not w.manual limit 1;
\o
select 'premios del torneo con stats' as que, w.award, p.nick, w.value from player_awards w join players p on p.id = w.player_id
 where w.event_id = (select event_id from pr) order by w.award;
\o /dev/null
select pg_temp.check('hay un torneo con MVP automático', exists (select 1 from pr));
select pg_temp.check('mvp calculable', event_award_calculable((select event_id from pr), 'mvp'));
select pg_temp.check('jugada nunca calculable', not event_award_calculable((select event_id from pr), 'play'));
create temp table cand as select * from event_award_candidates((select event_id from pr), 'mvp');
select pg_temp.check('candidatos: los sugeridos tienen cifra y el primero es el automático',
  (select bool_and(value is not null) from cand where suggested) and (select count(*) between 1 and 10 from cand where suggested)
  and (select max(value) from cand) = (select value from player_awards where event_id = (select event_id from pr) and award = 'mvp' limit 1));
select pg_temp.check('candidatos: todo el plantel',
  (select count(*) from cand) = (select count(*) from tournament_registration_players where event_id = (select event_id from pr)));
-- Elegir a mano a otro candidato (o al mismo, si es el único).
select event_award_pick((select event_id from pr), 'mvp',
  coalesce((select c.player_id from cand c where not c.suggested limit 1), (select c.player_id from cand c order by c.value asc nulls last limit 1)));
set constraints all immediate; set constraints all deferred;
select pg_temp.check('a mano: pisa al automático',
  (select count(*) = 1 and bool_and(manual) from player_awards where event_id = (select event_id from pr) and award = 'mvp'));
update events set name = name || ' renombrado' where id = (select event_id from pr);
set constraints all immediate; set constraints all deferred;
select pg_temp.check('a mano: sigue después de un recálculo',
  (select count(*) = 1 and bool_and(manual) from player_awards where event_id = (select event_id from pr) and award = 'mvp'));
select event_award_clear((select event_id from pr), 'mvp');
select pg_temp.check('borrar la elección: vuelve el automático',
  (select count(*) >= 1 and bool_and(not manual) from player_awards where event_id = (select event_id from pr) and award = 'mvp'));
update events set pins = '{"awards":{"mvp":{"mode":"pick"}}}' where id = (select event_id from pr);
set constraints all immediate; set constraints all deferred;
select pg_temp.check('modo "lo elijo yo": queda pendiente',
  not exists (select 1 from player_awards where event_id = (select event_id from pr) and award = 'mvp'));
update events set pins = '{"awards":{"top_fragger":{"on":false}}}' where id = (select event_id from pr);
set constraints all immediate; set constraints all deferred;
select pg_temp.check('premio apagado: se borra',
  not exists (select 1 from player_awards where event_id = (select event_id from pr) and award = 'top_fragger'));
select pg_temp.check('elegir en un torneo ajeno sin permiso: error', (
  select false));  -- se prueba abajo con otro usuario
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
  begin
    perform event_award_pick((select event_id from pr), 'mvp', (select player_id from cand limit 1));
    update ok set bien = false where caso = 'elegir en un torneo ajeno sin permiso: error';
  exception when insufficient_privilege then
    update ok set bien = true where caso = 'elegir en un torneo ajeno sin permiso: error';
  end;
  perform set_config('request.jwt.claim.sub', '2a0f4997-8f9f-4184-b71d-89df7f0f7b27', true);
  perform set_config('request.jwt.claims', '{"sub":"2a0f4997-8f9f-4184-b71d-89df7f0f7b27","role":"authenticated"}', true);
end $$;
select pg_temp.check('el premio elegido con un jugador no inscrito: error', true);
do $$
begin
  begin
    perform event_award_pick((select event_id from pr), 'mvp', (select id from players where nick = 'P123 S8 j2'));
    update ok set bien = false where caso = 'el premio elegido con un jugador no inscrito: error';
  exception when others then null;
  end;
end $$;

-- =====================================================================================================
-- 6. Vitrina
-- =====================================================================================================
create temp table vit as select (select player_id from conuser) as pl;
select pg_temp.check('vitrina automática: hasta 6',
  (select count(*) between 1 and 6 from player_showcase_shown where player_id = (select pl from vit)));
select pg_temp.check('vitrina automática: el primero es un campeonato',
  (select t.tier = 'champion' from player_showcase_shown s join player_pins pp on pp.id = s.ref_id join team_pins t on t.id = pp.team_pin_id
    where s.player_id = (select pl from vit) and s.pos = 1));
insert into player_showcase_prefs (player_id, mode) values ((select pl from vit), 'manual');
insert into player_showcase (player_id, kind, ref_id, position)
select (select pl from vit), 'pin', pp.id, 1 from player_pins pp join team_pins t on t.id = pp.team_pin_id
 where pp.player_id = (select pl from vit) and t.tier = 'finalist' limit 1;
select pg_temp.check('vitrina manual: solo lo elegido',
  (select count(*) = 1 from player_showcase_shown where player_id = (select pl from vit)));

-- =====================================================================================================
-- 7. Inversa
-- =====================================================================================================
drop function pg_temp.reemplazar(regprocedure, text[]);
\i :rev123
select pg_temp.check('inversa: vuelven las medallas de torneo',
  (select count(*) from player_medals where source = 'event') >= (select medallas from antes));
select pg_temp.check('inversa: las de antes, todas',
  not exists (select 1 from medallas_antes a where not exists (select 1 from player_medals m where m.id = a.id and m.source = 'event')));
select pg_temp.check('inversa: definiciones event_result',
  (select bool_and(status = 'active' and aggregation = 'event_result') from medal_definitions where key in ('campeon_torneo', 'finalista_torneo')));
select pg_temp.check('inversa: sin tablas de pines', to_regclass('public.team_pins') is null);
select pg_temp.check('inversa: vuelven los triggers de la 114', (select count(*) = 3 from pg_trigger where tgname = 'event_medals'));

\o
select n, case when bien then 'ok' else 'FALLA' end as resultado, caso from ok order by n;
select count(*) filter (where bien) as bien, count(*) filter (where not bien) as fallas from ok;
rollback;

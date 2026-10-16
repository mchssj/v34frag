-- Pruebas de supabase/replanteo/10_partidas_torneos.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.falla(q text, patron text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'NO FALLÓ: %', q;
exception when others then
  if sqlerrm like 'NO FALLÓ%' or sqlerrm not like patron then
    raise exception 'falla(%): se esperaba "%", vino "%"', q, patron, sqlerrm;
  end if;
end $$;
grant execute on function pg_temp.falla(text, text) to anon, authenticated;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '{"role":"anon"}'
         else format('{"sub":"%s","role":"authenticated"}', u) end, true) $$;
grant execute on function pg_temp.como(text) to anon, authenticated;

-- 32 equipos oficiales (E01..E32) con 5 jugadores con SteamID cada uno.
create temp table eqs as
  select i, ('eeeeeeee-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid as id, 'E' || lpad(i::text, 2, '0') as name
    from generate_series(1, 32) i;
grant select on eqs to anon, authenticated;
insert into public.teams(id, name, tag, kind) select id, name, name, 'official' from eqs;
insert into public.players(id, nick, steam_id)
  select ('dddddddd-1000-4000-8000-' || lpad((e.i * 10 + j)::text, 12, '0'))::uuid, e.name || 'p' || j,
         '7656119800' || lpad((e.i * 10 + j)::text, 7, '0')
    from eqs e, generate_series(1, 6) j;
insert into public.team_members(team_id, player_id, joined_at)
  select e.id, ('dddddddd-1000-4000-8000-' || lpad((e.i * 10 + j)::text, 12, '0'))::uuid, now() from eqs e, generate_series(1, 6) j;
create function pg_temp.pl(eq int, j int) returns uuid language sql as $$ select ('dddddddd-1000-4000-8000-' || lpad((eq * 10 + j)::text, 12, '0'))::uuid $$;
grant execute on function pg_temp.pl(int, int) to anon, authenticated;
create function pg_temp.eq(i int) returns uuid language sql as $$ select ('eeeeeeee-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid $$;
grant execute on function pg_temp.eq(int) to anon, authenticated;

-- Cuentas: admin, organizador, otro organizador, capitán de E01, jugador cualquiera.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-1000-4000-8000-0000000000ad', 'admin10@test.local', '{"tag":"Admin10"}'),
  ('aaaaaaaa-1000-4000-8000-000000000001', 'org10@test.local', '{"tag":"Org10"}'),
  ('aaaaaaaa-1000-4000-8000-000000000002', 'org10b@test.local', '{"tag":"Org10b"}'),
  ('aaaaaaaa-1000-4000-8000-000000000003', 'cap10@test.local', '{"tag":"Cap10"}'),
  ('aaaaaaaa-1000-4000-8000-000000000004', 'cap10b@test.local', '{"tag":"Cap10b"}'),
  ('aaaaaaaa-1000-4000-8000-000000000005', 'nadie10@test.local', '{"tag":"Nadie10"}');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-1000-4000-8000-0000000000ad';
update public.players set user_id = 'aaaaaaaa-1000-4000-8000-000000000003' where id = pg_temp.pl(1, 1);
update public.players set user_id = 'aaaaaaaa-1000-4000-8000-000000000004' where id = pg_temp.pl(2, 1);
update public.teams set captain_id = 'aaaaaaaa-1000-4000-8000-000000000003', owner_id = 'aaaaaaaa-1000-4000-8000-000000000003' where id = pg_temp.eq(1);
update public.teams set captain_id = 'aaaaaaaa-1000-4000-8000-000000000004', owner_id = 'aaaaaaaa-1000-4000-8000-000000000004' where id = pg_temp.eq(2);

-- Inscribe los equipos del 1 al n (jugadores 1 a 5) directo en la base.
create function pg_temp.inscribir(ev uuid, n int, desde int default 1) returns void language sql as $$
  insert into public.tournament_registrations(event_id, team_id) select ev, pg_temp.eq(i) from generate_series(desde, desde + n - 1) i;
  insert into public.tournament_registration_players(event_id, team_id, player_id)
    select ev, pg_temp.eq(i), pg_temp.pl(i, j) from generate_series(desde, desde + n - 1) i, generate_series(1, 5) j;
$$;

-- Juega todo lo jugable como si llegara del servidor: gana el equipo de número más bajo (mejor sembrado),
-- 16-10 en cada mapa. Devuelve cuántas partidas jugó.
create function pg_temp.jugar(ev uuid, max_partidas int default 1000) returns int language plpgsql as $$
declare m record; n int := 0; nombre1 text; nombre2 text; gana1 boolean; w int; mapas jsonb;
begin
  loop
    perform set_config('v34.engine', '', true);
    select * into m from public.matches where event_id = ev and status = 'upcoming' and team1 is not null and team2 is not null
     order by phase, stage, round, pos limit 1;
    exit when not found or n >= max_partidas;
    select name into nombre1 from public.teams where id = m.team1;
    select name into nombre2 from public.teams where id = m.team2;
    gana1 := nombre1 < nombre2;
    w := m.best_of / 2 + 1 - case when m.advantage_side = case when gana1 then 1 else 2 end then 1 else 0 end;
    select jsonb_agg(case when gana1 then '{"map":"de_dust2_ob","r1":16,"r2":10}'::jsonb else '{"map":"de_dust2_ob","r1":10,"r2":16}'::jsonb end)
      into mapas from generate_series(1, w);
    update public.matches set status = 'finished', winner = case when gana1 then team1 else team2 end, maps = mapas,
      score1 = case when gana1 then w + coalesce(score1, 0) else coalesce(score1, 0) end,
      score2 = case when gana1 then coalesce(score2, 0) else w + coalesce(score2, 0) end
     where id = m.id;
    n := n + 1;
  end loop;
  perform set_config('v34.engine', '', true);
  return n;
end $$;

-- ---------- configuración y permisos ----------
do $$
begin
  assert public.event_config('swiss', '{"stages":2,"size":8,"wins":2}') @> '{"stages":2,"size":8,"wins":2,"bo":1,"bo_decisive":3,"playoffs":{"bo":3,"bo_final":3,"third_place":false}}', 'defaults del suizo';
  assert public.event_config('double', '{}') @> '{"bo":3,"bo_upper_final":3,"bo_lower_final":3,"bo_grand_final":5,"advantage":false}', 'defaults de doble';
  assert public.event_config('groups', '{}') @> '{"groups":2,"advance":2,"bo_group":1,"playoffs":{"bo":3}}', 'defaults de grupos';
  assert public.event_config('single', '{"bo":1,"basura":7}') = '{"bo":1,"bo_semi":3,"bo_final":3,"third_place":false,"bo_third":3,"decider_versions":{}}', 'single y claves desconocidas';
  begin perform public.event_config('single', '{"bo":2}'); assert false, 'BO2'; exception when others then assert sqlerrm like 'Los formatos tienen que ser%', sqlerrm; end;
  begin perform public.event_config('swiss', '{"size":12}'); assert false, 'size'; exception when others then assert sqlerrm like 'Cada fase suiza%', sqlerrm; end;
end $$;

set local role authenticated;
select pg_temp.como('aaaaaaaa-1000-4000-8000-000000000005');
select pg_temp.falla($q$insert into public.events(name) values ('No')$q$, 'Solo un organizador o un admin puede crear torneos');
select pg_temp.como('aaaaaaaa-1000-4000-8000-0000000000ad');
select public.set_user_role('aaaaaaaa-1000-4000-8000-000000000001', 'organizer');
select public.set_user_role('aaaaaaaa-1000-4000-8000-000000000002', 'organizer');
select pg_temp.falla($q$select public.set_user_role('aaaaaaaa-1000-4000-8000-0000000000ad', 'user')$q$, 'El rol de un admin%');
select pg_temp.como('aaaaaaaa-1000-4000-8000-000000000001');
insert into public.events(id, name, template, config, players_min, players_max)
  values ('ffffffff-1000-4000-8000-000000000001', 'Copa Org', 'single', '{"bo":1}', 5, 6);
select pg_temp.como('aaaaaaaa-1000-4000-8000-000000000002');
do $$
begin
  update public.events set name = 'Robado' where id = 'ffffffff-1000-4000-8000-000000000001';
  assert not found, 'otro organizador editó un torneo ajeno';
end $$;
select pg_temp.falla($q$select public.event_generate('ffffffff-1000-4000-8000-000000000001')$q$, 'Solo el organizador%');
select pg_temp.como('aaaaaaaa-1000-4000-8000-000000000001');
select pg_temp.falla($q$update public.events set status = 'finished' where id = 'ffffffff-1000-4000-8000-000000000001'$q$, 'El estado del torneo lo maneja la página%');
do $$
begin
  assert (select organizer_id from public.events where id = 'ffffffff-1000-4000-8000-000000000001') = 'aaaaaaaa-1000-4000-8000-000000000001', 'organizer_id';
  assert (select config->>'bo_final' from public.events where id = 'ffffffff-1000-4000-8000-000000000001') = '3', 'config normalizada';
end $$;

-- ---------- inscripción con jugadores ----------
select pg_temp.como('aaaaaaaa-1000-4000-8000-000000000003');
select pg_temp.falla(format('select public.event_register(%L, %L, %L)', 'ffffffff-1000-4000-8000-000000000001', pg_temp.eq(1), array[pg_temp.pl(1,1), pg_temp.pl(1,2)]), 'Cada equipo inscribe entre 5 y 6 jugadores');
select pg_temp.falla(format('select public.event_register(%L, %L, %L)', 'ffffffff-1000-4000-8000-000000000001', pg_temp.eq(2), array[pg_temp.pl(2,1), pg_temp.pl(2,2), pg_temp.pl(2,3), pg_temp.pl(2,4), pg_temp.pl(2,5)]), 'Solo el capitán del equipo%');
select public.event_register('ffffffff-1000-4000-8000-000000000001', pg_temp.eq(1), array[pg_temp.pl(1,1), pg_temp.pl(1,2), pg_temp.pl(1,3), pg_temp.pl(1,4), pg_temp.pl(1,5)]);
reset role;
-- Un jugador de E01 también entra a E02: puede estar en los dos equipos, pero no inscrito con los dos.
insert into public.team_members(team_id, player_id, joined_at) values (pg_temp.eq(2), pg_temp.pl(1, 2), now());
set local role authenticated;
select pg_temp.como('aaaaaaaa-1000-4000-8000-000000000004');
select pg_temp.falla(format('select public.event_register(%L, %L, %L)', 'ffffffff-1000-4000-8000-000000000001', pg_temp.eq(2), array[pg_temp.pl(2,1), pg_temp.pl(1,2), pg_temp.pl(2,3), pg_temp.pl(2,4), pg_temp.pl(2,5)]), 'E01p2 ya está inscrito en este torneo con E01.%');
select public.event_register('ffffffff-1000-4000-8000-000000000001', pg_temp.eq(2), array[pg_temp.pl(2,1), pg_temp.pl(2,2), pg_temp.pl(2,3), pg_temp.pl(2,4), pg_temp.pl(2,5)]);
reset role;
-- Si un inscrito sale del equipo, deja de estar inscrito.
update public.team_members set left_at = now() where team_id = pg_temp.eq(2) and player_id = pg_temp.pl(2, 5);
do $$
begin
  assert (select count(*) from public.tournament_registration_players where event_id = 'ffffffff-1000-4000-8000-000000000001' and team_id = pg_temp.eq(2)) = 4, 'el que salió sigue inscrito';
  assert (select seeds from public.events where id = 'ffffffff-1000-4000-8000-000000000001') = array[pg_temp.eq(1), pg_temp.eq(2)], 'siembra por orden de inscripción';
end $$;
set local role authenticated;
select pg_temp.como('aaaaaaaa-1000-4000-8000-000000000001');
select pg_temp.falla($q$select public.event_generate('ffffffff-1000-4000-8000-000000000001')$q$, 'E02 tiene 4 jugadores inscritos (mínimo 5)');
select public.event_unregister('ffffffff-1000-4000-8000-000000000001', pg_temp.eq(2));
reset role;

-- ---------- eliminación directa: 5 equipos, byes, 3.er puesto y avance "por el servidor" ----------
insert into public.events(id, name, template, config) values ('ffffffff-1000-4000-8000-000000000002', 'Single', 'single', '{"bo":1,"bo_semi":3,"bo_final":5,"third_place":true}');
select pg_temp.inscribir('ffffffff-1000-4000-8000-000000000002', 5);
set local role authenticated;
select pg_temp.como('aaaaaaaa-1000-4000-8000-0000000000ad');
select public.event_generate('ffffffff-1000-4000-8000-000000000002');
reset role;
do $$
declare ev uuid := 'ffffffff-1000-4000-8000-000000000002';
begin
  assert (select status from public.events where id = ev) = 'in_progress', 'estado tras generar';
  -- Llave de 8: 4 partidas de cuartos (3 byes), 2 semis, final y 3.er puesto.
  assert (select count(*) from public.matches where event_id = ev and stage = 'ko') = 7, 'partidas de la llave';
  assert (select count(*) from public.matches where event_id = ev and bye) = 3, 'byes';
  assert (select array_agg(best_of order by round) from (select distinct round, best_of from public.matches where event_id = ev and stage = 'ko') x) = '{1,3,5}', 'BO por ronda';
  -- Los byes ya pasaron a semis: el 1, el 2 y el 3 esperan rival o juegan.
  assert (select count(*) from public.matches where event_id = ev and stage = 'ko' and round = 2 and team1 is not null) = 2, 'byes avanzados';
  assert pg_temp.jugar(ev) = 5, 'partidas jugadas (cuartos, 2 semis, final y 3.er puesto)';
  assert (select (status, champion) = ('finished'::text, pg_temp.eq(1)) from public.events where id = ev), 'campeón';
  assert (select winner from public.matches where event_id = ev and stage = 'third') = pg_temp.eq(3), 'tercer puesto';
end $$;

-- Corrección: la final se puede corregir; una semifinal no (ya se jugó la final).
set local role authenticated;
select pg_temp.como('aaaaaaaa-1000-4000-8000-0000000000ad');
select pg_temp.falla(format('select public.event_set_result(%L, %L)', (select id from public.matches where event_id = 'ffffffff-1000-4000-8000-000000000002' and stage = 'ko' and round = 2 and pos = 1), '[{"map":"a","r1":2,"r2":16},{"map":"b","r1":2,"r2":16}]'), 'Ya se jugaron partidas que dependen de esta%');
select public.event_set_result((select id from public.matches where event_id = 'ffffffff-1000-4000-8000-000000000002' and stage = 'ko' and round = 3),
  '[{"map":"a","r1":2,"r2":16},{"map":"b","r1":2,"r2":16},{"map":"c","r1":2,"r2":16}]');
select pg_temp.falla(format('select public.event_set_result(%L, %L)', (select id from public.matches where event_id = 'ffffffff-1000-4000-8000-000000000002' and stage = 'ko' and round = 3), '[{"map":"a","r1":16,"r2":16}]'), 'Un mapa no puede terminar empatado%');
select pg_temp.falla(format('select public.event_set_result(%L, %L)', (select id from public.matches where event_id = 'ffffffff-1000-4000-8000-000000000002' and stage = 'ko' and round = 3), '[{"map":"a","r1":16,"r2":3}]'), 'Con esos mapas la serie no queda definida (BO5)');
reset role;
do $$
begin
  assert (select champion from public.events where id = 'ffffffff-1000-4000-8000-000000000002') = pg_temp.eq(2), 'campeón corregido';
end $$;

-- ---------- doble eliminación con mapa de ventaja ----------
insert into public.events(id, name, template, config) values ('ffffffff-1000-4000-8000-000000000003', 'Double', 'double', '{"advantage":true}');
select pg_temp.inscribir('ffffffff-1000-4000-8000-000000000003', 4);
select public.event_generate('ffffffff-1000-4000-8000-000000000003');
do $$
declare ev uuid := 'ffffffff-1000-4000-8000-000000000003'; g record;
begin
  assert (select count(*) from public.matches where event_id = ev and stage = 'upper') = 3, 'upper';
  assert (select count(*) from public.matches where event_id = ev and stage = 'lower') = 2, 'lower';
  select * into g from public.matches where event_id = ev and stage = 'grand';
  assert (g.best_of, g.advantage_side, g.score1, g.score2) = (5, 1::smallint, 1, 0), format('gran final: %s', row(g.best_of, g.advantage_side, g.score1, g.score2));
  assert pg_temp.jugar(ev) = 6, 'partidas jugadas';
  -- E01 gana el upper y la gran final con 2 mapas (más el de ventaja = 3 en un BO5).
  select * into g from public.matches where event_id = ev and stage = 'grand';
  assert (g.winner, g.score1, g.score2, jsonb_array_length(g.maps)) = (pg_temp.eq(1), 3, 0, 2), format('gran final jugada: %s', row(g.score1, g.score2, g.maps));
  assert (select champion from public.events where id = ev) = pg_temp.eq(1), 'campeón de doble';
  -- El perdedor de la final del upper llegó a la gran final por el lower.
  assert g.team2 = pg_temp.eq(2), 'finalista del lower';
end $$;

-- ---------- grupos + playoffs: 8 equipos, 2 grupos, clasifican 2 ----------
insert into public.events(id, name, template, config) values ('ffffffff-1000-4000-8000-000000000004', 'Grupos', 'groups', '{"groups":2,"advance":2}');
select pg_temp.inscribir('ffffffff-1000-4000-8000-000000000004', 8);
select public.event_generate('ffffffff-1000-4000-8000-000000000004');
do $$
declare ev uuid := 'ffffffff-1000-4000-8000-000000000004'; semi record;
begin
  assert (select count(*) from public.matches where event_id = ev and stage = 'group') = 12, 'partidas de grupos (6 por grupo)';
  assert (select array_agg(grp order by seed) from public.event_stage_teams where event_id = ev) = '{1,2,2,1,1,2,2,1}', 'reparto en serpentina';
  assert pg_temp.jugar(ev, 12) = 12, 'grupos';
  assert (select count(*) from public.matches where event_id = ev and stage = 'ko') = 3, 'playoffs armados solos';
  -- Grupo 1: E01, E04, E05, E08 → 1.º E01, 2.º E04. Grupo 2: E02, E03, E06, E07 → 1.º E02, 2.º E03.
  assert (select array_agg(team_id order by place) from public.event_group_order(ev, 1)) = array[pg_temp.eq(1), pg_temp.eq(4), pg_temp.eq(5), pg_temp.eq(8)],
    format('orden del grupo 1: %s', (select string_agg(t.name || ':' || s.points || '/' || s.rounds_diff, ' ' order by o.place)
                                       from public.event_group_order(ev, 1) o join public.teams t on t.id = o.team_id
                                       join public.event_group_standings s on s.team_id = o.team_id and s.event_id = ev));
  -- Cruces: el 1.º de un grupo contra el 2.º del otro.
  for semi in select team1, team2 from public.matches where event_id = ev and stage = 'ko' and round = 1 loop
    assert (select grp from public.event_stage_teams where event_id = ev and team_id = semi.team1) <>
           (select grp from public.event_stage_teams where event_id = ev and team_id = semi.team2), 'cruce del mismo grupo';
  end loop;
  perform pg_temp.jugar(ev);
  assert (select champion from public.events where id = ev) = pg_temp.eq(1), 'campeón de grupos';
  assert (select points from public.event_group_standings where event_id = ev and team_id = pg_temp.eq(1)) = 9, 'puntos';
  assert (select rounds_diff from public.event_group_standings where event_id = ev and team_id = pg_temp.eq(1)) = 18, 'diferencia de rondas';
end $$;
-- No se puede cambiar un resultado de grupos con los playoffs armados.
select pg_temp.falla(format('select public.event_set_result(%L, %L)', (select id from public.matches where event_id = 'ffffffff-1000-4000-8000-000000000004' and stage = 'group' limit 1), '[{"map":"a","r1":2,"r2":16}]'), '%');

-- Empate que los criterios no resuelven: 3 equipos en un grupo, todos 1-1 con la misma diferencia.
insert into public.events(id, name, template, config) values ('ffffffff-1000-4000-8000-000000000005', 'Empate', 'groups', '{"groups":1,"advance":1}');
select pg_temp.inscribir('ffffffff-1000-4000-8000-000000000005', 3);
select public.event_generate('ffffffff-1000-4000-8000-000000000005');
do $$
declare ev uuid := 'ffffffff-1000-4000-8000-000000000005'; m record;
begin
  -- Cada uno le gana a uno: E01>E02, E02>E03, E03>E01, todos 16-10.
  for m in select id, team1, team2 from public.matches where event_id = ev loop
    perform set_config('v34.engine', '', true);
    update public.matches set status = 'finished',
      winner = case when (m.team1, m.team2) in ((pg_temp.eq(1), pg_temp.eq(2)), (pg_temp.eq(2), pg_temp.eq(1))) then pg_temp.eq(1)
                    when (m.team1, m.team2) in ((pg_temp.eq(2), pg_temp.eq(3)), (pg_temp.eq(3), pg_temp.eq(2))) then pg_temp.eq(2)
                    else pg_temp.eq(3) end,
      maps = '[{"map":"x","r1":16,"r2":10}]' where id = m.id;
  end loop;
  -- Las rondas tienen que reflejar al ganador.
  perform set_config('v34.engine', '1', true);
  update public.matches set maps = case when winner = team1 then '[{"map":"x","r1":16,"r2":10}]'::jsonb else '[{"map":"x","r1":10,"r2":16}]'::jsonb end where event_id = ev;
  perform set_config('v34.engine', '', true);
  perform public.event_progress(ev);
  assert (select tie_pending from public.events where id = ev) = '{"grp":1}', format('empate pendiente: %s', (select tie_pending from public.events where id = ev));
  assert not exists (select 1 from public.matches where event_id = ev and stage = 'ko'), 'no tenía que armar playoffs';
end $$;
select public.event_resolve_tie('ffffffff-1000-4000-8000-000000000005', 1, array[pg_temp.eq(3), pg_temp.eq(1), pg_temp.eq(2)]);
do $$
begin
  assert (select tie_pending from public.events where id = 'ffffffff-1000-4000-8000-000000000005') is null, 'empate resuelto';
  -- Con un solo clasificado, ese equipo es campeón directo por bye.
  assert (select champion from public.events where id = 'ffffffff-1000-4000-8000-000000000005') = pg_temp.eq(3), 'clasificado según el organizador';
end $$;

-- ---------- suizo: 2 fases de 8 (2 victorias), 4 equipos entran directo en la fase 2 ----------
insert into public.events(id, name, template, config) values ('ffffffff-1000-4000-8000-000000000006', 'Suizo', 'swiss', '{"stages":2,"size":8,"wins":2}');
select pg_temp.inscribir('ffffffff-1000-4000-8000-000000000006', 12);
select pg_temp.falla($q$select public.event_generate('ffffffff-1000-4000-8000-000000000006')$q$, 'La fase 1 necesita 8 equipos que empiecen en ella (hay 12)');
update public.tournament_registrations set start_stage = 2 where event_id = 'ffffffff-1000-4000-8000-000000000006' and team_id in (pg_temp.eq(1), pg_temp.eq(2), pg_temp.eq(3), pg_temp.eq(4));
select public.event_generate('ffffffff-1000-4000-8000-000000000006');
do $$
declare ev uuid := 'ffffffff-1000-4000-8000-000000000006'; r record;
begin
  assert (select count(*) from public.matches where event_id = ev and stage = 'swiss' and phase = 1 and round = 1) = 4, 'ronda 1';
  -- Primera ronda por siembra: E05 contra E09 (1 contra 5 entre los 8 de la fase 1).
  assert exists (select 1 from public.matches where event_id = ev and round = 1 and team1 = pg_temp.eq(5) and team2 = pg_temp.eq(9)), 'siembra de la ronda 1';
  perform pg_temp.jugar(ev, 4);
  -- Ronda 2: 1-0 contra 1-0 y 0-1 contra 0-1, armada sola.
  for r in select m.team1, m.team2 from public.matches m where m.event_id = ev and m.phase = 1 and m.round = 2 loop
    assert (select wins from public.event_swiss_standings where event_id = ev and phase = 1 and team_id = r.team1)
         = (select wins from public.event_swiss_standings where event_id = ev and phase = 1 and team_id = r.team2), 'mismo récord';
  end loop;
  -- Las partidas que deciden (alguien a una victoria o derrota del final) van al BO3.
  assert (select bool_and(best_of = 3) from public.matches where event_id = ev and phase = 1 and round = 2), 'BO3 decisivas';
  perform pg_temp.jugar(ev);
  assert (select count(*) from public.event_stage_teams where event_id = ev and stage = 'swiss' and phase = 2) = 8, 'fase 2 con 4 directos y 4 clasificados';
  assert (select count(*) from public.event_swiss_standings where event_id = ev and phase = 1 and state = 'qualified') = 4, 'clasificados de la fase 1';
  assert (select count(*) from public.event_swiss_standings where event_id = ev and phase = 2 and state = 'qualified') = 4, 'clasificados de la fase 2';
  assert (select count(*) from public.matches where event_id = ev and stage = 'ko' and phase = 3) = 3, 'playoffs de 4';
  assert (select champion from public.events where id = ev) = pg_temp.eq(1), 'campeón del suizo';
  -- Nadie repitió rival dentro de una fase.
  assert not exists (select 1 from public.matches a join public.matches b on a.event_id = b.event_id and a.phase = b.phase and a.id < b.id
                      and least(a.team1, a.team2) = least(b.team1, b.team2) and greatest(a.team1, a.team2) = greatest(b.team1, b.team2)
                     where a.event_id = ev and a.stage = 'swiss' and b.stage = 'swiss'), 'rival repetido';
end $$;

-- Suizo grande: 16 equipos, 3 victorias, 1 fase → 8 a playoffs.
insert into public.events(id, name, template, config) values ('ffffffff-1000-4000-8000-000000000007', 'Major', 'swiss', '{"stages":1,"size":16,"wins":3}');
select pg_temp.inscribir('ffffffff-1000-4000-8000-000000000007', 16);
select public.event_generate('ffffffff-1000-4000-8000-000000000007');
do $$
declare ev uuid := 'ffffffff-1000-4000-8000-000000000007';
begin
  perform pg_temp.jugar(ev);
  assert (select count(*) from public.matches where event_id = ev and stage = 'swiss') = 33, format('partidas del suizo de 16: %s', (select count(*) from public.matches where event_id = ev and stage = 'swiss'));
  assert (select max(round) from public.matches where event_id = ev and stage = 'swiss') = 5, 'rondas';
  assert (select count(*) from public.matches where event_id = ev and stage = 'ko') = 7, 'playoffs de 8';
  assert (select status from public.events where id = ev) = 'finished', 'terminado';
end $$;

-- ---------- reiniciar, borrar y W.O. ----------
insert into public.events(id, name, template) values ('ffffffff-1000-4000-8000-000000000008', 'WO', 'single');
select pg_temp.inscribir('ffffffff-1000-4000-8000-000000000008', 2, 20);
select public.event_generate('ffffffff-1000-4000-8000-000000000008');
select public.event_reset('ffffffff-1000-4000-8000-000000000008');
select public.event_generate('ffffffff-1000-4000-8000-000000000008');
set local role authenticated;
select pg_temp.como('aaaaaaaa-1000-4000-8000-0000000000ad');
select public.event_set_result((select id from public.matches where event_id = 'ffffffff-1000-4000-8000-000000000008'), null, pg_temp.eq(21));
reset role;
do $$
begin
  assert (select (status, champion) = ('finished'::text, pg_temp.eq(21)) from public.events where id = 'ffffffff-1000-4000-8000-000000000008'), 'W.O.';
  assert (select official_played from public.team_standings where team_id = pg_temp.eq(21)) = 0, 'el W.O. no suma al ranking';
end $$;
select pg_temp.falla($q$select public.event_reset('ffffffff-1000-4000-8000-000000000008')$q$, 'Ya se jugaron partidas%');
select pg_temp.falla($q$delete from public.events where id = 'ffffffff-1000-4000-8000-000000000002'$q$, 'Single tiene partidas jugadas%');
update public.events set status = 'cancelled' where id = 'ffffffff-1000-4000-8000-000000000001';

-- ---------- !match: inscritos, mínimo del torneo y código oculto ----------
insert into public.game_servers(id, name, token_hash, active) values ('cccccccc-1000-4000-8000-000000000001', 'srv10', 'x', true);
insert into public.events(id, name, template, players_min, players_max) values ('ffffffff-1000-4000-8000-000000000009', 'Lookup', 'single', 4, 5);
insert into public.tournament_registrations(event_id, team_id) values ('ffffffff-1000-4000-8000-000000000009', pg_temp.eq(30)), ('ffffffff-1000-4000-8000-000000000009', pg_temp.eq(31));
insert into public.tournament_registration_players(event_id, team_id, player_id)
  select 'ffffffff-1000-4000-8000-000000000009', pg_temp.eq(e), pg_temp.pl(e, j) from (values (30), (31)) v(e), generate_series(1, 4) j;
select public.event_generate('ffffffff-1000-4000-8000-000000000009');
do $$
declare m record; out text;
begin
  select * into m from public.matches where event_id = 'ffffffff-1000-4000-8000-000000000009';
  out := public.csstv_match_lookup('x', m.link_code);
  -- csstv_auth falla con un token inventado: probamos la parte de inscritos con match_roster.
  assert (select count(*) from public.match_roster(m.id, pg_temp.eq(30))) = 4, 'inscritos, no el plantel de 6';
end $$;
set local role anon;
select pg_temp.como(null);
select pg_temp.falla('select link_code from public.matches limit 1', '%permission denied%');
do $$ begin assert (select count(*) from public.matches where event_id = 'ffffffff-1000-4000-8000-000000000009') = 1, 'el resto de columnas se ve'; end $$;
reset role;
set local role authenticated;
select pg_temp.como('aaaaaaaa-1000-4000-8000-000000000005');
do $$ begin assert public.match_link_code((select id from public.matches where event_id = 'ffffffff-1000-4000-8000-000000000009')) is null, 'un extraño ve el código'; end $$;
select pg_temp.como('aaaaaaaa-1000-4000-8000-0000000000ad');
do $$ begin assert public.match_link_code((select id from public.matches where event_id = 'ffffffff-1000-4000-8000-000000000009')) ~ '^[A-Z2-9]{5}$', 'el admin no ve el código'; end $$;
select public.match_schedule((select id from public.matches where event_id = 'ffffffff-1000-4000-8000-000000000009'), now() + interval '1 day', 'cccccccc-1000-4000-8000-000000000001');
reset role;

-- ---------- serie de torneo jugada con !match (ingesta real) ----------
insert into public.game_servers(id, name, token_hash) values ('cccccccc-1000-4000-8000-000000000010', 'srv 10', encode(sha256(convert_to('tok10', 'UTF8')), 'hex'));
insert into public.events(id, name, template, config) values ('ffffffff-1000-4000-8000-00000000000b', 'Serie', 'single', '{"bo_final":3}');
select pg_temp.inscribir('ffffffff-1000-4000-8000-00000000000b', 2, 25);
select public.event_generate('ffffffff-1000-4000-8000-00000000000b');
create function pg_temp.j(eq int, n int) returns jsonb language sql as $$
  select jsonb_build_object('name', 'E' || eq || 'p' || n, 'steamid', '7656119800' || lpad((eq * 10 + n)::text, 7, '0')) $$;
create function pg_temp.juego(uid text, a jsonb, b jsonb, sa int, sb int, code text) returns uuid language plpgsql as $$
declare jug jsonb := '[]'; x jsonb;
begin
  -- Cada ingesta real es su propia transacción: no hereda la marca del motor.
  perform set_config('v34.engine', '', true);
  for x in select value from jsonb_array_elements(a) loop jug := jug || jsonb_build_array(x || '{"team":"a","rounds":20,"kills":10}'); end loop;
  for x in select value from jsonb_array_elements(b) loop jug := jug || jsonb_build_array(x || '{"team":"b","rounds":20,"kills":10}'); end loop;
  return public.csstv_ingest('cccccccc-1000-4000-8000-000000000010', jsonb_build_object(
    'schema', '1', 'match_uid', uid, 'status', 'finished', 'map', 'de_nuke', 'score', jsonb_build_object('a', sa, 'b', sb),
    'players', jug, 'link_code', code, 'link_side_a', '1'));
end $$;
do $$
declare
  ev uuid := 'ffffffff-1000-4000-8000-00000000000b';
  m public.matches;
  t text;
  e25 jsonb := jsonb_build_array(pg_temp.j(25,1), pg_temp.j(25,2), pg_temp.j(25,3), pg_temp.j(25,4), pg_temp.j(25,5));
  e26 jsonb := jsonb_build_array(pg_temp.j(26,1), pg_temp.j(26,2), pg_temp.j(26,3), pg_temp.j(26,4), pg_temp.j(26,5));
  e26mal jsonb := jsonb_build_array(pg_temp.j(26,1), pg_temp.j(26,2), pg_temp.j(26,3), pg_temp.j(26,4), pg_temp.j(26,6));
begin
  select * into m from public.matches where event_id = ev;
  -- El lookup manda solo los 5 inscritos de cada equipo (el plantel tiene 6) y el mínimo del torneo.
  t := public.csstv_match_lookup('tok10', m.link_code);
  assert t like '%min_roster=5%', t;
  assert cardinality(string_to_array(split_part(split_part(t, 't1=', 2), E'
', 1), ',')) = 5, t;
  -- Con un no inscrito (el 6.º del plantel de E26) queda como mix.
  perform pg_temp.juego('juego10x', e25, e26mal, 16, 10, m.link_code);
  assert (select status from public.matches where id = m.id) = 'upcoming', 'vinculó con un no inscrito';
  perform pg_temp.juego('juego10a', e25, e26, 16, 10, m.link_code);
  assert (select (status, score1, score2) = ('live'::text, 1, 0) from public.matches where id = m.id), 'serie 1-0';
  perform pg_temp.juego('juego10b', e25, e26, 16, 8, m.link_code);
  assert (select (status, winner) = ('finished'::text, pg_temp.eq(25)) from public.matches where id = m.id), 'serie ganada';
  assert (select (status, champion) = ('finished'::text, pg_temp.eq(25)) from public.events where id = ev), 'el torneo avanzó solo con !match';
end $$;

-- ---------- veto ----------
insert into public.events(id, name, template, config) values ('ffffffff-1000-4000-8000-00000000000a', 'Veto', 'single', '{"bo":3,"bo_final":3}');
select pg_temp.inscribir('ffffffff-1000-4000-8000-00000000000a', 2, 1);
select public.event_generate('ffffffff-1000-4000-8000-00000000000a');
create temp table vm as select id from public.matches where event_id = 'ffffffff-1000-4000-8000-00000000000a';
grant select on vm to authenticated;
do $$ begin assert public.veto_sequence(3, 8) = '{ban,ban,pick,pick,ban,ban,ban}', 'secuencia BO3'; assert public.veto_sequence(1, 8) = '{ban,ban,ban,ban,ban,ban,ban}', 'BO1'; end $$;
set local role authenticated;
select pg_temp.como('aaaaaaaa-1000-4000-8000-000000000004');
select pg_temp.falla($q$select public.veto_act((select id from vm), 'de_cache')$q$, 'Es el turno del capitán de E01');
select pg_temp.como('aaaaaaaa-1000-4000-8000-000000000003');
select pg_temp.falla($q$select public.veto_act((select id from vm), 'de_train')$q$, 'Ese mapa no está en el pool');
select public.veto_act((select id from vm), 'de_cache');
select pg_temp.como('aaaaaaaa-1000-4000-8000-000000000004');
select pg_temp.falla($q$select public.veto_act((select id from vm), 'de_cache')$q$, 'Ese mapa ya se vetó o se eligió');
select public.veto_act((select id from vm), 'de_tuscan');
select pg_temp.como('aaaaaaaa-1000-4000-8000-000000000003');
select pg_temp.falla($q$select public.veto_act((select id from vm), 'de_inferno')$q$, 'Elegí la versión del mapa: de_inferno o de_inferno_classic');
select public.veto_act((select id from vm), 'de_inferno', 'de_inferno_classic');
select pg_temp.falla($q$insert into public.match_vetos(match_id, seq, team_id, map, action, by_user) select id, 9, null, 'x', 'ban', auth.uid() from vm$q$, '%row-level security%');
select pg_temp.como('aaaaaaaa-1000-4000-8000-000000000004');
select pg_temp.falla($q$select public.veto_reset((select id from vm))$q$, 'Solo el organizador%');
reset role;
do $$ begin assert (select (action, version) = ('pick'::text, 'de_inferno_classic'::text) from public.match_vetos where map = 'de_inferno'), 'pick con versión'; end $$;

-- ---------- chat ----------
set local role authenticated;
select pg_temp.como('aaaaaaaa-1000-4000-8000-000000000005');
select pg_temp.falla($q$insert into public.match_chat(match_id, user_id, message) select id, auth.uid(), 'hola' from vm$q$, '%row-level security%');
select pg_temp.como('aaaaaaaa-1000-4000-8000-000000000003');
insert into public.match_chat(match_id, user_id, message) select id, auth.uid(), 'gl hf' from vm;
reset role;
set local role anon;
select pg_temp.como(null);
do $$ begin assert (select alias from public.match_chat_public where message = 'gl hf') = 'Cap10', 'alias en el chat'; end $$;
reset role;

-- ---------- PCW como equipo, vencimiento y resultado del admin ----------
set local role authenticated;
select pg_temp.como('aaaaaaaa-1000-4000-8000-000000000003');
select pg_temp.falla(format('select public.create_pcw_post(%L, 1, null, now(), null, %L, %L, %L)', 'X', array[pg_temp.pl(1,1), pg_temp.pl(1,2), pg_temp.pl(1,3), pg_temp.pl(1,4)], '{}', pg_temp.eq(2)), 'Solo el capitán o el dueño%');
select public.create_pcw_post('Como E01', 1, null, now() - interval '3 days', null, array[pg_temp.pl(1,1), pg_temp.pl(1,2), pg_temp.pl(1,3), pg_temp.pl(1,4)], '{}', pg_temp.eq(1));
select pg_temp.como('aaaaaaaa-1000-4000-8000-000000000004');
select public.accept_pcw((select id from public.pcw_posts where by_user = 'aaaaaaaa-1000-4000-8000-000000000003'), 'Rival',
  array[pg_temp.pl(2,1), pg_temp.pl(2,2), pg_temp.pl(2,3), pg_temp.pl(2,4)], '{}');
reset role;
do $$
declare mid uuid := (select match_id from public.pcw_posts where by_user = 'aaaaaaaa-1000-4000-8000-000000000003');
begin
  assert (select parent_team_id from public.teams where id = (select team1 from public.matches where id = mid)) = pg_temp.eq(1), 'bando como E01';
  perform public.pcw_cleanup();
  assert not exists (select 1 from public.matches where id = mid), 'la PCW vencida no se canceló';
  -- Como cancel_pcw_match: se borran los bandos y con ellos el anuncio.
  assert not exists (select 1 from public.pcw_posts where by_user = 'aaaaaaaa-1000-4000-8000-000000000003'), 'el anuncio de la PCW vencida sigue';
end $$;
set local role authenticated;
select pg_temp.como('aaaaaaaa-1000-4000-8000-000000000003');
select public.create_pcw_post('Otra', 1, null, now(), null, array[pg_temp.pl(1,1), pg_temp.pl(1,2), pg_temp.pl(1,3), pg_temp.pl(1,4)], '{}');
select pg_temp.como('aaaaaaaa-1000-4000-8000-000000000004');
select public.accept_pcw((select id from public.pcw_posts where by_user = 'aaaaaaaa-1000-4000-8000-000000000003' and status = 'open'), 'Rival2',
  array[pg_temp.pl(2,1), pg_temp.pl(2,2), pg_temp.pl(2,3), pg_temp.pl(2,4)], '{}');
select pg_temp.falla(format('select public.pcw_set_result(%L, %L)', (select match_id from public.pcw_posts where by_user = 'aaaaaaaa-1000-4000-8000-000000000003' and status = 'matched'), '[{"r1":16,"r2":3}]'), 'Solo un admin%');
select pg_temp.como('aaaaaaaa-1000-4000-8000-0000000000ad');
select public.pcw_set_result((select match_id from public.pcw_posts where by_user = 'aaaaaaaa-1000-4000-8000-000000000003' and status = 'matched'), '[{"map":"de_cbble","r1":16,"r2":3}]');
reset role;
do $$
begin
  assert (select status from public.matches where id = (select match_id from public.pcw_posts where by_user = 'aaaaaaaa-1000-4000-8000-000000000003' and status = 'matched')) = 'finished', 'resultado de la PCW';
  assert to_regclass('public.result_reports') is null, 'result_reports sigue';
  raise notice '10: organizadores, plantillas (single, double, groups, swiss), avance, W.O., veto, chat, código oculto y PCW OK';
end $$;

rollback;

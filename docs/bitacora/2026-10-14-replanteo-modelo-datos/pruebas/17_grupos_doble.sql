-- Pruebas de supabase/replanteo/17_grupos_doble.sql (correr con la migración aplicada). Todo con rollback.
-- Reproduce el ejemplo del diagrama del plan (docs/bitacora/2026-10-18-torneo-grupos-doble): mismos grupos, cruces y resultados.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
grant execute on function pg_temp.ok(boolean, text) to anon, authenticated;
create function pg_temp.falla(q text, patron text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'NO FALLÓ: %', q;
exception when others then
  if sqlerrm like 'NO FALLÓ%' or sqlerrm not like patron then
    raise exception 'falla(%): se esperaba "%", vino "%"', q, patron, sqlerrm;
  end if;
  raise notice 'OK: falla como se espera (%)', sqlerrm;
end $$;
grant execute on function pg_temp.falla(text, text) to anon, authenticated;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '{"role":"anon"}'
         else format('{"sub":"%s","role":"authenticated"}', u) end, true) $$;
grant execute on function pg_temp.como(text) to anon, authenticated;

-- 12 equipos con 5 jugadores con SteamID cada uno.
create temp table eqs as
  select i, ('eeeeeeee-1700-4000-8000-' || lpad(i::text, 12, '0'))::uuid as id, n as name
    from unnest(array['NAVI', 'MOUZ', 'Spirit', 'FaZe', 'Vitality', 'FURIA', 'Liquid', 'Astralis', 'G2', 'Complexity', 'ENCE', 'Heroic'])
         with ordinality as t(n, i);
grant select on eqs to anon, authenticated;
insert into public.teams(id, name, tag, kind) select id, name || ' 17', left(name, 3) || '17', 'official' from eqs;
insert into public.players(id, nick, steam_id)
  select ('dddddddd-1700-4000-8000-' || lpad((e.i * 10 + j)::text, 12, '0'))::uuid, e.name || '17p' || j,
         '7656119817' || lpad((e.i * 10 + j)::text, 7, '0')
    from eqs e, generate_series(1, 5) j;
insert into public.team_members(team_id, player_id, joined_at)
  select e.id, ('dddddddd-1700-4000-8000-' || lpad((e.i * 10 + j)::text, 12, '0'))::uuid, now() from eqs e, generate_series(1, 5) j;
create function pg_temp.eq(n text) returns uuid language sql as $$ select id from eqs where name = n $$;
grant execute on function pg_temp.eq(text) to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-1700-4000-8000-000000000001', 'org17@test.local', '{"tag":"Org17"}'),
  ('aaaaaaaa-1700-4000-8000-000000000002', 'nadie17@test.local', '{"tag":"Nadie17"}');
update public.profiles set role = 'organizer' where id = 'aaaaaaaa-1700-4000-8000-000000000001';

create function pg_temp.inscribir(ev uuid, nombres text[]) returns void language sql as $$
  insert into public.tournament_registrations(event_id, team_id) select ev, pg_temp.eq(n) from unnest(nombres) n;
  insert into public.tournament_registration_players(event_id, team_id, player_id)
    select ev, e.id, ('dddddddd-1700-4000-8000-' || lpad((e.i * 10 + j)::text, 12, '0'))::uuid
      from eqs e, generate_series(1, 5) j where e.name = any(nombres);
$$;

-- Juega todo lo jugable de las etapas pedidas: gana el que aparece antes en "orden", 2-0 (o 3-0) con 16-10.
create function pg_temp.jugar(ev uuid, etapas text[], orden text[]) returns int language plpgsql as $$
declare m record; n int := 0; p1 int; p2 int; gana1 boolean; w int; mapas jsonb;
begin
  loop
    perform set_config('v34.engine', '', true);
    select * into m from public.matches where event_id = ev and stage = any(etapas) and status = 'upcoming'
       and team1 is not null and team2 is not null order by phase, stage, round, pos limit 1;
    exit when not found;
    p1 := array_position(orden, (select name from eqs where id = m.team1));
    p2 := array_position(orden, (select name from eqs where id = m.team2));
    gana1 := p1 < p2;
    w := m.best_of / 2 + 1;
    select jsonb_agg(case when gana1 then '{"map":"de_dust2_ob","r1":16,"r2":10}'::jsonb else '{"map":"de_dust2_ob","r1":10,"r2":16}'::jsonb end)
      into mapas from generate_series(1, w);
    update public.matches set status = 'finished', winner = case when gana1 then team1 else team2 end, maps = mapas,
      score1 = case when gana1 then w else 0 end, score2 = case when gana1 then 0 else w end
     where id = m.id;
    n := n + 1;
  end loop;
  return n;
end $$;

create function pg_temp.vs(ev uuid, etapa text, g int, r int, p int) returns text language sql as $$
  select coalesce((select name from eqs where id = m.team1), '-') || ' vs ' || coalesce((select name from eqs where id = m.team2), '-')
    from public.matches m where m.event_id = ev and m.stage = etapa and coalesce(m.grp, 0) = coalesce(g, 0) and m.round = r and m.pos = p
$$;

-- ---------- configuración por defecto y validaciones ----------
select pg_temp.como('aaaaaaaa-1700-4000-8000-000000000001');
insert into public.events(id, name, template) values ('ffffffff-1700-4000-8000-000000000001', 'Copa 17', 'groups_double');
do $$
declare c jsonb := (select config from public.events where id = 'ffffffff-1700-4000-8000-000000000001');
begin
  perform pg_temp.ok(c->>'groups' = '2' and c->>'advance' = '3' and c->>'bo_group' = '3', 'por defecto: 2 grupos, clasifican 3, grupos BO3');
  perform pg_temp.ok(c #>> '{playoffs,bo}' = '3' and c #>> '{playoffs,bo_semi}' = '3' and c #>> '{playoffs,bo_final}' = '5'
                     and c #>> '{playoffs,third_place}' = 'false', 'por defecto: playoffs BO3 y final BO5, sin 3.er puesto');
end $$;
select pg_temp.falla($q$insert into public.events(name, template, config) values ('X', 'groups_double', '{"advance": 1}')$q$, '%clasifican 2 o 3%');
select pg_temp.falla($q$insert into public.events(name, template, config) values ('X', 'groups_double', '{"groups": 9}')$q$, '%entre 1 y 8%');
select pg_temp.falla($q$insert into public.events(name, template, config) values ('X', 'groups_double', '{"bo_group": 2}')$q$, '%BO1, BO3 o BO5%');

reset role;
select pg_temp.inscribir('ffffffff-1700-4000-8000-000000000001',
  array['NAVI', 'MOUZ', 'Spirit', 'FaZe', 'Vitality', 'FURIA', 'Liquid', 'Astralis', 'G2', 'Complexity', 'ENCE', 'Heroic']);

-- ---------- sorteo ----------
set local role authenticated;
select pg_temp.como('aaaaaaaa-1700-4000-8000-000000000002');
select pg_temp.falla($q$select public.event_draw('ffffffff-1700-4000-8000-000000000001')$q$, 'Solo el organizador%');
select pg_temp.como('aaaaaaaa-1700-4000-8000-000000000001');
do $$
declare s uuid[] := public.event_draw('ffffffff-1700-4000-8000-000000000001');
begin
  perform pg_temp.ok(cardinality(s) = 12 and (select array_agg(x order by x) from unnest(s) x) = (select array_agg(id order by id) from eqs),
                     'el sorteo trae los 12 inscritos, sin repetir');
  perform pg_temp.ok((select drawn_at is not null and drawn_by = 'aaaaaaaa-1700-4000-8000-000000000001' and seeds = s
                        from public.events where id = 'ffffffff-1700-4000-8000-000000000001'), 'queda registrado quién y cuándo sorteó');
end $$;
-- Nadie puede marcar el sorteo a mano.
update public.events set drawn_at = '2020-01-01' where id = 'ffffffff-1700-4000-8000-000000000001';
do $$ begin
  perform pg_temp.ok((select drawn_at > '2025-01-01' from public.events where id = 'ffffffff-1700-4000-8000-000000000001'), 'drawn_at no se cambia a mano');
end $$;
-- Siembra a mano (la del ejemplo): se borra la marca del sorteo.
update public.events set seeds = array(select pg_temp.eq(n) from unnest(array['NAVI', 'MOUZ', 'Spirit', 'FaZe', 'Vitality', 'FURIA', 'Liquid',
                                         'Astralis', 'G2', 'Complexity', 'ENCE', 'Heroic']) n)
 where id = 'ffffffff-1700-4000-8000-000000000001';
do $$ begin
  perform pg_temp.ok((select drawn_at is null and drawn_by is null from public.events where id = 'ffffffff-1700-4000-8000-000000000001'),
                     'cambiar la siembra a mano borra la marca del sorteo');
end $$;

-- ---------- fixture ----------
select public.event_generate('ffffffff-1700-4000-8000-000000000001');
reset role;
do $$
declare ev uuid := 'ffffffff-1700-4000-8000-000000000001';
begin
  perform pg_temp.ok((select array_agg(e.name order by st.seed) from public.event_stage_teams st join eqs e on e.id = st.team_id
                       where st.event_id = ev and st.stage = 'group_double' and st.grp = 1) = array['NAVI', 'FaZe', 'Vitality', 'Astralis', 'G2', 'Heroic'],
                     'Grupo A: NAVI, FaZe, Vitality, Astralis, G2 y Heroic (S1 a S6)');
  perform pg_temp.ok((select array_agg(e.name order by st.seed) from public.event_stage_teams st join eqs e on e.id = st.team_id
                       where st.event_id = ev and st.stage = 'group_double' and st.grp = 2) = array['MOUZ', 'Spirit', 'FURIA', 'Liquid', 'Complexity', 'ENCE'],
                     'Grupo B: MOUZ, Spirit, FURIA, Liquid, Complexity y ENCE (S1 a S6)');
  perform pg_temp.ok((select count(*) from public.matches where event_id = ev and stage in ('group_upper', 'group_lower')) = 26
                     and (select count(*) from public.matches where event_id = ev and stage = 'group_upper' and bye) = 4
                     and (select count(*) filter (where best_of = 3) = count(*) from public.matches where event_id = ev and stage like 'group_%'),
                     'cada grupo: 7 del upper y 6 del lower, todo BO3; los 2 libres del upper ya resueltos');
  perform pg_temp.ok(pg_temp.vs(ev, 'group_upper', 1, 1, 2) = 'Astralis vs G2' and pg_temp.vs(ev, 'group_upper', 1, 1, 4) = 'Vitality vs Heroic',
                     'ronda 1 del Grupo A: Astralis vs G2 y Vitality vs Heroic');
  perform pg_temp.ok(pg_temp.vs(ev, 'group_upper', 1, 2, 1) = 'NAVI vs -' and pg_temp.vs(ev, 'group_upper', 1, 2, 2) = 'FaZe vs -',
                     'NAVI y FaZe pasan libres a la ronda 2');
  perform pg_temp.ok((select stage_order from public.match_list where event_id = ev and stage = 'group_lower' limit 1) = 0, 'match_list ordena los grupos primero');
end $$;

-- ---------- grupos ----------
do $$
declare ev uuid := 'ffffffff-1700-4000-8000-000000000001'; n int; r record;
begin
  n := pg_temp.jugar(ev, array['group_upper', 'group_lower'],
                     array['NAVI', 'Vitality', 'FaZe', 'G2', 'Astralis', 'Heroic', 'Spirit', 'MOUZ', 'Liquid', 'ENCE', 'FURIA', 'Complexity']);
  perform pg_temp.ok(n = 18, '9 series por grupo (18 en total)');
  perform pg_temp.ok((select count(*) from public.matches where event_id = ev and stage in ('group_upper', 'group_lower') and bye) = 8,
                     'los libres del lower se resuelven al bajar los perdedores (4 por grupo en total)');
  perform pg_temp.ok(pg_temp.vs(ev, 'group_upper', 1, 2, 1) = 'NAVI vs G2' and pg_temp.vs(ev, 'group_upper', 1, 2, 2) = 'FaZe vs Vitality', 'upper ronda 2 del Grupo A');
  perform pg_temp.ok(pg_temp.vs(ev, 'group_lower', 1, 2, 2) = 'Heroic vs G2' and pg_temp.vs(ev, 'group_lower', 1, 2, 1) = 'Astralis vs FaZe',
                     'al bajar se cruzan: Heroic vs G2 y Astralis vs FaZe');
  perform pg_temp.ok(pg_temp.vs(ev, 'group_lower', 1, 3, 1) = 'FaZe vs G2' and pg_temp.vs(ev, 'group_lower', 1, 4, 1) = 'FaZe vs Vitality'
                     and pg_temp.vs(ev, 'group_upper', 1, 3, 1) = 'NAVI vs Vitality', 'semi y final del lower, final del upper');
  perform pg_temp.ok((select array_agg(e.name || ':' || s.place || ':' || s.state order by s.place, e.name)
                        from public.event_group_double_standings s join eqs e on e.id = s.team_id where s.event_id = ev and s.grp = 1)
                     = array['NAVI:1:qualified', 'Vitality:2:qualified', 'FaZe:3:qualified', 'G2:4:eliminated', 'Astralis:5:eliminated', 'Heroic:5:eliminated'],
                     'tabla del Grupo A: NAVI, Vitality y FaZe clasifican; G2 4.º; Astralis y Heroic 5.º');
  perform pg_temp.ok((select array_agg(e.name || ':' || s.place || ':' || s.state order by s.place, e.name)
                        from public.event_group_double_standings s join eqs e on e.id = s.team_id where s.event_id = ev and s.grp = 2)
                     = array['Spirit:1:qualified', 'MOUZ:2:qualified', 'Liquid:3:qualified', 'ENCE:4:eliminated', 'Complexity:5:eliminated', 'FURIA:5:eliminated'],
                     'tabla del Grupo B: Spirit, MOUZ y Liquid clasifican');
  select * into r from public.event_standings where event_id = ev and stage = 'group_double' and team_id = pg_temp.eq('NAVI');
  perform pg_temp.ok(r.place = 1 and r.won = 2 and r.lost = 0 and r.played = 2 and r.rounds_diff = 24 and r.state = 'qualified', 'event_standings con group_double');
  perform pg_temp.ok(not exists (select 1 from public.event_standings where event_id = ev and stage = 'group'), 'no aparecen en la tabla de los grupos comunes');
end $$;

-- ---------- playoffs ----------
do $$
declare ev uuid := 'ffffffff-1700-4000-8000-000000000001'; n int;
begin
  perform pg_temp.ok((select count(*) from public.matches where event_id = ev and stage = 'ko') = 7, 'playoffs armados (llave de 8 con 2 libres)');
  perform pg_temp.ok(pg_temp.vs(ev, 'ko', null, 1, 2) = 'MOUZ vs FaZe' and pg_temp.vs(ev, 'ko', null, 1, 4) = 'Vitality vs Liquid',
                     'cuartos: 2.º B vs 3.º A y 2.º A vs 3.º B');
  perform pg_temp.ok(pg_temp.vs(ev, 'ko', null, 2, 1) = 'NAVI vs -' and pg_temp.vs(ev, 'ko', null, 2, 2) = 'Spirit vs -',
                     'los 1.º esperan en semifinales: NAVI al ganador de MOUZ-FaZe, Spirit al de Vitality-Liquid');
  perform pg_temp.ok((select array_agg(best_of order by round) from (select distinct round, best_of from public.matches where event_id = ev and stage = 'ko') x)
                     = array[3, 3, 5], 'cuartos y semis BO3, final BO5');
  n := pg_temp.jugar(ev, array['ko'], array['Vitality', 'NAVI', 'Spirit', 'MOUZ', 'Liquid', 'FaZe']);
  perform pg_temp.ok(n = 5, '5 series de playoffs');
  perform pg_temp.ok(pg_temp.vs(ev, 'ko', null, 3, 1) = 'NAVI vs Vitality', 'final: NAVI vs Vitality');
  perform pg_temp.ok((select status = 'finished' and champion = pg_temp.eq('Vitality') from public.events where id = ev), 'campeón: Vitality');
end $$;

-- ---------- grupos de 4 (8 equipos) y tamaños ----------
set local role authenticated;
select pg_temp.como('aaaaaaaa-1700-4000-8000-000000000001');
insert into public.events(id, name, template, config) values ('ffffffff-1700-4000-8000-000000000002', 'Copa 17 chica', 'groups_double', '{"advance": 2}');
insert into public.events(id, name, template) values ('ffffffff-1700-4000-8000-000000000003', 'Copa 17 corta', 'groups_double');
reset role;
select pg_temp.inscribir('ffffffff-1700-4000-8000-000000000002', array['NAVI', 'MOUZ', 'Spirit', 'FaZe', 'Vitality', 'FURIA', 'Liquid', 'Astralis']);
select pg_temp.inscribir('ffffffff-1700-4000-8000-000000000003', array['NAVI', 'MOUZ', 'Spirit', 'FaZe', 'Vitality', 'FURIA', 'Liquid']);
set local role authenticated;
select pg_temp.falla($q$select public.event_generate('ffffffff-1700-4000-8000-000000000003')$q$, '%entre 8 y 16 equipos%');
select public.event_generate('ffffffff-1700-4000-8000-000000000002');
reset role;
do $$
declare ev uuid := 'ffffffff-1700-4000-8000-000000000002'; n int;
begin
  perform pg_temp.ok((select count(*) from public.matches where event_id = ev and stage = 'group_upper') = 6
                     and (select count(*) from public.matches where event_id = ev and stage = 'group_lower') = 4
                     and not exists (select 1 from public.matches where event_id = ev and bye), 'grupos de 4: 3 del upper y 2 del lower por grupo, sin libres');
  n := pg_temp.jugar(ev, array['group_upper', 'group_lower'], array['NAVI', 'MOUZ', 'Spirit', 'FaZe', 'Vitality', 'FURIA', 'Liquid', 'Astralis']);
  perform pg_temp.ok(n = 10, '5 series por grupo de 4');
  perform pg_temp.ok((select count(*) from public.event_group_double_standings where event_id = ev and state = 'qualified') = 4
                     and (select count(*) from public.matches where event_id = ev and stage = 'ko' and round = 1) = 2, 'clasifican 2 por grupo: semifinales directas');
  n := pg_temp.jugar(ev, array['ko'], array['NAVI', 'MOUZ', 'Spirit', 'FaZe', 'Vitality', 'FURIA', 'Liquid', 'Astralis']);
  perform pg_temp.ok((select champion is not null and status = 'finished' from public.events where id = ev), 'torneo chico terminado con campeón');
end $$;

rollback;

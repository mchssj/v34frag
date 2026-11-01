-- Pruebas de supabase/replanteo/41_admin_torneos.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', u), true) $$;
create function pg_temp.estado(q text) returns text language plpgsql as $$
declare s text;
begin
  execute q;
  return null;
exception when others then
  get stacked diagnostics s = returned_sqlstate;
  return s;
end $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119841' || lpad(n::text, 7, '0') $$;
-- Equipo n de las pruebas (1v1: un jugador con SteamID cada uno).
create function pg_temp.eq(n int) returns uuid language sql immutable as $$ select ('eeeeeeee-4100-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pg_temp.pl(n int) returns uuid language sql immutable as $$ select ('dddddddd-4100-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(text), pg_temp.estado(text), pg_temp.s(int), pg_temp.eq(int), pg_temp.pl(int)
  to authenticated, anon;

-- Cuentas: admin (ad), moderador (mo), organizador dueño (o1) y otro organizador (o2).
insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('aaaaaaaa-4100-4000-8000-0000000000ad', 'admin41@test.local', '{"tag":"Admin41"}', 'x'),
  ('aaaaaaaa-4100-4000-8000-0000000000a0', 'mod41@test.local', '{"tag":"Mod41"}', 'x'),
  ('aaaaaaaa-4100-4000-8000-0000000000a1', 'org41@test.local', '{"tag":"Org41"}', 'x'),
  ('aaaaaaaa-4100-4000-8000-0000000000a2', 'org41b@test.local', '{"tag":"Org41b"}', 'x');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-4100-4000-8000-0000000000ad';
update public.profiles set role = 'moderator' where id = 'aaaaaaaa-4100-4000-8000-0000000000a0';
update public.profiles set role = 'organizer' where id in ('aaaaaaaa-4100-4000-8000-0000000000a1', 'aaaaaaaa-4100-4000-8000-0000000000a2');

insert into public.players(id, nick, steam_id) select pg_temp.pl(i), 'J41_' || i, pg_temp.s(i) from generate_series(1, 16) i;
insert into public.teams(id, name, tag, kind) select pg_temp.eq(i), 'Equipo 41 ' || lpad(i::text, 2, '0'), 'Q' || i, 'official' from generate_series(1, 16) i;
insert into public.team_members(team_id, player_id, joined_at) select pg_temp.eq(i), pg_temp.pl(i), now() from generate_series(1, 16) i;

insert into public.events(id, name, template, game_mode, organizer_id) values
  ('ffffffff-4100-4000-8000-000000000001', 'Permisos 41', 'single', '1v1', 'aaaaaaaa-4100-4000-8000-0000000000a1');

-- ---------- 1. permisos ----------
set local role authenticated;
select pg_temp.como('aaaaaaaa-4100-4000-8000-0000000000a0');
select pg_temp.ok(public.can_manage_event('ffffffff-4100-4000-8000-000000000001'), 'el moderador gestiona cualquier torneo');
select pg_temp.ok(not public.can_own_event('ffffffff-4100-4000-8000-000000000001'), 'pero no es dueño');
select pg_temp.ok(pg_temp.estado($q$update public.events set status = 'cancelled' where id = 'ffffffff-4100-4000-8000-000000000001'$q$) = '42501',
                  'el moderador no cancela');
with d as (delete from public.events where id = 'ffffffff-4100-4000-8000-000000000001' returning 1)
select pg_temp.ok((select count(*) from d) = 0, 'el moderador no borra');
update public.events set name = 'Permisos 41 (editado)' where id = 'ffffffff-4100-4000-8000-000000000001';
select pg_temp.ok((select name from public.events where id = 'ffffffff-4100-4000-8000-000000000001') = 'Permisos 41 (editado)', 'el moderador edita');

select pg_temp.como('aaaaaaaa-4100-4000-8000-0000000000a2');
select pg_temp.ok(not public.can_manage_event('ffffffff-4100-4000-8000-000000000001'), 'otro organizador no gestiona un torneo ajeno');

select pg_temp.como('aaaaaaaa-4100-4000-8000-0000000000a1');
select pg_temp.ok(public.can_manage_event('ffffffff-4100-4000-8000-000000000001') and public.can_own_event('ffffffff-4100-4000-8000-000000000001'),
                  'el organizador dueño gestiona y es dueño');
update public.events set status = 'cancelled' where id = 'ffffffff-4100-4000-8000-000000000001';
select pg_temp.ok((select status from public.events where id = 'ffffffff-4100-4000-8000-000000000001') = 'cancelled', 'el dueño cancela');

-- ---------- 2. siembra y etapas del suizo ----------
-- Suizo de 3 etapas de 8 (8 + 4 + 4 = 16 equipos): 1-4 entran a la etapa 3, 5-8 a la 2 y 9-16 juegan la 1.
reset role;
select set_config('request.jwt.claims', '{}', true);
insert into public.events(id, name, template, game_mode, organizer_id, config) values
  ('ffffffff-4100-4000-8000-000000000002', 'Suizo 41', 'swiss', '1v1', 'aaaaaaaa-4100-4000-8000-0000000000a1', '{"stages":3,"size":8,"wins":2}');
insert into public.tournament_registrations(event_id, team_id, created_at)
  select 'ffffffff-4100-4000-8000-000000000002', pg_temp.eq(i), now() - (20 - i) * interval '1 hour' from generate_series(1, 16) i;
insert into public.tournament_registration_players(event_id, team_id, player_id)
  select 'ffffffff-4100-4000-8000-000000000002', pg_temp.eq(i), pg_temp.pl(i) from generate_series(1, 16) i;
-- ELO: el jugador i tiene 1000 + 10 * i (el 16 es el mejor). El equipo 3 suma 30 puntos por una victoria oficial.
insert into public.player_elo(steam_id, elo, peak_elo, matches) select pg_temp.s(i), 1000 + 10 * i, 1000 + 10 * i, 1 from generate_series(1, 16) i
  on conflict (steam_id) do update set elo = excluded.elo;
insert into public.matches(kind, status, team1, team2, winner, best_of, score1, score2)
  values ('official', 'finished', pg_temp.eq(3), pg_temp.eq(16), pg_temp.eq(3), 1, 1, 0);

set local role authenticated;
select pg_temp.como('aaaaaaaa-4100-4000-8000-0000000000a2');
select pg_temp.ok(pg_temp.estado($q$select public.event_seed_ranking('ffffffff-4100-4000-8000-000000000002')$q$) = '42501', 'otro organizador no siembra');
select pg_temp.como('aaaaaaaa-4100-4000-8000-0000000000a0');
create temp table sem41 as select public.event_seed_ranking('ffffffff-4100-4000-8000-000000000002') as s;
select pg_temp.ok((select s[1] from sem41) = pg_temp.eq(3), 'por ranking: primero el que tiene puntos');
select pg_temp.ok((select s[2] from sem41) = pg_temp.eq(16) and (select s[3] from sem41) = pg_temp.eq(15),
                  'con 0 puntos, por ELO promedio (el 16 perdió pero tiene el mejor ELO)');
select pg_temp.ok((select s[16] from sem41) = pg_temp.eq(1), 'el último: sin puntos y con el ELO más bajo');
select pg_temp.ok((select start_stage from public.tournament_registrations where event_id = 'ffffffff-4100-4000-8000-000000000002' and team_id = (select s[1] from sem41)) = 3,
                  'la siembra 1 entra a la etapa 3');
select pg_temp.ok((select start_stage from public.tournament_registrations where event_id = 'ffffffff-4100-4000-8000-000000000002' and team_id = (select s[5] from sem41)) = 2,
                  'la siembra 5 entra a la etapa 2');
select pg_temp.ok((select start_stage from public.tournament_registrations where event_id = 'ffffffff-4100-4000-8000-000000000002' and team_id = (select s[9] from sem41)) = 1,
                  'la siembra 9 juega la etapa 1');
select pg_temp.ok((select count(*) filter (where start_stage = 3) = 4 and count(*) filter (where start_stage = 2) = 4 and count(*) filter (where start_stage = 1) = 8
                     from public.tournament_registrations where event_id = 'ffffffff-4100-4000-8000-000000000002'), '4 + 4 + 8 por etapa');
-- Mover a mano la siembra 16 al primer lugar le cambia la etapa.
update public.events set seeds = (select array[s[16]] || s[1:15] from sem41) where id = 'ffffffff-4100-4000-8000-000000000002';
select pg_temp.ok((select start_stage from public.tournament_registrations where event_id = 'ffffffff-4100-4000-8000-000000000002' and team_id = pg_temp.eq(1)) = 3,
                  'a mano: el que sube al 1 pasa a la etapa 3');
select public.event_generate('ffffffff-4100-4000-8000-000000000002');
select pg_temp.ok((select count(*) from public.matches where event_id = 'ffffffff-4100-4000-8000-000000000002' and stage = 'swiss' and phase = 1 and round = 1) = 4,
                  'el fixture se genera con esas etapas');
select pg_temp.ok(pg_temp.estado($q$select public.event_seed_ranking('ffffffff-4100-4000-8000-000000000002')$q$) = 'P0001', 'después de generar no se siembra');
select public.event_reset('ffffffff-4100-4000-8000-000000000002');
select pg_temp.ok((select status from public.events where id = 'ffffffff-4100-4000-8000-000000000002') = 'registration', 'sin partidas jugadas se vuelve a la siembra');

-- ---------- 3. mapas de una serie ----------
reset role;
select set_config('request.jwt.claims', '{}', true);
insert into public.events(id, name, template, game_mode, organizer_id, config) values
  ('ffffffff-4100-4000-8000-000000000003', 'Serie 41', 'single', '1v1', 'aaaaaaaa-4100-4000-8000-0000000000a1', '{"bo":3,"bo_semi":3,"bo_final":3}');
insert into public.tournament_registrations(event_id, team_id) values ('ffffffff-4100-4000-8000-000000000003', pg_temp.eq(1)), ('ffffffff-4100-4000-8000-000000000003', pg_temp.eq(2));
insert into public.tournament_registration_players(event_id, team_id, player_id) values
  ('ffffffff-4100-4000-8000-000000000003', pg_temp.eq(1), pg_temp.pl(1)), ('ffffffff-4100-4000-8000-000000000003', pg_temp.eq(2), pg_temp.pl(2));
-- Dos mixes jugados por los inscritos: en g1 el equipo 1 jugó del bando 1 (16-10); en g2, del bando 2 (el mix terminó 9-16).
-- g3 lo jugó gente de afuera.
insert into public.matches(id, kind, status, map, score1, score2, played_at) values
  ('cccccccc-4100-4000-8000-000000000001', 'mix', 'finished', 'de_dust2_ob', 16, 10, now() - interval '2 hours'),
  ('cccccccc-4100-4000-8000-000000000002', 'mix', 'finished', 'de_inferno', 9, 16, now() - interval '1 hour'),
  ('cccccccc-4100-4000-8000-000000000003', 'mix', 'finished', 'de_tuscan', 16, 3, now() - interval '1 hour');
insert into public.match_player_stats(match_id, steam_id, player_id, team, nick, kills, deaths, rounds, rating) values
  ('cccccccc-4100-4000-8000-000000000001', pg_temp.s(1), pg_temp.pl(1), 1, 'a', 20, 10, 26, 1.3),
  ('cccccccc-4100-4000-8000-000000000001', pg_temp.s(2), pg_temp.pl(2), 2, 'b', 10, 20, 26, 0.7),
  ('cccccccc-4100-4000-8000-000000000002', pg_temp.s(1), pg_temp.pl(1), 2, 'a', 18, 12, 25, 1.2),
  ('cccccccc-4100-4000-8000-000000000002', pg_temp.s(2), pg_temp.pl(2), 1, 'b', 12, 18, 25, 0.8),
  ('cccccccc-4100-4000-8000-000000000003', pg_temp.s(9), pg_temp.pl(9), 1, 'z', 20, 3, 19, 2.0);

set local role authenticated;
select pg_temp.como('aaaaaaaa-4100-4000-8000-0000000000a1');
select public.event_generate('ffffffff-4100-4000-8000-000000000003');
create temp table m41 as select id from public.matches where event_id = 'ffffffff-4100-4000-8000-000000000003' and not bye;
select pg_temp.ok((select count(*) from m41) = 1, 'una final BO3');

select pg_temp.como('aaaaaaaa-4100-4000-8000-0000000000a0');
create temp table c41 as select * from public.match_game_candidates((select id from m41));
select pg_temp.ok((select count(*) from c41) = 2, 'candidatos: los dos mixes de los inscritos, no el de afuera');
select pg_temp.ok((select side1 from c41 where game_id = 'cccccccc-4100-4000-8000-000000000002') = 2, 'bando deducido: en g2 el equipo 1 fue el bando 2');
select pg_temp.ok((select registered = 2 and players = 2 from c41 where game_id = 'cccccccc-4100-4000-8000-000000000001'), 'cuántos inscritos jugaron');

-- Mapa 1 con el mix g1 y mapa 2 a mano (13-16): serie 1-1, en curso.
select public.match_set_maps((select id from m41),
  '[{"game_id":"cccccccc-4100-4000-8000-000000000001"},{"map":"de_nuke_old_blue","r1":13,"r2":16}]');
select pg_temp.ok((select status = 'live' and score1 = 1 and score2 = 1 and winner is null from public.matches where id = (select id from m41)),
                  'dos mapas en un BO3 1-1: la serie sigue en curso');
select pg_temp.ok((select parent_match_id = (select id from m41) and parent_side1 = 1 from public.matches where id = 'cccccccc-4100-4000-8000-000000000001'),
                  'el mix queda vinculado con su bando');
select pg_temp.ok((select maps->1->>'game_id' is null and maps->0->>'game_id' = 'cccccccc-4100-4000-8000-000000000001'
                     from public.matches where id = (select id from m41)), 'el mapa a mano no tiene game_id (sin detalle)');

-- Mapa 3 con el mix g2 (el equipo 1 ganó 16-9 desde el bando 2): serie 2-1 y campeón.
select public.match_set_maps((select id from m41),
  '[{"game_id":"cccccccc-4100-4000-8000-000000000001"},{"map":"de_nuke_old_blue","r1":13,"r2":16},{"game_id":"cccccccc-4100-4000-8000-000000000002"}]');
select pg_temp.ok((select status = 'finished' and score1 = 2 and score2 = 1 and winner = pg_temp.eq(1) from public.matches where id = (select id from m41)),
                  'con el tercer mapa la serie se cierra');
select pg_temp.ok((select maps->2->>'r1' = '16' and maps->2->>'r2' = '9' from public.matches where id = (select id from m41)), 'las rondas del mix en el orden de la partida');
select pg_temp.ok((select champion = pg_temp.eq(1) from public.events where id = 'ffffffff-4100-4000-8000-000000000003'), 'y la llave avanza (campeón)');

-- Sacar el mix g2: la serie se reabre, el mix se desvincula y el torneo pierde el campeón.
select public.match_set_maps((select id from m41),
  '[{"game_id":"cccccccc-4100-4000-8000-000000000001"},{"map":"de_nuke_old_blue","r1":13,"r2":16}]');
select pg_temp.ok((select status = 'live' and winner is null from public.matches where id = (select id from m41)), 'sin el tercer mapa vuelve a en curso');
select pg_temp.ok((select parent_match_id is null from public.matches where id = 'cccccccc-4100-4000-8000-000000000002'), 'el mix que sale se desvincula');
select pg_temp.ok((select champion is null and status = 'in_progress' from public.events where id = 'ffffffff-4100-4000-8000-000000000003'), 'el torneo vuelve a en curso');

select pg_temp.ok(pg_temp.estado(format($q$select public.match_set_maps('%s', '[{"map":"x","r1":16,"r2":16}]')$q$, (select id from m41))) = 'P0001', 'mapa empatado: no');
select pg_temp.ok(pg_temp.estado(format($q$select public.match_set_maps('%s', '[{"map":"x","r1":16,"r2":1},{"map":"x","r1":16,"r2":1},{"map":"x","r1":16,"r2":1},{"map":"x","r1":16,"r2":1}]')$q$, (select id from m41))) = 'P0001',
                  'más mapas que el BO: no');
select pg_temp.ok(pg_temp.estado(format($q$select public.match_set_maps('%s', '[{"game_id":"cccccccc-4100-4000-8000-000000000001"},{"game_id":"cccccccc-4100-4000-8000-000000000001"}]')$q$, (select id from m41))) = 'P0001',
                  'el mismo mix dos veces: no');
select pg_temp.como('aaaaaaaa-4100-4000-8000-0000000000a2');
select pg_temp.ok(pg_temp.estado(format($q$select public.match_set_maps('%s', '[]')$q$, (select id from m41))) = '42501', 'otro organizador no carga mapas');
select pg_temp.ok(pg_temp.estado(format($q$select * from public.match_game_candidates('%s')$q$, (select id from m41))) = '42501', 'ni ve los candidatos');

-- Un mix vinculado a otra partida no se puede usar.
reset role;
select set_config('request.jwt.claims', '{}', true);
update public.matches set parent_match_id = (select id from m41), parent_side1 = 1 where id = 'cccccccc-4100-4000-8000-000000000003';
insert into public.events(id, name, template, game_mode, organizer_id) values ('ffffffff-4100-4000-8000-000000000004', 'Otra 41', 'single', '1v1', 'aaaaaaaa-4100-4000-8000-0000000000a1');
insert into public.tournament_registrations(event_id, team_id) values ('ffffffff-4100-4000-8000-000000000004', pg_temp.eq(3)), ('ffffffff-4100-4000-8000-000000000004', pg_temp.eq(4));
insert into public.tournament_registration_players(event_id, team_id, player_id) values
  ('ffffffff-4100-4000-8000-000000000004', pg_temp.eq(3), pg_temp.pl(3)), ('ffffffff-4100-4000-8000-000000000004', pg_temp.eq(4), pg_temp.pl(4));
set local role authenticated;
select pg_temp.como('aaaaaaaa-4100-4000-8000-0000000000ad');
select public.event_generate('ffffffff-4100-4000-8000-000000000004');
select pg_temp.ok(pg_temp.estado(format($q$select public.match_set_maps('%s', '[{"game_id":"cccccccc-4100-4000-8000-000000000003"}]')$q$,
                    (select id from public.matches where event_id = 'ffffffff-4100-4000-8000-000000000004' and not bye))) = 'V3901',
                  'un mix vinculado a otra partida: V3901 (409)');

rollback;

-- Pruebas de supabase/replanteo/44_rating_reciente.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;

-- 12 jugadores: p1..p12. p1 juega un 5v5 hace 3 días, un 2v2 hace 2 días y un 5v5 hace 60 días.
insert into public.players(id, nick, steam_id)
select ('eeeeeeee-4400-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'R44 ' || i, '765611990000440' || lpad(i::text, 2, '0')
  from generate_series(1, 12) i;

select set_config('v34.engine', '1', true);
insert into public.matches(id, kind, status, played_at, score1, score2) values
  ('ffffffff-4400-4000-8000-000000000001', 'mix', 'finished', now() - interval '3 days', 16, 10),
  ('ffffffff-4400-4000-8000-000000000002', 'mix', 'finished', now() - interval '2 days', 16, 2),
  ('ffffffff-4400-4000-8000-000000000003', 'mix', 'finished', now() - interval '60 days', 16, 0);

create function pg_temp.st(m text, p int, team int, kills int, deaths int) returns void language sql as $$
  insert into public.match_player_stats(match_id, player_id, steam_id, nick, team, kills, deaths, assists, headshots, damage,
                                        rounds, k1, k2, k3, k4, k5)
  values (('ffffffff-4400-4000-8000-00000000000' || m)::uuid, ('eeeeeeee-4400-4000-8000-0000000000' || lpad(p::text, 2, '0'))::uuid,
          '765611990000440' || lpad(p::text, 2, '0'), 'R44 ' || p, team, kills, deaths, 0, 0, kills * 100, 26, kills, 0, 0, 0, 0)
$$;
-- Partida 1: 5v5 (p1..p5 contra p6..p10). p1 hace 26 kills y 10 muertes.
select pg_temp.st('1', i, case when i <= 5 then 1 else 2 end, case when i = 1 then 26 else 15 end, case when i = 1 then 10 else 15 end)
  from generate_series(1, 10) i;
-- Partida 2: 2v2 (p1, p2 contra p11, p12). p1 hace 0 kills: no debe contar.
select pg_temp.st('2', i, case when i in (1, 2) then 1 else 2 end, 0, 16) from unnest(array[1, 2, 11, 12]) i;
-- Partida 3: 5v5 de hace 60 días. p1 hace 0 kills: no cuenta con la ventana de 28 días.
select pg_temp.st('3', i, case when i <= 5 then 1 else 2 end, 0, 16) from generate_series(1, 10) i;

select pg_temp.ok((select maps = 1 and rating = public.csstv_rating(26, 10, 26, 26, 0, 0, 0, 0)
                     from public.player_recent_rating(array['eeeeeeee-4400-4000-8000-000000000001'::uuid])),
                  'solo cuenta el 5v5 reciente: el 2v2 y el de hace 60 días no');
select pg_temp.ok((select maps = 2 from public.player_recent_rating(array['eeeeeeee-4400-4000-8000-000000000001'::uuid], 90)),
                  'con 90 días entra el 5v5 viejo');
select pg_temp.ok((select count(*) = 0 from public.player_recent_rating(array['eeeeeeee-4400-4000-8000-000000000011'::uuid])),
                  'quien solo jugó un 2v2 no aparece');
select pg_temp.ok((select count(*) = 10 from public.player_recent_rating(
                     array(select ('eeeeeeee-4400-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 12) i))),
                  'varios jugadores a la vez: los 10 del 5v5');
set local role anon;
select pg_temp.ok((select count(*) = 1 from public.player_recent_rating(array['eeeeeeee-4400-4000-8000-000000000001'::uuid])),
                  'anon puede consultarlo');
reset role;

rollback;

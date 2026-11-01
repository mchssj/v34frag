-- Torneo suizo FINALIZADO de prueba para la base LOCAL (Supabase en Docker). Nunca correr en la real.
--   docker exec -i supabase_db_v34frag-api psql -U postgres -v ON_ERROR_STOP=1 < suizo_finalizado_local.sql
-- Crea 16 equipos ("… (suizo)", tag SZ…) con 5 jugadores cada uno, un suizo de 16 equipos a
-- 3 victorias (BO1, BO3 en las partidas decisivas) con playoffs de 8 y 3.er puesto, y juega todo
-- con el motor de la base: el mejor sembrado gana más seguido, con mapas y rondas variados.
-- Es repetible: borra antes el torneo, los equipos y los jugadores que haya creado.
begin;

-- El motor exige un admin (auth.uid()).
select set_config('request.jwt.claim.sub', (select id::text from public.profiles where role = 'admin' limit 1), true);
select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where role = 'admin' limit 1), 'role', 'authenticated')::text, true);

delete from public.events where name = 'Suizo de prueba (finalizado)';
delete from public.teams where tag like 'SZ%' and name like '% (suizo)';
delete from public.players where nick like '%.sz';

create temp table sz_equipos(n int primary key, nombre text, tag text, id uuid default gen_random_uuid()) on commit drop;
insert into sz_equipos(n, nombre, tag) values
  (1, 'Cóndores', 'CND'), (2, 'Furia Roja', 'FUR'), (3, 'Los Halcones', 'HLC'), (4, 'Kraken', 'KRK'),
  (5, 'Tormenta', 'TRM'), (6, 'Vértigo', 'VRT'), (7, 'Jaguares', 'JAG'), (8, 'Nébula', 'NEB'),
  (9, 'Titanes', 'TIT'), (10, 'Sombra', 'SMB'), (11, 'Lobos Grises', 'LBG'), (12, 'Ámbar', 'AMB'),
  (13, 'Fénix', 'FNX'), (14, 'Centella', 'CNT'), (15, 'Mamba', 'MMB'), (16, 'Granito', 'GRN');

create temp table sz_jugadores(n int, j int, id uuid default gen_random_uuid(), nick text) on commit drop;
insert into sz_jugadores(n, j, nick)
  select e.n, j, lower(e.tag) || (array['ace','nox','vex','kai','zed'])[j] || '.sz' from sz_equipos e, generate_series(1, 5) j;

do $$
#variable_conflict use_column
declare
  ev uuid; m record; n int := 0;
  s1 int; s2 int; gana1 boolean; need int; pierde int; total int;
  pool text[] := array['de_dust2_ob','de_inferno','de_mirage_rc1','de_nuke_old_blue','de_tuscan','de_cbble','de_season'];
  mapas jsonb; elegidos text[]; quien boolean[]; i int; ganador_r int; perdedor_r int; dia timestamptz;
begin
  perform setseed(0.34);
  insert into public.teams(id, name, tag) select id, nombre || ' (suizo)', 'SZ' || tag from sz_equipos;
  insert into public.players(id, nick, steam_id)
    select id, nick, '765611999340' || lpad((n * 10 + j)::text, 5, '0') from sz_jugadores;
  insert into public.team_members(team_id, player_id, role, joined_at)
    select e.id, p.id, 'player', now() - interval '60 days' from sz_jugadores p join sz_equipos e using (n);

  insert into public.events(name, template, config, starts_on, ends_on, prize, map_pool, seeds, game_mode)
    values ('Suizo de prueba (finalizado)', 'swiss',
            '{"stages":1,"size":16,"wins":3,"bo":1,"bo_decisive":3,"playoffs":{"bo":3,"bo_final":3,"third_place":true}}',
            date '2026-10-17', date '2026-10-26', 'USD 300', pool,
            (select array_agg(id order by n) from sz_equipos), '5v5')
    returning id into ev;
  insert into public.tournament_registrations(event_id, team_id, created_at)
    select ev, id, now() - interval '20 days' + n * interval '1 hour' from sz_equipos;
  insert into public.tournament_registration_players(event_id, team_id, player_id, role)
    select ev, e.id, p.id, 'active' from sz_equipos e join sz_jugadores p using (n);

  perform public.event_generate(ev);

  loop
    perform set_config('v34.engine', '', true);
    select * into m from public.matches where event_id = ev and status = 'upcoming' and team1 is not null and team2 is not null
     order by phase, stage desc, round, pos limit 1;   -- 'swiss' antes que 'ko'/'third'
    exit when not found;
    n := n + 1;
    exit when n > 200;
    s1 := (select e.n from sz_equipos e where e.id = m.team1);
    s2 := (select e.n from sz_equipos e where e.id = m.team2);
    -- Probabilidad tipo Elo: 8 puestos de siembra de diferencia ≈ 76 % para el mejor.
    gana1 := random() < 1 / (1 + power(10, (s1 - s2) / 16.0));
    need := m.best_of / 2 + 1 - case when m.advantage_side = case when gana1 then 1 else 2 end then 1 else 0 end;
    pierde := case when need > 1 then floor(random() * need)::int else 0 end;
    total := need + pierde;
    -- Mapas distintos al azar y el último siempre del ganador.
    select array_agg(x order by random()) into elegidos from unnest(pool) x;
    select array_agg(v order by random()) into quien
      from (select true v from generate_series(1, need - 1) union all select false from generate_series(1, pierde)) q;
    quien := coalesce(quien, '{}') || true;
    mapas := '[]';
    for i in 1 .. total loop
      if random() < 0.15 then ganador_r := 19; perdedor_r := 15 + floor(random() * 3)::int;
      else ganador_r := 16; perdedor_r := 2 + floor(random() * 13)::int; end if;
      -- quien[i] = true: ese mapa lo gana el ganador de la serie
      if quien[i] = gana1 then
        mapas := mapas || jsonb_build_object('map', elegidos[i], 'r1', ganador_r, 'r2', perdedor_r);
      else
        mapas := mapas || jsonb_build_object('map', elegidos[i], 'r1', perdedor_r, 'r2', ganador_r);
      end if;
    end loop;
    dia := timestamptz '2026-10-17 20:00-05' + (coalesce(m.round, 1) - 1 + case when m.stage = 'swiss' then 0 else 6 end) * interval '1 day'
           + coalesce(m.pos, 1) * interval '50 minutes';
    update public.matches set
      status = 'finished', winner = case when gana1 then team1 else team2 end, maps = mapas,
      score1 = case when gana1 then need else pierde end,
      score2 = case when gana1 then pierde else need end,
      starts_at = dia, played_at = dia + total * interval '45 minutes',
      lineup1 = (select array_agg(p.id order by p.j) from sz_jugadores p join sz_equipos e using (n) where e.id = m.team1),
      lineup2 = (select array_agg(p.id order by p.j) from sz_jugadores p join sz_equipos e using (n) where e.id = m.team2)
     where id = m.id;
  end loop;
  perform set_config('v34.engine', '', true);

  if (select status from public.events where id = ev) <> 'finished' then
    raise exception 'El torneo no terminó (partidas jugadas: %, estado: %)', n, (select status from public.events where id = ev);
  end if;
  raise notice 'Torneo % terminado: % partidas, campeón %', ev, n,
    (select t.name from public.events e join public.teams t on t.id = e.champion where e.id = ev);
end $$;

commit;

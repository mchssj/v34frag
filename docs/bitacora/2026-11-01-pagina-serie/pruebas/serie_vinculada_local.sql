-- Datos de prueba SOLO para la base local: la serie "Titanes (suizo)" contra "Mamba (suizo)" del
-- "Suizo de prueba (finalizado)" con sus dos mapas vinculados (mixes 5v5 con stats), el veto y clips
-- (en cola y grabándose), para ver la página de la serie completa.
-- Se puede correr de nuevo: primero borra lo anterior. Al final, el bloque para borrarlo.
begin;
select setseed(0.51);
select set_config('v34.engine', '1', true);

create temp table s on commit drop as
select m.id, m.team1 as t1, m.team2 as t2,
       (select array_agg(x.player_id order by p.nick) from team_members x join players p on p.id = x.player_id
         where x.team_id = m.team1 and x.left_at is null) as j1,
       (select array_agg(x.player_id order by p.nick) from team_members x join players p on p.id = x.player_id
         where x.team_id = m.team2 and x.left_at is null) as j2
  from matches m join events e on e.id = m.event_id join teams a on a.id = m.team1 join teams b on b.id = m.team2
 where e.name = 'Suizo de prueba (finalizado)' and a.name = 'Titanes (suizo)' and b.name = 'Mamba (suizo)';
do $$ begin if (select count(*) from s) <> 1 then raise exception 'No encontré la serie Titanes contra Mamba'; end if; end $$;

-- Limpieza de una corrida anterior.
delete from match_clips where match_id in (select id from matches where external_id like 'prueba-serie-%');
delete from match_player_stats where match_id in (select id from matches where external_id like 'prueba-serie-%');
delete from matches where external_id like 'prueba-serie-%';
delete from match_vetos where match_id = (select id from s);

-- Mapa 1: de_inferno 16-12 con los bandos de la serie. Mapa 2: de_tuscan 16-6 con los bandos invertidos
-- (en el juego, Mamba es el bando 1): así se prueba que las stats vuelvan a los lados de la serie.
create temp table g on commit drop as
select * from (values
  ('aaaaaaaa-5101-4000-8000-000000000001'::uuid, 'de_inferno', 16, 12, 1, now() - interval '50 minutes'),
  ('aaaaaaaa-5101-4000-8000-000000000002'::uuid, 'de_tuscan', 6, 16, 2, now() - interval '10 minutes')
) v(id, map, score1, score2, parent_side1, cuando);

insert into matches(id, kind, status, map, score1, score2, played_at, starts_at, parent_match_id, parent_side1, external_id, demo_status)
select g.id, 'mix', 'finished', g.map, g.score1, g.score2, g.cuando, g.cuando, s.id, g.parent_side1, 'prueba-serie-' || g.id,
       case when g.parent_side1 = 1 then 'uploaded' else 'pending' end
  from g cross join s;

insert into match_player_stats(match_id, player_id, steam_id, nick, team, kills, deaths, assists, headshots, damage,
                               rounds, k1, k2, k3, k4, k5, first_kills, first_deaths, plants, defuses, elo_delta)
select x.gid, x.pid, p.steam_id, p.nick, x.team,
       x.k1 + 2 * x.k2 + 3 * x.k3 + 4 * x.k4 + 5 * x.k5, x.deaths, x.assists,
       ((x.k1 + 2 * x.k2 + 3 * x.k3) * 0.45)::int, (x.k1 + 2 * x.k2 + 3 * x.k3 + 4 * x.k4) * (90 + (random() * 30)::int),
       x.rounds, x.k1, x.k2, x.k3, x.k4, x.k5, (random() * 5)::int, (random() * 5)::int, (random() * 3)::int, (random() * 2)::int,
       case when x.won then 12 + (random() * 8)::int else -(12 + (random() * 8)::int) end
  from (
    select g.id as gid, j.pid, j.team, g.score1 + g.score2 as rounds,
           (g.score1 > g.score2) = (j.team = 1) as won,
           (5 + (abs(hashtext(j.pid::text)) % 7) + random() * 4)::int as k1, (random() * 4)::int as k2, (random() * 2)::int as k3,
           (random() < 0.2)::int as k4, (random() < 0.05)::int as k5, (10 + random() * 9)::int as deaths, (random() * 6)::int as assists
      from g cross join s
      cross join lateral (
        -- Bando 1 del juego: Titanes si parent_side1 = 1; si no, Mamba.
        select u.pid, case when g.parent_side1 = 1 then 1 else 2 end as team from unnest(s.j1[1:5]) u(pid)
        union all select u.pid, case when g.parent_side1 = 1 then 2 else 1 end from unnest(s.j2[1:5]) u(pid)
      ) j
  ) x join players p on p.id = x.pid;

-- El rating de cada fila (el plugin lo manda calculado; acá se calcula con la misma fórmula).
update match_player_stats set rating = csstv_rating(kills, deaths, rounds, k1, k2, k3, k4, k5)
 where match_id in (select id from matches where external_id like 'prueba-serie-%');

-- La serie con sus mapas vinculados.
update matches m set maps = jsonb_build_array(
    jsonb_build_object('map', 'de_inferno', 'r1', 16, 'r2', 12, 'game_id', 'aaaaaaaa-5101-4000-8000-000000000001'),
    jsonb_build_object('map', 'de_tuscan', 'r1', 16, 'r2', 6, 'game_id', 'aaaaaaaa-5101-4000-8000-000000000002'))
  from s where m.id = s.id;

-- Veto de un BO3 con 7 mapas: ban, ban, pick, pick, ban, ban y el decisivo.
-- Lo firma el líder de cada equipo (o, si no tiene, cualquier usuario).
insert into match_vetos(match_id, seq, team_id, map, action, by_user)
select s.id, v.seq, case when v.seq % 2 = 1 then s.t1 else s.t2 end, v.map, v.action,
       coalesce((select captain_id from teams where id = case when v.seq % 2 = 1 then s.t1 else s.t2 end),
                (select id from auth.users limit 1))
  from s cross join (values (1, 'de_nuke_old_blue', 'ban'), (2, 'de_season', 'ban'), (3, 'de_inferno', 'pick'),
                            (4, 'de_tuscan', 'pick'), (5, 'de_mirage_rc1', 'ban'), (6, 'de_dust2_ob', 'ban')) v(seq, map, action);

-- Clips del mapa 1 (en cola: video_status null; uno grabándose). En local no hay videos: se ven como "Procesando clips…". El mapa 2 se jugó
-- hace 10 minutos y su demo se está subiendo: todavía sin clips.
insert into match_clips(match_id, round, player_steamid, player_name, round_won, kill_ticks, clutch_vs, clutch_start_tick, end_tick, video_status)
select 'aaaaaaaa-5101-4000-8000-000000000001', c.round, p.steam_id, p.nick, true, c.ticks, c.vs, c.st, c.et, c.status
  from s cross join (values
    (1, 7, array[1000, 1200, 1350, 1500, 1700], null::int, null::int, null::int, null::text),
    (2, 15, array[9000, 9300, 9500, 9700], null, null, null, null),
    (6, 21, array[15000, 15400], 2, 15100, 15900, 'processing'),
    (3, 4, array[3000, 3100, 3300], null, null, null, null)
  ) c(n, round, ticks, vs, st, et, status)
  join players p on p.id = (s.j1 || s.j2)[c.n];

commit;

-- Para borrar los juegos y los clips:
-- begin;
-- delete from match_clips where match_id in (select id from matches where external_id like 'prueba-serie-%');
-- delete from match_player_stats where match_id in (select id from matches where external_id like 'prueba-serie-%');
-- delete from matches where external_id like 'prueba-serie-%';
-- commit;
-- Los mapas y el veto de la serie quedan: para dejarla como estaba, correr de nuevo
-- docs/bitacora/2026-10-31-llave-por-formato/pruebas/suizo_finalizado_local.sql.
